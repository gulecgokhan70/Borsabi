import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { pnlBreakdown } from './pnl-breakdown';
import { z } from 'zod';
import { DAILY_LOSS_LIMIT, MAX_RISK_PER_TRADE, isIndexSymbol } from './constants';
import { CurrencyError, entryCostTry, toTry, type FxQuote } from './currency';

const positiveNumber = z.number().finite().positive();
export const tradeSchema = z.object({
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9.^=-]+$/).transform(s => s.toUpperCase()),
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['BUY', 'SELL']),
  marketType: z.enum(['BIST', 'CRYPTO']).default('BIST'),
  quantity: positiveNumber,
  maxSpendTry: positiveNumber.optional(),
  requestId: z.string().min(16).max(160).regex(/^[A-Za-z0-9:._-]+$/).optional(),
  autoExit: z.boolean().optional(),
  // Older clients send a price; execution always uses a server quote.
  price: positiveNumber.optional(),
  orderType: z.literal('market', { errorMap: () => ({ message: 'Şu anda yalnızca piyasa emri destekleniyor.' }) }).default('market'),
  stopLoss: positiveNumber.nullish(),
  takeProfit: positiveNumber.nullish(),
  trailingStopPercent: positiveNumber.max(100).nullish(),
  note: z.string().max(2000).nullish(),
}).superRefine((trade, ctx) => {
  if (trade.type !== 'BUY' && trade.maxSpendTry != null) ctx.addIssue({ code: 'custom', message: 'Bütçe sınırı yalnızca alımlarda kullanılır.' });
  if (isIndexSymbol(trade.symbol) || isIndexSymbol(`${trade.symbol}.IS`)) {
    ctx.addIssue({ code: 'custom', path: ['symbol'], message: 'Endeks sembolleri alınıp satılamaz.' });
  }
  if (trade.marketType === 'BIST' && !Number.isSafeInteger(trade.quantity)) {
    ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'BIST işlemlerinde miktar tam sayı olmalıdır.' });
  }
  if ((trade.marketType === 'CRYPTO' && !trade.symbol.endsWith('-USD')) ||
      (trade.marketType === 'BIST' && trade.symbol.endsWith('-USD'))) {
    ctx.addIssue({ code: 'custom', path: ['marketType'], message: 'Sembol ve piyasa türü uyuşmuyor.' });
  }
  if (trade.marketType === 'BIST' && !/^[A-Z0-9]+(?:\.IS)?$/.test(trade.symbol)) {
    ctx.addIssue({ code: 'custom', path: ['symbol'], message: 'Geçersiz BIST sembolü.' });
  }
});

export type TradeInput = z.infer<typeof tradeSchema>;
export class TradeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type TradeResult = { success: boolean; message: string; warnings: string[]; price: number; priceTry: number; fxRate: number; pnl?: number; quantity?: number; total?: number; commission?: number };
export function tradeFingerprint(input: TradeInput) {
  return createHash('sha256').update(JSON.stringify(tradeSchema.parse(input))).digest('hex');
}
export async function priorTrade(db: PrismaClient | Prisma.TransactionClient, userId: string, input: TradeInput): Promise<TradeResult | null> {
  if (!input.requestId) return null;
  const previous = await db.tradeRequest.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
  if (!previous) return null;
  if (previous.fingerprint !== tradeFingerprint(input)) throw new TradeError('Bu işlem kimliği farklı bir emir için kullanılmış.', 409);
  return previous.result as unknown as TradeResult;
}

type AutoExecution = { positionId: string; updatedAt: Date; reason: string };

export function calculateSale(position: { quantity: number; entryPrice: number; commission: number }, quantity: number, price: number, rate: number) {
  if (quantity > position.quantity) throw new TradeError('Yetersiz miktar');
  const total = quantity * price;
  const commission = total * rate;
  const costBasis = quantity * position.entryPrice;
  const buyCommissionShare = position.commission * (quantity / position.quantity);
  const pnl = total - costBasis - buyCommissionShare - commission;
  return {
    total, commission, pnl,
    pnlPercent: costBasis > 0 ? pnl / costBasis * 100 : 0,
    remainingQuantity: position.quantity - quantity,
    remainingCommission: Math.max(0, position.commission - buyCommissionShare),
  };
}

// All writes roll back together. Serializable + retry protects concurrent orders.
export async function executeTrade(db: PrismaClient, userId: string, input: TradeInput, executionPrice: number, fx?: FxQuote, automation?: AutoExecution): Promise<TradeResult> {
  const trade = tradeSchema.parse(input);
  const { symbol, name, type, marketType, quantity, stopLoss, takeProfit, trailingStopPercent, note } = trade;
  const price = executionPrice;
  if (marketType === 'CRYPTO' && (!fx || !Number.isFinite(fx.asOf.getTime()))) {
    throw new CurrencyError('Kripto işlemi için doğrulanmış USD/TL kuru gerekli.');
  }
  const fxRate = marketType === 'CRYPTO' ? fx!.rate : 1;
  const priceTry = toTry(price, fxRate);
  if (!Number.isFinite(quantity * priceTry) || quantity * priceTry > Number.MAX_SAFE_INTEGER) {
    throw new TradeError('Geçerli işlem fiyatı veya miktarı bulunamadı');
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const previous = await priorTrade(tx, userId, trade);
        if (previous) return previous;
        const finish = async (result: TradeResult) => {
          if (trade.requestId) await tx.tradeRequest.create({ data: { userId, requestId: trade.requestId, fingerprint: tradeFingerprint(trade), result: result as unknown as Prisma.InputJsonValue } });
          return result;
        };
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new TradeError('Kullanıcı bulunamadı', 404);
        const rate = user.commissionRate;
        if (!Number.isFinite(rate) || rate < 0 || rate > 0.01) throw new TradeError('Komisyon oranı geçersiz');
        const total = quantity * priceTry;
        const commission = total * rate;
        if (trade.maxSpendTry != null && total + commission > trade.maxSpendTry) {
          throw new TradeError('Fiyat veya kur değişti; komisyon dahil bütçe sınırı aşılıyor. Güncel tutarı kontrol edip yeniden deneyin.', 409);
        }
        if (type === 'BUY' && trade.autoExit && ((stopLoss != null && stopLoss >= price) || (takeProfit != null && takeProfit <= price))) {
          throw new TradeError('Otomatik satış için zarar kes alış fiyatının altında, kâr al üstünde olmalı.');
        }
        const warnings: string[] = [];
        const riskAmount = stopLoss ? Math.abs(price - stopLoss) * fxRate * quantity : total * MAX_RISK_PER_TRADE;
        const riskPercent = user.balance > 0 ? riskAmount / user.balance : 0;
        if (riskPercent > MAX_RISK_PER_TRADE) warnings.push(`⚠️ İşlem başına risk %${(riskPercent * 100).toFixed(1)} - Maksimum %1 önerilir`);
        const now = Date.now();
        // Türkiye gün başlangıcı; sunucunun saat diliminden bağımsız.
        const today = new Date(Math.floor((now + 3 * 3600000) / 86400000) * 86400000 - 3 * 3600000);
        const losses = await tx.transaction.aggregate({ where: { userId, createdAt: { gte: today }, pnl: { lt: 0 } }, _sum: { pnl: true } });
        const dailyLossPercent = user.initialBalance > 0 ? Math.abs(losses._sum.pnl ?? 0) / user.initialBalance : 0;
        if (dailyLossPercent > DAILY_LOSS_LIMIT) warnings.push(`⚠️ Günlük zarar limiti aşıldı (%${(dailyLossPercent * 100).toFixed(1)})`);
        const aliases = marketType === 'BIST' ? [symbol, symbol.replace(/\.IS$/, '')] : [symbol];
        const position = await tx.position.findFirst({ where: { userId, symbol: { in: aliases }, type: marketType, status: 'OPEN' } });
        const positionCost = position ? entryCostTry(position) : 0;
        if (automation && (!position || !position.autoExit || position.id !== automation.positionId || position.updatedAt.getTime() !== automation.updatedAt.getTime())) {
          throw new TradeError('Pozisyon değişti; otomatik işlem yeniden değerlendirilecek.', 409);
        }
        const common = { userId, symbol, name: name ?? symbol, marketType, quantity, price, total, commission,
          fxRate, fxAsOf: marketType === 'CRYPTO' ? fx!.asOf : null, note: note ?? null };
        if (type === 'BUY') {
          const required = total + commission;
          if (required > user.balance) throw new TradeError(`Yetersiz bakiye. Gerekli: ${required.toFixed(2)}, Mevcut: ${user.balance.toFixed(2)}`);
          const balanceUpdate = await tx.user.updateMany({ where: { id: userId, balance: { gte: required } }, data: { balance: { decrement: required } } });
          if (balanceUpdate.count !== 1) throw new TradeError('Yetersiz bakiye');
          if (position) {
            const newQuantity = position.quantity + quantity;
            await tx.position.update({ where: { id: position.id }, data: {
              quantity: newQuantity, entryPrice: (position.quantity * position.entryPrice + quantity * price) / newQuantity,
              entryPriceTry: (position.quantity * positionCost + total) / newQuantity,
              currentPrice: price, stopLoss: stopLoss ?? position.stopLoss, takeProfit: takeProfit ?? position.takeProfit,
              trailingStopPercent: trailingStopPercent ?? position.trailingStopPercent,
              trailingStopHighest: (trailingStopPercent ?? position.trailingStopPercent) ? Math.max(price, position.trailingStopHighest ?? price) : null,
              commission: position.commission + commission,
              autoExit: trade.autoExit ?? position.autoExit,
            } });
          } else {
            await tx.position.create({ data: {
              userId, symbol, name: name ?? symbol, type: marketType, quantity, entryPrice: price, entryPriceTry: priceTry, currentPrice: price,
              stopLoss: stopLoss ?? null, takeProfit: takeProfit ?? null, trailingStopPercent: trailingStopPercent ?? null,
              trailingStopHighest: trailingStopPercent ? price : null, commission, status: 'OPEN', autoExit: trade.autoExit ?? false,
            } });
          }
          await tx.transaction.create({ data: { ...common, type, stopLoss: stopLoss ?? null, takeProfit: takeProfit ?? null } });
          return finish({ success: true, message: `${quantity} adet ${symbol} alındı`, warnings, price, priceTry, fxRate, quantity, total, commission });
        }
        if (!position) throw new TradeError('Açık pozisyon bulunamadı');
        const sale = calculateSale({ ...position, entryPrice: positionCost }, quantity, priceTry, rate);
        // Preserve even very small remaining crypto holdings.
        const closed = sale.remainingQuantity === 0;
        const cumulativePnl = position.pnl + sale.pnl;
        const purchases = await tx.transaction.aggregate({ where: {
          userId, symbol: { in: aliases }, marketType, type: 'BUY', createdAt: { gte: position.openedAt },
        }, _sum: { total: true } });
        const totalCost = purchases._sum.total ?? position.quantity * positionCost;
        await tx.position.update({ where: { id: position.id }, data: {
          quantity: sale.remainingQuantity, commission: sale.remainingCommission, currentPrice: price,
          status: closed ? 'CLOSED' : 'OPEN', closedAt: closed ? new Date() : null,
          pnl: cumulativePnl, pnlPercent: totalCost > 0 ? cumulativePnl / totalCost * 100 : 0,
        } });
        await tx.user.update({ where: { id: userId }, data: { balance: { increment: sale.total - sale.commission } } });
        const breakdown = pnlBreakdown(quantity, position.entryPrice, positionCost, price, fxRate, position.commission * quantity / position.quantity, sale.commission);
        const entry = await tx.transaction.create({ data: { ...common, type, pnl: sale.pnl, pnlPercent: sale.pnlPercent,
          pricePnlTry: breakdown.pricePnlTry, fxPnlTry: breakdown.fxPnlTry, buyCommissionTry: position.commission * quantity / position.quantity,
          executionReason: automation?.reason ?? 'MANUAL' } });
        if (automation) await tx.appNotification.create({ data: { userId, eventKey: `sale:${entry.id}`, title: 'Otomatik simülasyon satışı',
          body: `${symbol}: ${automation.reason}. Sonuç: ${sale.pnl.toFixed(2)} TL. Gözlenen piyasa fiyatı kullanıldı.`, url: '/trade-log' } });
        return finish({ success: true, message: `${quantity} adet ${symbol} satıldı. K/Z: ${sale.pnl.toFixed(2)} TL`, warnings, pnl: sale.pnl, price, priceTry, fxRate, quantity, total, commission: sale.commission });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || (error.code === 'P2002' && trade.requestId))) {
        if (attempt < 3) continue;
        throw new TradeError('Eşzamanlı işlem nedeniyle tamamlanamadı. Lütfen tekrar deneyin.', 409);
      }
      throw error;
    }
  }
  throw new TradeError('İşlem tamamlanamadı', 409);
}
