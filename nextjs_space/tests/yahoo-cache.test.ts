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
