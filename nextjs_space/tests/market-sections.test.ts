import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/yahoo-finance', () => ({ cachedQuoteBatch: vi.fn(), cachedChart: vi.fn() }));
vi.mock('../lib/midas-api', () => ({ getMidasStockMap: vi.fn() }));
import { cachedQuoteBatch, cachedChart } from '../lib/yahoo-finance';
import { getMidasStockMap } from '../lib/midas-api';
import { GET } from '../app/api/piyasalar/route';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cachedQuoteBatch).mockImplementation(async symbols => new Map(symbols.map(symbol => [symbol, { regularMarketPrice: 100 }])));
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map());
  vi.mocked(cachedChart).mockResolvedValue({ quotes: [{ close: 10 }, { close: 20 }] });
});
const request = (query: string) => new Request(`https://borsabi.com/api/piyasalar?${query}`);
it('loads only six currencies without stocks, crypto or chart history', async () => {
  const response = await GET(request('group=currencies'));
  const body = await response.json();
  expect(body.currencies).toHaveLength(6);
  expect(body).not.toHaveProperty('crypto');
  expect(cachedQuoteBatch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(cachedQuoteBatch).mock.calls[0][0]).toHaveLength(6);
  expect(getMidasStockMap).not.toHaveBeenCalled();
  expect(cachedChart).not.toHaveBeenCalled();
});
it('serves index prices without waiting for history; fetches history only explicitly', async () => {
  const response = await GET(request('group=indices'));
  expect((await response.json()).indices[0].price).toBe(100);
  expect(cachedChart).not.toHaveBeenCalled();
  const full = await GET(request('group=indices&history=1'));
  expect((await full.json()).indices[0].sparkline).toEqual([10, 20]);
});
it('keeps the required USD/TRY conversion for commodities and requests Brent correctly', async () => {
  const response = await GET(request('group=commodities'));
  expect((await response.json()).commodities.some((c: any) => c.symbol === 'GRAM-ALTIN')).toBe(true);
  expect(cachedQuoteBatch).toHaveBeenCalledWith(['USDTRY=X']);
  expect(vi.mocked(cachedQuoteBatch).mock.calls.flat(2)).toContain('BZ=F');
});
it('rejects unknown groups and does not publish missing quotes as zero prices', async () => {
  expect((await GET(request('group=bad'))).status).toBe(400);
  expect(cachedQuoteBatch).not.toHaveBeenCalled();
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map());
  expect((await GET(request('group=currencies'))).status).toBe(503);
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['USDTRY=X', { regularMarketPrice: 50 }]]));
  expect(await (await GET(request('group=currencies'))).json()).toMatchObject({ currencies: [{ symbol: 'USDTRY=X', price: 50 }], unavailable: 5 });
});
it('retains source times for BIST and indices without guessing session state from Midas prices', async () => {
  const time = Date.parse('2026-09-20T12:00:00Z');
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map([['THYAO', { Last: 100, DateTime: time } as any]]));
  const bist = await (await GET(request('group=bistStocks'))).json();
  expect(bist.bistStocks[0]).toMatchObject({ priceAsOf: new Date(time).toISOString(), priceSource: 'Midas', marketOpen: null });
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['XU100.IS', { regularMarketPrice: 100, regularMarketTime: new Date(time), marketState: 'CLOSED' }]]));
  const indices = await (await GET(request('group=indices'))).json();
  expect(indices.indices[0]).toMatchObject({ priceAsOf: new Date(time).toISOString(), priceSource: 'Yahoo Finance', marketOpen: false });
});
