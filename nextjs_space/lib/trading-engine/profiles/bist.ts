import { DAILY_LOSS_LIMIT, MAX_RISK_PER_TRADE } from '../../constants';
import type { TradingProfile } from '../types';

export const BIST_PROFILE: TradingProfile = Object.freeze({
  marketType: 'BIST',
  timeframe: '1d',
  sessionBased: true,
  timeZone: 'Europe/Istanbul',
  allowShort: false,
  minimumCandles: 200,
  regime: Object.freeze({
    trendAdx: 25, rangeAdx: 20,
    highAtrPercent: 5, lowAtrPercent: 0.5,
    lowBandwidthPercent: 2, rangeMiddleFraction: 0.25,
  }),
  risk: Object.freeze({
    maxRiskPerTrade: MAX_RISK_PER_TRADE,
    dailyLossLimit: DAILY_LOSS_LIMIT,
    atrStopMultiplier: 2,
    highVolatilityRiskMultiplier: 0.5,
  }),
});
