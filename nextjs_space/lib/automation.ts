import type { PrismaClient, Position } from '@prisma/client';
import { cachedQuoteBatch } from './yahoo-finance';
import { getUsdTryRate } from './fx';
import { executeTrade, tradeSchema, TradeError } from './trading';
import { quoteCurrency } from './currency';
import { normalizeMarketSymbol } from './market-quotes';

export type AutomationQuote = { price: number; currency: string; asOf: Date; marketState?: string };
export function usableAutomationQuote(q: AutomationQuote | undefined, type: string, now = Date.now()) {
  if (!q || q.currency !== quoteCurrency(type) || !Number.isFinite(q.price) || q.price <= 0) return false;
  const age = now - q.asOf.getTime();
  return Number.isFinite(age) && age >= -60_000 && age <= (type === 'CRYPTO' ? 120_000 : 20 * 60_000)
    && (type === 'CRYPTO' || q.marketState === 'REGULAR');
}
export function exitDecision(p: Pick<Position, 'entryPrice' | 'trailingStopPercent' | 'trailingStopHighest' | 'stopLoss' | 'takeProfit'>, price: number) {
  const high = Math.max(price, p.trailingStopHighest ?? p.entryPrice);
  const trailing = p.trailingStopPercent && p.trailingStopPercent > 0 && p.trailingStopPercent <= 100
    ? high * (1 - p.trailingStopPercent / 100) : null;
  const stop = Math.max(p.stopLoss ?? 0, trailing ?? 0);
  const reason = stop > 0 && price <= stop ? (trailing && trailing >= (p.stopLoss ?? 0) ? 'İz süren stop' : 'Zarar kes')
    : p.takeProfit && price >= p.takeProfit ? 'Kâr al' : null;
  return { high, stop: stop || null, reason };
}
export async function automationQuotes(symbols: string[]) {
  const raw = await cachedQuoteBatch([...new Set(symbols)]);
  const result = new Map<string, AutomationQuote>();
  for (const [symbol, q] of raw) {
    const time = q.regularMarketTime;
    result.set(symbol, { price: q.regularMarketPrice, currency: q.currency,
      asOf: new Date(typeof time === 'number' ? time * 1000 : time), marketState: q.marketState });
  }
  return result;
}
// Snapshot version + serializable execution prevent a stale poll from selling a changed position.
export async function processAutoPosition(db: PrismaClient, p: Position, q: AutomationQuote | undefined) {
  if (!p.autoExit || !usableAutomationQuote(q, p.type)) return;
  const decision = exitDecision(p, q!.price);
  if (decision.reason) {
    const fx = p.type === 'CRYPTO' ? await getUsdTryRate() : undefined;
    await executeTrade(db, p.userId, tradeSchema.parse({ symbol: p.symbol, name: p.name, type: 'SELL', marketType: p.type,
      quantity: p.quantity, requestId: `auto:${p.id}:${p.updatedAt.getTime()}` }), q!.price, fx,
    { positionId: p.id, updatedAt: p.updatedAt, reason: decision.reason });
  } else if (p.trailingStopPercent && decision.high !== p.trailingStopHighest) {
    await db.position.updateMany({ where: { id: p.id, status: 'OPEN', autoExit: true, updatedAt: p.updatedAt },
      data: { trailingStopHighest: decision.high, stopLoss: decision.stop, currentPrice: q!.price } });
  }
}
async function notifyTrailingPosition(db: PrismaClient, p: Position, q: AutomationQuote | undefined) {
  if (!p.trailingStopPercent || !usableAutomationQuote(q, p.type)) return;
  const decision = exitDecision(p, q!.price);
  const previousStop = Math.max(p.stopLoss ?? 0, (p.trailingStopHighest ?? p.entryPrice) * (1 - p.trailingStopPercent / 100));
  await db.$transaction(async tx => {
    const updated = await tx.position.updateMany({ where: { id: p.id, status: 'OPEN', autoExit: false, updatedAt: p.updatedAt },
      data: { trailingStopHighest: decision.high, stopLoss: decision.stop, currentPrice: q!.price } });
    if (updated.count && decision.stop && q!.price <= decision.stop && p.currentPrice > previousStop) {
      await tx.appNotification.create({ data: { userId: p.userId, eventKey: `trailing:${p.id}:${p.updatedAt.getTime()}`, title: 'İz süren stop uyarısı',
        body: `${p.symbol}: stop seviyesine ulaşıldı. Otomatik satış kapalı; pozisyon satılmadı.`, url: '/portfolio' } });
    }
  });
}
export async function runAutomationCycle(db: PrismaClient) {
  const positions = await db.position.findMany({ where: { status: 'OPEN', OR: [{ autoExit: true }, { trailingStopPercent: { not: null } }] } });
  const alerts = await db.priceAlert.findMany({ where: { active: true, triggered: false } });
  const quotes = await automationQuotes([...positions, ...alerts].map(p => normalizeMarketSymbol(p.symbol)));
  let failures = 0;
  for (const p of positions) {
    try {
      const quote = quotes.get(normalizeMarketSymbol(p.symbol));
      if (p.autoExit) await processAutoPosition(db, p, quote);
      else await notifyTrailingPosition(db, p, quote);
    }
    catch (error) { if (!(error instanceof TradeError && error.status === 409)) failures++; }
  }
  for (const alert of alerts) {
    const q = quotes.get(normalizeMarketSymbol(alert.symbol));
    if (!usableAutomationQuote(q, normalizeMarketSymbol(alert.symbol).endsWith('-USD') ? 'CRYPTO' : 'BIST')) continue;
    if (!((alert.condition === 'above' && q!.price >= alert.targetPrice) || (alert.condition === 'below' && q!.price <= alert.targetPrice))) continue;
    await db.$transaction(async tx => {
      const claimed = await tx.priceAlert.updateMany({ where: { id: alert.id, active: true, triggered: false },
        data: { active: false, triggered: true, currentPrice: q!.price, triggeredAt: new Date() } });
      if (claimed.count) await tx.appNotification.create({ data: { userId: alert.userId, eventKey: `alert:${alert.id}:${alert.createdAt.getTime()}`,
        title: 'Fiyat alarmı', body: `${alert.symbol}: ${q!.price.toFixed(2)} ${q!.currency}. Hedef seviyenize ulaşıldı.`, url: '/alerts' } });
    });
  }
  await db.scanCache.upsert({ where: { id: 'automation-heartbeat' }, create: { id: 'automation-heartbeat', data: JSON.stringify({ failures }) }, update: { data: JSON.stringify({ failures }) } });
}

export async function automationStatus(db: PrismaClient) {
  const state = await db.scanCache.findUnique({ where: { id: 'automation-heartbeat' } });
  return { active: !!state && Date.now() - state.updatedAt.getTime() < 120_000, lastCheck: state?.updatedAt ?? null };
}
