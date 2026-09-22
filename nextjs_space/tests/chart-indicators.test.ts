import { expect, it } from 'vitest';
import { ema, sma, rsiSeries, enrichCandles, chartHistoryStart, fourHourCandles, type Candle } from '../lib/chart-indicators';
const candles = (count: number): Candle[] => Array.from({ length: count }, (_, i) => ({ time: i * 300, date: new Date(i * 300000).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 10 }));
it('seeds EMA with an SMA and does not invent early values', () => {
  expect(ema([1, 2, 3, 4], 3)).toEqual([undefined, undefined, 2, 3]);
  const rows = enrichCandles(candles(200));
  expect(rows[198].ema200).toBeUndefined(); expect(rows[199].ema200).toBe(100);
  expect(rows[18].bbMiddle).toBeUndefined(); expect(rows[19].bbUpper).toBe(100);
  expect(rows[32].macdSignal).toBeUndefined(); expect(rows[33].macdSignal).toBe(0);
  expect(rows[199].macdHistogram).toBe(0);
});
it('preserves warmed indicators when only the final five candles are visible', () => {
  const visible = enrichCandles(candles(250)).slice(-5);
  for (const c of visible) { expect(c.ema200).toBeCloseTo(100, 8); expect(c.sma200).toBe(100); expect(c.rsi).toBe(50); expect(c.macd).toBeCloseTo(0, 8); expect(c.bbLower).toBe(100); }
});
it('distinguishes simple averages from exponential weighting', () => {
  expect(sma([1, 2, 4, 10], 3)).toEqual([undefined, undefined, 7 / 3, 16 / 3]);
  expect(ema([1, 2, 4, 10], 3)[3]).toBeCloseTo(37 / 6);
  expect(enrichCandles(candles(199))[198].sma200).toBeUndefined();
});
it('uses Wilder smoothing for RSI and handles flat, rising and falling series', () => {
  expect(rsiSeries([10, 12, 11, 14], 2).slice(0, 2)).toEqual([undefined, undefined]);
  expect(rsiSeries([10, 12, 11, 14], 2)[2]).toBeCloseTo(100 * 2 / 3);
  expect(rsiSeries([10, 12, 11, 14], 2)[3]).toBeCloseTo(100 * 8 / 9);
  expect(rsiSeries([1, 1, 1], 2)[2]).toBe(50);
  expect(rsiSeries([1, 2, 3], 2)[2]).toBe(100);
  expect(rsiSeries([3, 2, 1], 2)[2]).toBe(0);
});
it('keeps intraday warmup inside provider retention', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const month = new Date('2026-08-16T12:00:00Z');
  expect(chartHistoryStart(month, now, '15m').getTime()).toBe(now.getTime() - 59 * 86400000);
  expect(chartHistoryStart(month, now, '1d').getTime()).toBeLessThan(month.getTime() - 200 * 86400000);
});
it('aggregates real hourly prices and volume without crossing day boundaries', () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ time: Date.parse(`2026-09-16T${String(i + 6).padStart(2, '0')}:00:00Z`) / 1000,
    date: `2026-09-16T${String(i + 6).padStart(2, '0')}:00:00Z`, open: 100 + i, close: 101 + i, high: 102 + i, low: 99 + i, volume: 10 }));
  const result = fourHourCandles(rows);
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ open: 100, close: 104, high: 105, low: 99, volume: 40 });
  expect(result[1].volume).toBe(10);
});
