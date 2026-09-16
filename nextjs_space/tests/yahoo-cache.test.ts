import { expect, it, vi } from 'vitest';
const upstream = vi.hoisted(() => ({ quote: vi.fn(async (symbol: string) => ({ symbol, regularMarketPrice: 100 })), chart: vi.fn(async (_symbol: string, opts: any) => ({ opts, quotes: [] })) }));
vi.mock('yahoo-finance2', () => ({ default: class { quote = upstream.quote; chart = upstream.chart; } }));
import { cachedQuote, cachedQuoteBatch, cachedChart } from '../lib/yahoo-finance';
it('shares one provider call between twenty direct and batched quote requests', async () => {
  const direct = Array.from({ length: 20 }, () => cachedQuote('BTC-USD'));
  const batch = cachedQuoteBatch(['BTC-USD', 'BTC-USD']);
  const quotes = await Promise.all(direct);
  expect((await batch).get('BTC-USD')).toEqual(quotes[0]);
  expect(upstream.quote).toHaveBeenCalledTimes(1);
});
it('shares identical chart options but separates requests with different adjustment flags', async () => {
  const a = { period1: '2026-08-01', interval: '1d', return: 'array' };
  await Promise.all([cachedChart('THYAO.IS', a), cachedChart('THYAO.IS', { return: 'array', interval: '1d', period1: '2026-08-01' }), cachedChart('THYAO.IS', { ...a, includeAdjustedClose: false })]);
  expect(upstream.chart).toHaveBeenCalledTimes(2);
});
it('combines different simultaneous symbols into a single quote request', async () => {
  const before = upstream.quote.mock.calls.length;
  upstream.quote.mockImplementationOnce(async (symbols: any) => Object.fromEntries(symbols.map((symbol: string) => [symbol, { symbol, regularMarketPrice: 42 }] )) as any);
  const result = await cachedQuoteBatch(['USDTRY=X', 'EURTRY=X', 'GBPTRY=X', 'JPYTRY=X', 'CHFTRY=X', 'EURUSD=X']);
  expect(upstream.quote.mock.calls.length - before).toBe(1);
  expect(result.size).toBe(6);
  expect(result.get('USDTRY=X').regularMarketPrice).toBe(42);
});
it('allows quote prices to complete while chart history remains stalled', async () => {
  let release!: () => void;
  upstream.chart.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ quotes: [], opts: {} }); }));
  const history = cachedChart('SLOW.IS', { period1: '2026-01-01', interval: '1d' });
  const quote = await cachedQuote('FAST-USD');
  expect(quote.regularMarketPrice).toBe(100);
  release(); await history;
});
it('does not let an omitted symbol discard successful members of a quote batch', async () => {
  upstream.quote.mockImplementationOnce(async () => ({ 'OK-USD': { symbol: 'OK-USD', regularMarketPrice: 9 } }) as any);
  const result = await cachedQuoteBatch(['OK-USD', 'MISSING-USD']);
  expect(result.get('OK-USD').regularMarketPrice).toBe(9);
  expect(result.get('MISSING-USD')).toBeNull();
});
