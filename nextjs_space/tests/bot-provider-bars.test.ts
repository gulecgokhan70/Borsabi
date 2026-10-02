import { expect, it } from 'vitest';
import { providerBars } from '../lib/bot-lab/provider-bars';
import { INTERVAL, rankObservation } from '../lib/bot-lab/auto-engine';
const empty = (date: string) => ({ date: new Date(date), open: null, high: null, low: null, close: null, volume: null });
// Reproduces the fully null 09:30 Turkey rows observed for A1CAP and A1YEN.
const now = Date.parse('2026-09-25T13:15:00Z');
const rows = () => [23, 24, 25].flatMap(day => [empty(`2026-09-${day}T06:30:00Z`), ...Array.from({ length: day === 25 ? 25 : 32 }, (_, i) => ({
  date: new Date(Date.parse(`2026-09-${day}T07:00:00Z`) + i * INTERVAL), open: 100, high: 100, low: 100, close: 100, volume: 1000,
}))]);
const rank = (bars: ReturnType<typeof providerBars>) => rankObservation({ symbol: 'A1CAP.IS', bars, tick: { time: now, price: 100, open: true } }, 'BIST', now);
it('removes only fully empty off-session placeholders and restores evaluation of valid BIST history', () => {
  const bars = providerBars(rows(), 'BIST');
  expect(bars).toHaveLength(89);
  expect(rank(bars).barTime).toBe(now);
  expect(rank(bars).reason).toBe('Yükseliş eğilimi koşulu yok.');
});
it('keeps missing in-session price or volume invalid and never fills it with zero', () => {
  for (const field of ['close', 'volume'] as const) {
    const input = rows(); input.at(-2)![field] = null;
    const bars = providerBars(input, 'BIST');
    expect(Number.isNaN(bars.at(-2)![field])).toBe(true);
    expect(rank(bars).reason).toMatch(/geçersiz/);
  }
  const input = rows(); input[input.length - 2] = empty('2026-09-25T12:45:00Z');
  expect(rank(providerBars(input, 'BIST')).reason).toMatch(/geçersiz/);
});
it('preserves real zero-volume bars and rejects duplicates, gaps and partial off-session corruption', () => {
  const input = rows(); input.at(-1)!.volume = 0;
  expect(providerBars(input, 'BIST').at(-1)?.volume).toBe(0);
  expect(rank(providerBars([...input, input.at(-1)!], 'BIST')).reason).toMatch(/geçersiz/);
  input.splice(input.length - 2, 1);
  expect(rank(providerBars(input, 'BIST')).reason).toMatch(/kesintisiz değil/);
  const partial = rows(); partial[0].volume = 0;
  expect(rank(providerBars(partial, 'BIST')).reason).toMatch(/geçersiz/);
});
it('does not discard crypto gaps or let an unfinished candle become closed', () => {
  expect(providerBars([empty('2026-09-25T06:30:00Z')], 'CRYPTO')).toHaveLength(1);
  const input = rows(); input.push({ date: new Date(now), open: 100, high: 120, low: 100, close: 120, volume: 10000 });
  expect(rank(providerBars(input, 'BIST')).barTime).toBe(now);
  expect(rank(providerBars(input, 'BIST')).eligible).toBe(false);
});
