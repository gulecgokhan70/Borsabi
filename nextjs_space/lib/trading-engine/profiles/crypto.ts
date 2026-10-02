import { DAILY_LOSS_LIMIT, MAX_RISK_PER_TRADE } from '../../constants';
import type { TradingProfile } from '../types';

export const CRYPTO_PROFILE: TradingProfile = Object.freeze({
  marketType: 'CRYPTO',
  timeframe: '1d',
  sessionBased: false,
  timeZone: 'UTC',
  allowShort: false,
  minimumCandles: 200,
  regime: Object.freeze({
    trendAdx: 25, rangeAdx: 20,
    highAtrPercent: 8, lowAtrPercent: 0.8,
    lowBandwidthPercent: 3, rangeMiddleFraction: 0.25,
  }),
  risk: Object.freeze({
    maxRiskPerTrade: MAX_RISK_PER_TRADE / 2,
    dailyLossLimit: DAILY_LOSS_LIMIT,
    atrStopMultiplier: 3,
    highVolatilityRiskMultiplier: 0.25,
  }),
});
