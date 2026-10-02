import { BIST_PROFILE } from './profiles/bist';
import { CRYPTO_PROFILE } from './profiles/crypto';
import type { MarketType, TradingProfile } from './types';

export const TRADING_PROFILES: Readonly<Record<MarketType, TradingProfile>> = Object.freeze({
  BIST: BIST_PROFILE,
  CRYPTO: CRYPTO_PROFILE,
});

export function getTradingProfile(marketType: MarketType): TradingProfile {
  // HTTP input can bypass compile-time types: never silently select BIST.
  if (marketType !== 'BIST' && marketType !== 'CRYPTO') {
    throw new RangeError('Unsupported market type');
  }
  return TRADING_PROFILES[marketType];
}
