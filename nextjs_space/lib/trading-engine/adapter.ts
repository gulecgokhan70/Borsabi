import type { CandleData, MarketType, Timeframe } from './types';
export interface ProviderCandle {
  date: Date | string | number; open?: number | null; high?: number | null;
  low?: number | null; close?: number | null; volume?: number | null;
}
export const intervalMs = (timeframe: Timeframe) => timeframe === '1d' ? 86400000 : timeframe === '1h' ? 3600000 : 900000;
/** Numbers are provider epoch seconds; Date/string values are explicit date stamps. */
export function providerCandles(rows: readonly ProviderCandle[], market: MarketType, timeframe: Timeframe): CandleData[] {
  return rows.flatMap(row => {
    const raw = typeof row.date === 'number' ? row.date * 1000 : new Date(row.date).getTime();
    const local = new Date(raw + (market === 'BIST' ? 3 * 3600000 : 0));
    const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
    const empty = [row.open, row.high, row.low, row.close, row.volume].every(v => v === null);
    if (market === 'BIST' && timeframe !== '1d' && empty
      && (local.getUTCDay() === 0 || local.getUTCDay() === 6 || minute < 600 || minute >= 1080)) return [];
    // Daily provider timestamps label the date, not the final closing-auction time.
    // Make daily data available at next local midnight, conservatively after all sessions.
    const timestamp = timeframe === '1d'
      ? Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - (market === 'BIST' ? 3 * 3600000 : 0)
      : raw;
    return [{ timestamp, closedAt: timestamp + intervalMs(timeframe),
      open: row.open ?? NaN, high: row.high ?? NaN, low: row.low ?? NaN,
      close: row.close ?? NaN, volume: row.volume ?? NaN }];
  });
}

export function sessionOpen(timestamp: number, market: MarketType, holidays: readonly string[] = []): boolean {
  if (!Number.isFinite(timestamp)) return false;
  if (market === 'CRYPTO') return true;
  const local = new Date(timestamp + 3 * 3600000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return local.getUTCDay() > 0 && local.getUTCDay() < 6 && minute >= 600 && minute < 1080
    && !holidays.includes(local.toISOString().slice(0, 10));
}
