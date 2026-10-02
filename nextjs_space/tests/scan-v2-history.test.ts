import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/yahoo-finance', () => ({ cachedChart: vi.fn(), cachedQuote: vi.fn() }));
vi.mock('../lib/trading-engine/service', () => ({ engineHistory: vi.fn() }));
import { cachedChart, cachedQuote } from '../lib/yahoo-finance';
import { engineHistory } from '../lib/trading-engine/service';
import { fetchStockData } from '../lib/scan-utils';
const start = Date.UTC(2024, 0, 1);
const candles = Array.from({ length: 220 }, (_, n) => ({ timestamp: start + n * 86400000, closedAt: start + (n + 1) * 86400000,
  open: 100 + n * 0.1, close: 100 + n * 0.1, high: 102 + n * 0.1, low: 98 + n * 0.1, volume: 100 }));
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(engineHistory).mockResolvedValue(candles);
  vi.mocked(cachedQuote).mockResolvedValue({ regularMarketPrice: 999, regularMarketVolume: 100000 } as any);
});
it('uses one normalized engine history, keeping live quotes separate from closed indicators', async () => {
  const result = await fetchStockData('THYAO', 'THYAO.IS', null, { period1: 0, period2: 1, interval: '1d' }, { timeframe: '1d', asOf: candles[219].closedAt });
  expect(cachedChart).not.toHaveBeenCalled();
  expect(engineHistory).toHaveBeenCalledTimes(1);
  expect(result?.price).toBe(999);
  expect(result?.engine?.analysis.indicators?.close).toBe(candles[219].close);
});
it('rejects insufficient and invalid candle histories before dropping rows or fetching a quote', async () => {
  for (const data of [candles.slice(0, 50), candles.map((c, n) => n === 210 ? { ...c, close: -1 } : c)]) {
    vi.mocked(engineHistory).mockResolvedValue(data);
    expect(await fetchStockData('THYAO', 'THYAO.IS', null, { period1: 0, period2: 1, interval: '1d' }, { timeframe: '1d', asOf: candles[219].closedAt })).toBeNull();
  }
  expect(cachedQuote).not.toHaveBeenCalled();
});
