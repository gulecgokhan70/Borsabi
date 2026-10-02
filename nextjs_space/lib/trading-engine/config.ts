import { BIST_PROFILE } from './profiles/bist';
import { CRYPTO_PROFILE } from './profiles/crypto';
import type { MarketType, TradingProfile, Timeframe, Costs } from './types';

export const TRADING_PROFILES: Readonly<Record<MarketType, TradingProfile>> = Object.freeze({
  BIST: BIST_PROFILE,
  CRYPTO: CRYPTO_PROFILE,
});

export function getTradingProfile(marketType: MarketType, timeframe: Timeframe = '1d'): TradingProfile {
  // HTTP input can bypass compile-time types: never silently select BIST.
  if (marketType !== 'BIST' && marketType !== 'CRYPTO') {
    throw new RangeError('Unsupported market type');
  }
  const base = TRADING_PROFILES[marketType];
  if (timeframe === '1d') return base;
  if (timeframe !== '15m' && timeframe !== '1h') throw new RangeError('Unsupported timeframe');
  const scale = Math.sqrt((timeframe === '15m' ? 15 : 60) / (marketType === 'BIST' ? 480 : 1440));
  return { ...base, timeframe, regime: { ...base.regime,
    highAtrPercent: base.regime.highAtrPercent * scale,
    lowAtrPercent: base.regime.lowAtrPercent * scale,
    lowBandwidthPercent: base.regime.lowBandwidthPercent * scale },
    risk: { ...base.risk, atrStopMultiplier: marketType === 'BIST' ? 1.5 : 2.5 } };
}

export const defaultCosts = (market: MarketType, commission: number): Costs => ({
  commission, slippage: market === 'BIST' ? 0.001 : 0.002,
  spread: market === 'BIST' ? 0.001 : 0.002,
});
export const SIGNAL_THRESHOLD = 65;
export const MIN_CONFIDENCE = 0.6;
