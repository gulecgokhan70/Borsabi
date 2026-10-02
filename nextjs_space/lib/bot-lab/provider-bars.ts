import type { Market } from './engine';
import { INTERVAL, type Candle } from './auto-engine';

type ProviderBar = { date: Date | string | number; open?: number | null; high?: number | null;
  low?: number | null; close: number | null; volume: number | null };

// Yahoo includes wholly null 09:30 rows before BIST's continuous session. These
// are placeholders, not traded candles. Keep partial/invalid rows and in-session
// gaps for the strategy's strict validation; never replace missing data with zero.
export function providerBars(rows: ProviderBar[], market: Market): Candle[] {
  return rows.filter(b => {
    const start = new Date(b.date).getTime();
    if (market !== 'BIST' || !Number.isFinite(start)) return true;
    const local = new Date(start + 3 * 3600000);
    const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
    const outsideSession = local.getUTCDay() === 0 || local.getUTCDay() === 6 || minute < 600 || minute >= 1080;
    const empty = [b.open, b.high, b.low, b.close, b.volume].every(value => value === null);
    return !(outsideSession && empty);
  }).map(b => ({ time: new Date(b.date).getTime() + INTERVAL,
    close: b.close === null ? NaN : b.close, volume: b.volume === null ? NaN : b.volume }));
}
