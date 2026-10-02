import { BIST_ALL_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import type { Market } from './engine';

// This is the application's supported catalogue, not a claim of exchange-wide coverage.
export const botCatalog: Record<Market, string[]> = {
  BIST: [...new Set(BIST_ALL_STOCKS.map(asset => asset.symbol))],
  CRYPTO: [...new Set(CRYPTO_ASSETS.map(asset => asset.symbol))],
};
export const assetHref = (symbol: string) => `/stock/${encodeURIComponent(symbol)}`;
export const assetLabel = (symbol: string) => symbol.replace(/\.IS$/, '').replace(/-USD$/, '');

export type ScanProgress = {
  total: number; processed: number; batchSize: number; cycleStartedAt: number;
  cycleCompletedAt: number | null; checkedAt: number;
};
