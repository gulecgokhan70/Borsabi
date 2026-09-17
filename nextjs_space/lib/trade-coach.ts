import type { Transaction } from '@prisma/client';
export function tradeCoachFacts(t: Transaction) {
  const currency = t.marketType === 'CRYPTO' ? 'USD' : 'TRY';
  const plannedRisk = t.type === 'BUY' && t.stopLoss != null && t.fxRate != null
    ? Math.max(0, t.price - t.stopLoss) * t.quantity * t.fxRate : null;
  return { symbol: t.symbol, side: t.type, executedAt: t.createdAt.toISOString(), quantity: t.quantity, price: t.price, currency,
    totalTry: t.total, commissionTry: t.commission, cashChangeTry: t.type === 'BUY' ? -(t.total + t.commission) : t.total - t.commission,
    fxRate: t.fxRate, fxAsOf: t.fxAsOf?.toISOString() ?? null, pnlTry: t.pnl, pricePnlTry: t.pricePnlTry ?? null, fxPnlTry: t.fxPnlTry ?? null,
    buyCommissionTry: t.buyCommissionTry ?? null, plannedRiskTry: plannedRisk, reason: t.executionReason ?? null };
}
