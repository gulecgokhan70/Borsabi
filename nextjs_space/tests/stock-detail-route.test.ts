import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('../lib/yahoo-finance', () => ({ cachedQuote: vi.fn(), cachedChart: vi.fn() }));
vi.mock('../lib/midas-api', () => ({ getMidasStock: vi.fn() }));
import { cachedQuote, cachedChart } from '../lib/yahoo-finance';
import { getMidasStock } from '../lib/midas-api';
import { GET } from '../app/api/stock/[symbol]/route';

const request = (symbol: string) => GET(
  new NextRequest(`http://localhost/api/stock/${symbol}?period=1mo&interval=1d`),
  { params: Promise.resolve({ symbol }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(cachedChart).mockResolvedValue({ quotes: [] } as any);
  vi.mocked(cachedQuote).mockResolvedValue({ regularMarketPrice: 79315.5, currency: 'USD' } as any);
  vi.mocked(getMidasStock).mockResolvedValue(null);
});

it('returns the same native dollar quote used by the crypto list', async () => {
  expect(await (await request('BTC-USD')).json()).toMatchObject({ symbol: 'BTC-USD', price: 79315.5, currency: 'USD' });
  expect(getMidasStock).not.toHaveBeenCalled();
});

it('keeps USD metadata when only crypto chart data is available', async () => {
  vi.mocked(cachedQuote).mockRejectedValue(new Error('Quote unavailable'));
  vi.mocked(cachedChart).mockResolvedValue({ quotes: [{ date: new Date(), open: 79000, high: 80000, low: 78000, close: 79315.5, volume: 10 }] } as any);
  expect(await (await request('BTC-USD')).json()).toMatchObject({ price: 79315.5, currency: 'USD' });
});

it('does not label a crypto quote TRY when the provider omits currency', async () => {
  vi.mocked(cachedQuote).mockResolvedValue({ regularMarketPrice: 79315.5 } as any);
  expect(await (await request('BTC-USD')).json()).toMatchObject({ price: 79315.5, currency: 'USD' });
});

it('labels Midas prices TRY even if fallback metadata disagrees', async () => {
  vi.mocked(getMidasStock).mockResolvedValue({ Last: 315.5 } as any);
  expect(await (await request('THYAO.IS')).json()).toMatchObject({ price: 315.5, currency: 'TRY' });
});

it('preserves the native crypto unit in the partial-error response', async () => {
  vi.mocked(cachedQuote).mockResolvedValue({ get regularMarketPrice() { throw new Error('Invalid quote payload'); } } as any);
  expect(await (await request('BTC-USD')).json()).toMatchObject({ currency: 'USD', _partialError: expect.any(String) });
});
