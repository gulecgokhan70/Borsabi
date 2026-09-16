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
it('attaches the chosen source time without confusing a previous close with the current quote timestamp', async () => {
  const date = new Date('2026-09-11T12:00:00Z');
  vi.mocked(getMidasStock).mockResolvedValue({ Last: 0, Close: 100, DateTime: date.getTime() } as any);
  expect(await (await request('THYAO.IS')).json()).toMatchObject({ priceSource: 'Midas', priceAsOf: null, marketOpen: null });
  vi.mocked(cachedQuote).mockResolvedValue({ regularMarketPrice: 500, regularMarketTime: date, marketState: 'CLOSED' } as any);
  expect(await (await request('BTC-USD')).json()).toMatchObject({ priceSource: 'Yahoo Finance', priceAsOf: date.toISOString(), marketOpen: false, checkedAt: expect.any(String) });
});
it('labels the historical fallback timestamp as a candle time', async () => {
  const date = new Date('2026-09-11T12:00:00Z');
  vi.mocked(cachedQuote).mockRejectedValue(new Error('Unavailable'));
  vi.mocked(cachedChart).mockResolvedValue({ quotes: [{ date, open: 100, high: 100, low: 100, close: 100 }] } as any);
  expect(await (await request('BTC-USD')).json()).toMatchObject({ price: 100, priceAsOf: date.toISOString(), priceTimeKind: 'candle' });
});
it('computes EMA200 from prior sessions before cropping the visible day', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00Z'));
  try {
    const quotes = Array.from({ length: 250 }, (_, i) => ({ date: new Date(Date.parse('2026-09-15T00:00:00Z') + i * 300000), open: 100, high: 101, low: 99, close: 100, volume: 10 }));
    quotes.push({ date: new Date('2026-09-16T10:00:00Z'), open: 100, high: 101, low: 99, close: 100, volume: 10 });
    vi.mocked(cachedChart).mockResolvedValue({ quotes } as any);
    const res = await GET(new NextRequest('http://localhost/api/stock/THYAO.IS?period=1d&interval=5m'), { params: Promise.resolve({ symbol: 'THYAO.IS' }) });
    const result = await res.json();
    expect(result.ohlc).toHaveLength(1);
    expect(result.ohlc[0].ema200).toBeCloseTo(100, 8);
    expect(result.ohlc[0]).toMatchObject({ ema20: 100, macd: 0, bbMiddle: 100 });
    expect(new Date(vi.mocked(cachedChart).mock.calls[0][1].period1).getTime()).toBeLessThan(Date.parse('2026-09-14T00:00:00Z'));
  } finally { vi.useRealTimers(); }
});
