import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/yahoo-finance', () => ({ cachedQuote: vi.fn() }));
import { cachedQuote } from '../lib/yahoo-finance';
import { getUsdTryRate, MAX_FX_AGE_MS } from '../lib/fx';
const now = new Date('2026-09-08T12:00:00Z');
const quote = { symbol: 'USDTRY=X', currency: 'TRY', regularMarketPrice: 32, regularMarketTime: now };
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); });
it('uses the server USD/TRY quote and preserves its timestamp', async () => {
  vi.mocked(cachedQuote).mockResolvedValue(quote);
  expect(await getUsdTryRate()).toEqual({ rate: 32, asOf: now });
  expect(cachedQuote).toHaveBeenCalledWith('USDTRY=X');
});
it('accepts a weekend quote, but rejects stale, missing, future or invalid data', async () => {
  vi.mocked(cachedQuote).mockResolvedValue({ ...quote, regularMarketTime: new Date(+now - 3 * 86400000) });
  expect((await getUsdTryRate()).rate).toBe(32);
  for (const override of [
    { regularMarketTime: new Date(+now - MAX_FX_AGE_MS - 1) },
    { regularMarketTime: new Date(+now + 6 * 60_000) }, { regularMarketTime: null },
    { regularMarketPrice: 0 }, { regularMarketPrice: Infinity }, { currency: 'USD' }, { symbol: 'TRYUSD=X' },
  ]) {
    vi.mocked(cachedQuote).mockResolvedValue({ ...quote, ...override });
    await expect(getUsdTryRate()).rejects.toThrow('USD/TL kuru alınamadı');
  }
});
it('does not turn provider failures into a 1:1 exchange rate', async () => {
  vi.mocked(cachedQuote).mockRejectedValue(new Error('provider connection detail'));
  await expect(getUsdTryRate()).rejects.toThrow('Güncel USD/TL kuru alınamadı');
});
