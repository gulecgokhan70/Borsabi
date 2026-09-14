import { isIndexSymbol } from './constants';

export type TradeMarketType = 'BIST' | 'CRYPTO';

// Quote prices keep their native currency; account totals are converted separately.
export function assetCurrency(symbol: string, reportedCurrency?: string | null): string {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('-USD')) return 'USD';
  if (normalized.endsWith('.IS')) return 'TRY';
  return reportedCurrency || 'TRY';
}

export function tradableMarketType(symbol: string): TradeMarketType | null {
  const normalized = symbol.toUpperCase();
  if (isIndexSymbol(normalized)) return null;
  if (normalized.endsWith('-USD')) return 'CRYPTO';
  if (normalized.endsWith('.IS')) return 'BIST';
  return null;
}
