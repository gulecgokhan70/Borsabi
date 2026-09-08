import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { DAILY_LOSS_LIMIT, MAX_RISK_PER_TRADE, isIndexSymbol } from './constants';

const positiveNumber = z.number().finite().positive();
export const tradeSchema = z.object({
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9.^=-]+$/).transform(s => s.toUpperCase()),
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['BUY', 'SELL']),
  marketType: z.enum(['BIST', 'CRYPTO']).default('BIST'),
  quantity: positiveNumber,
  // Older clients send a price; execution always uses a server quote.
  price: positiveNumber.optional(),
  orderType: z.literal('market', { errorMap: () => ({ message: 'Şu anda yalnızca piyasa emri destekleniyor.' }) }).default('market'),
  stopLoss: positiveNumber.nullish(),
  takeProfit: positiveNumber.nullish(),
  trailingStopPercent: positiveNumber.max(100).nullish(),
  note: z.string().max(2000).nullish(),
}).superRefine((trade, ctx) => {
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
export async function executeTrade(db: PrismaClient, userId: string, input: TradeInput, executionPrice: number) {
  const trade = tradeSchema.parse(input);
  const { symbol, name, type, marketType, quantity, stopLoss, takeProfit, trailingStopPercent, note } = trade;
  const price = executionPrice;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity * price) || quantity * price > Number.MAX_SAFE_INTEGER) {
    throw new TradeError('Geçerli işlem fiyatı veya miktarı bulunamadı');
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new TradeError('Kullanıcı bulunamadı', 404);
        const rate = user.commissionRate;
        if (!Number.isFinite(rate) || rate < 0 || rate > 0.01) throw new TradeError('Komisyon oranı geçersiz');
        const total = quantity * price;
        const commission = total * rate;
        const warnings: string[] = [];
        const riskAmount = stopLoss ? Math.abs(price - stopLoss) * quantity : total * MAX_RISK_PER_TRADE;
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
        const common = { userId, symbol, name: name ?? symbol, marketType, quantity, price, total, commission, note: note ?? null };
        if (type === 'BUY') {
          const required = total + commission;
          if (required > user.balance) throw new TradeError(`Yetersiz bakiye. Gerekli: ${required.toFixed(2)}, Mevcut: ${user.balance.toFixed(2)}`);
          const balanceUpdate = await tx.user.updateMany({ where: { id: userId, balance: { gte: required } }, data: { balance: { decrement: required } } });
          if (balanceUpdate.count !== 1) throw new TradeError('Yetersiz bakiye');
          if (position) {
            const newQuantity = position.quantity + quantity;
            await tx.position.update({ where: { id: position.id }, data: {
              quantity: newQuantity, entryPrice: (position.quantity * position.entryPrice + total) / newQuantity,
              currentPrice: price, stopLoss: stopLoss ?? position.stopLoss, takeProfit: takeProfit ?? position.takeProfit,
              trailingStopPercent: trailingStopPercent ?? position.trailingStopPercent,
              trailingStopHighest: (trailingStopPercent ?? position.trailingStopPercent) ? Math.max(price, position.trailingStopHighest ?? price) : null,
              commission: position.commission + commission,
            } });
          } else {
            await tx.position.create({ data: {
              userId, symbol, name: name ?? symbol, type: marketType, quantity, entryPrice: price, currentPrice: price,
              stopLoss: stopLoss ?? null, takeProfit: takeProfit ?? null, trailingStopPercent: trailingStopPercent ?? null,
              trailingStopHighest: trailingStopPercent ? price : null, commission, status: 'OPEN',
            } });
          }
          await tx.transaction.create({ data: { ...common, type, stopLoss: stopLoss ?? null, takeProfit: takeProfit ?? null } });
          return { success: true, message: `${quantity} adet ${symbol} alındı`, warnings, price };
        }
        if (!position) throw new TradeError('Açık pozisyon bulunamadı');
        const sale = calculateSale(position, quantity, price, rate);
        // Preserve even very small remaining crypto holdings.
        const closed = sale.remainingQuantity === 0;
        const cumulativePnl = position.pnl + sale.pnl;
        const purchases = await tx.transaction.aggregate({ where: {
          userId, symbol: { in: aliases }, marketType, type: 'BUY', createdAt: { gte: position.openedAt },
        }, _sum: { total: true } });
        const totalCost = purchases._sum.total ?? position.quantity * position.entryPrice;
        await tx.position.update({ where: { id: position.id }, data: {
          quantity: sale.remainingQuantity, commission: sale.remainingCommission, currentPrice: price,
          status: closed ? 'CLOSED' : 'OPEN', closedAt: closed ? new Date() : null,
          pnl: cumulativePnl, pnlPercent: totalCost > 0 ? cumulativePnl / totalCost * 100 : 0,
        } });
        await tx.user.update({ where: { id: userId }, data: { balance: { increment: sale.total - sale.commission } } });
        await tx.transaction.create({ data: { ...common, type, pnl: sale.pnl, pnlPercent: sale.pnlPercent } });
        return { success: true, message: `${quantity} adet ${symbol} satıldı. K/Z: ${sale.pnl.toFixed(2)}`, warnings, pnl: sale.pnl, price };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < 3) continue;
        throw new TradeError('Eşzamanlı işlem nedeniyle tamamlanamadı. Lütfen tekrar deneyin.', 409);
      }
      throw error;
    }
  }
  throw new TradeError('İşlem tamamlanamadı', 409);
}
