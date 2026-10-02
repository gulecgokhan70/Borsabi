import { z } from 'zod';
import { calculateEMA, calculateStochastic } from '../technical-indicators';
import { analyzeMarket } from './analyze';
import type { CandleData, EngineDecision, IndicatorSnapshot, SignalResult } from './types';

export const indicatorNames = ['price', 'ema10', 'ema20', 'ema50', 'ema200', 'rsi', 'macd', 'macdSignal',
  'stochK', 'stochD', 'adx', 'bollingerUpper', 'bollingerMiddle', 'bollingerLower', 'atr', 'volume', 'avgVolume'] as const;
export const ruleSchema = z.object({ id: z.number().int().nonnegative(), direction: z.enum(['buy', 'sell']),
  indicator: z.enum(indicatorNames), operator: z.enum(['gt', 'lt', 'cross_above', 'cross_below']),
  compareWith: z.enum(['value', 'indicator']), compareIndicator: z.enum(indicatorNames), value: z.number().finite().min(-1e12).max(1e12) }).strict();
export type CustomRule = z.infer<typeof ruleSchema>;
type Values = Partial<Record<typeof indicatorNames[number], number>>;

export function matchesRule(rule: CustomRule, current: Values, previous: Values): boolean {
  const a = current[rule.indicator], b = rule.compareWith === 'value' ? rule.value : current[rule.compareIndicator];
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (rule.operator === 'gt') return a > b;
  if (rule.operator === 'lt') return a < b;
  const pa = previous[rule.indicator], pb = rule.compareWith === 'value' ? rule.value : previous[rule.compareIndicator];
  if (typeof pa !== 'number' || typeof pb !== 'number' || !Number.isFinite(pa) || !Number.isFinite(pb)) return false;
  if (rule.operator === 'cross_above') return pa <= pb && a > b;
  if (rule.operator === 'cross_below') return pa >= pb && a < b;
  return false;
}
function values(candles: readonly CandleData[], snapshot: IndicatorSnapshot | null): Values {
  if (!snapshot || candles.length < 200) return {};
  const closes = candles.map(c => c.close), ema10 = calculateEMA(closes, 10);
  const stoch = calculateStochastic(closes, candles.map(c => c.high), candles.map(c => c.low));
  const average = candles.slice(-21, -1).reduce((sum, c) => sum + c.volume, 0) / 20;
  return { price: snapshot.close, ema10: ema10[ema10.length - 1], ema20: snapshot.ema20, ema50: snapshot.ema50,
    ema200: snapshot.ema200, rsi: snapshot.rsi, macd: snapshot.macd.macd, macdSignal: snapshot.macd.signal,
    stochK: stoch.k, stochD: stoch.d, adx: snapshot.adx, bollingerUpper: snapshot.bollinger.upper,
    bollingerMiddle: snapshot.bollinger.middle, bollingerLower: snapshot.bollinger.lower, atr: snapshot.atr,
    volume: candles[candles.length - 1].volume, avgVolume: average };
}
/** User rules may veto V2 entries, never override its context/freshness gates.
 * Sell rules request liquidation only; they do not open a short position. */
export function customRuleSignal(rules: readonly CustomRule[], past: readonly CandleData[], decision: EngineDecision): SignalResult {
  const signal = decision.signal;
  if (decision.analysis.status !== 'READY') return { ...signal, direction: 'NONE' };
  const current = values(past, decision.analysis.indicators);
  const before = past.slice(0, -1);
  const previous = values(before, analyzeMarket({ candles: before, marketType: decision.analysis.marketType,
    timeframe: decision.analysis.timeframe, asOf: decision.analysis.asOf }).indicators);
  const sells = rules.filter(r => r.direction === 'sell'), buys = rules.filter(r => r.direction === 'buy');
  if (sells.some(r => matchesRule(r, current, previous))) return { ...signal, direction: 'SHORT', reasons: ['Özel satış kuralı: mevcut pozisyonu kapat.'] };
  const allow = buys.length > 0 && buys.every(r => matchesRule(r, current, previous));
  return { ...signal, direction: allow ? signal.direction : 'NONE',
    reasons: [...signal.reasons, allow ? 'Özel alış kuralları sağlandı.' : 'Özel alış kuralları sağlanmadı.'] };
}
