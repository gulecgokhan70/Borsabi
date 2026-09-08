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
