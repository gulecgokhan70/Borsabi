import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/midas-api', () => ({ getMidasStockMap: vi.fn() }));
vi.mock('../lib/yahoo-finance', () => ({ cachedQuoteBatch: vi.fn() }));
import { getMidasStockMap } from '../lib/midas-api';
import { cachedQuoteBatch } from '../lib/yahoo-finance';
import { getMarketQuotes } from '../lib/market-quotes';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map());
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map());
});
it('falls back per missing BIST symbol when Midas has other stocks', async () => {
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map([['THYAO', { Last: 100 } as any]]));
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['AKBNK.IS', { regularMarketPrice: 50 }]]));
  const quotes = await getMarketQuotes(['THYAO.IS', 'AKBNK.IS']);
  expect(cachedQuoteBatch).toHaveBeenCalledWith(['AKBNK.IS']);
  expect(quotes.map(q => q.price)).toEqual([100, 50]);
});
it('falls back when Midas has a record without a valid price', async () => {
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map([['THYAO', { Last: -1, Close: 0 } as any]]));
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['THYAO.IS', { regularMarketPrice: 99 }]]));
  expect((await getMarketQuotes(['THYAO.IS']))[0].price).toBe(99);
});
it('normalizes bare BIST symbols and deduplicates them', async () => {
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['THYAO.IS', { regularMarketPrice: 100 }]]));
  const quotes = await getMarketQuotes(['thyao', 'THYAO.IS']);
  expect(quotes).toHaveLength(1);
  expect(quotes[0].symbol).toBe('THYAO.IS');
});
it('never uses a Midas quote for indices', async () => {
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['XU500.IS', { regularMarketPrice: 9000 }]]));
  expect((await getMarketQuotes(['XU500.IS']))[0].price).toBe(9000);
  expect(getMidasStockMap).not.toHaveBeenCalled();
});
it('marks unavailable quotes as errors', async () => {
  expect((await getMarketQuotes(['BTC-USD']))[0]).toMatchObject({ price: 0, error: true });
});
it('does not infer an open market from a populated price or daily volume', async () => {
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map([['THYAO', { Last: 100, TotalVolume: 5000 } as any]]));
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['AKBNK.IS', { regularMarketPrice: 50, marketState: 'CLOSED' }]]));
  const quotes = await getMarketQuotes(['THYAO.IS', 'AKBNK.IS']);
  expect(quotes.map(q => q.marketOpen)).toEqual([null, false]);
});
it('propagates provider timestamps and never timestamps previous-close fallbacks with the fetch time', async () => {
  const time = Date.parse('2026-09-20T12:00:00Z');
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map([
    ['THYAO', { Last: 100, DateTime: time } as any], ['TUPRS', { Last: 0, PreviousClose: 200, DateTime: time } as any],
  ]));
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([
    ['AKBNK.IS', { regularMarketPrice: 50, regularMarketTime: new Date(time) }],
    ['GARAN.IS', { regularMarketPreviousClose: 40, regularMarketTime: new Date(time) }],
  ]));
  const rows = await getMarketQuotes(['THYAO.IS', 'TUPRS.IS', 'AKBNK.IS', 'GARAN.IS']);
  expect(rows.map(row => 'priceAsOf' in row ? row.priceAsOf : null)).toEqual([new Date(time).toISOString(), null, new Date(time).toISOString(), null]);
});
