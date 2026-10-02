import type { AccountRisk, Costs, SignalResult, TradePlan, TradingProfile } from './types';
export function planTrade(entry: number, atr: number, signal: SignalResult, account: AccountRisk,
  profile: TradingProfile, costs: Costs, stopMultiplier = profile.risk.atrStopMultiplier, rewardRatio = 2): TradePlan {
  const rejected = (reason: string): TradePlan => ({ allowed: false, direction: 'NONE', entry, stopLoss: 0,
    takeProfit: 0, quantity: 0, riskAmount: 0, riskReward: 0, cost: 0, reasons: [reason] });
  if (![entry, atr, stopMultiplier, rewardRatio, ...Object.values(account), ...Object.values(costs)].every(Number.isFinite)
    || entry <= 0 || atr <= 0 || stopMultiplier <= 0 || rewardRatio < 1.5
    || Object.values(costs).some(v => v < 0 || v > 0.05) || Object.values(account).some(v => v < 0)
    || account.equity <= 0 || account.dayStartEquity <= 0) return rejected('Risk veya fiyat girdileri geçersiz.');
  if (!Number.isFinite(signal.score) || !Number.isFinite(signal.confidence) || signal.score > 100 || signal.confidence > 1
    || !['LONG', 'SHORT'].includes(signal.direction) || signal.score < 65 || signal.confidence < 0.6) return rejected('Sinyal eşiği veya güven koşulu sağlanmadı.');
  if (signal.direction === 'SHORT' && !profile.allowShort) return rejected('Short desteği kapalı.');
  if (account.dailyLoss / account.dayStartEquity >= profile.risk.dailyLossLimit) return rejected('Günlük zarar limiti doldu.');
  if (account.consecutiveLosses >= 3) return rejected('Ardışık zarar sınırı doldu.');
  if (account.correlatedExposure >= account.equity * 0.3) return rejected('Korelasyon grubu riski yüksek.');
  const sign = signal.direction === 'SHORT' ? -1 : 1;
  const friction = costs.slippage + costs.spread / 2;
  const filledEntry = entry * (1 + sign * friction);
  const distance = atr * stopMultiplier;
  const stopLoss = filledEntry - sign * distance;
  const takeProfit = filledEntry + sign * distance * rewardRatio;
  if (stopLoss <= 0 || takeProfit <= 0) return rejected('ATR stop/hedef seviyesi fiyatla uyumsuz.');
  const riskPerUnit = distance + (filledEntry + stopLoss) * costs.commission + stopLoss * friction;
  const riskBudget = account.equity * profile.risk.maxRiskPerTrade
    * (signal.regime === 'HIGH_VOLATILITY' ? profile.risk.highVolatilityRiskMultiplier : 1);
  const limit = Math.max(0, Math.min(account.cash, account.orderLimit,
    account.equity * (profile.marketType === 'CRYPTO' ? 0.15 : 0.25),
    account.allocationLimit - account.exposure, account.equity * 0.6 - account.exposure));
  const unitCost = filledEntry * (1 + costs.commission);
  const raw = Math.min(riskBudget / riskPerUnit, limit / unitCost);
  const step = profile.marketType === 'BIST' ? 1 : 1e-8;
  const quantity = Math.floor(raw / step) * step;
  if (!Number.isFinite(quantity) || quantity <= 0) return rejected('Risk veya nakit bütçesi bir birim için yeterli değil.');
  const netReward = distance * rewardRatio - (filledEntry + takeProfit) * costs.commission - takeProfit * friction;
  const riskReward = netReward / riskPerUnit;
  if (riskReward < 1.5) return rejected('Maliyetler sonrası risk/ödül oranı 1.5 altında.');
  return { allowed: true, direction: signal.direction, entry: filledEntry, stopLoss, takeProfit,
    quantity, riskAmount: quantity * riskPerUnit, riskReward, cost: quantity * unitCost,
    reasons: ['ATR stop, komisyon/fiyat kayması ve portföy bütçesi birlikte kontrol edildi.'] };
}
