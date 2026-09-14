import { beforeEach, expect, it, vi } from 'vitest';
import type { Position } from '@prisma/client';
vi.mock('../lib/market-quotes', () => ({ getMarketQuotes: vi.fn(), normalizeMarketSymbol: (s: string) => s }));
vi.mock('../lib/fx', () => ({ getUsdTryRate: vi.fn() }));
import { getMarketQuotes } from '../lib/market-quotes';
import { getUsdTryRate } from '../lib/fx';
import { valuePositions } from '../lib/position-valuation';
const crypto = { symbol: 'BTC-USD', type: 'CRYPTO', quantity: 0.1, entryPrice: 100, entryPriceTry: 3000, currentPrice: 100, commission: 0.6 } as Position;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUsdTryRate).mockResolvedValue({ rate: 40, asOf: new Date() });
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'BTC-USD', price: 100, currency: 'USD' } as any]);
});
it('includes FX profit even when the asset dollar price is unchanged', async () => {
  const [value] = await valuePositions([crypto]);
  expect(value.currentPrice).toBe(100);
  expect(value.totalValue).toBe(400);
  expect(value.totalCost).toBeCloseTo(300.6);
  expect(value.pnl).toBeCloseTo(99.4);
});
it('values a mixed portfolio in a common TRY currency', async () => {
  vi.mocked(getMarketQuotes).mockResolvedValue([
    { symbol: 'BTC-USD', price: 100, currency: 'USD' },
    { symbol: 'THYAO.IS', price: 110, currency: 'TRY' },
  ] as any);
  const positions = await valuePositions([crypto, { ...crypto, symbol: 'THYAO.IS', type: 'BIST', quantity: 2, entryPriceTry: null, commission: 0.4 }]);
  expect(positions.reduce((sum, p) => sum + p.totalValue, 0)).toBe(620);
  expect(positions.reduce((sum, p) => sum + p.pnl, 0)).toBeCloseTo(119);
  expect(getUsdTryRate).toHaveBeenCalledTimes(1);
});
it('does not display raw USD amounts as TRY during an FX outage', async () => {
  vi.mocked(getUsdTryRate).mockRejectedValue(new Error('FX unavailable'));
  await expect(valuePositions([crypto])).rejects.toThrow('FX unavailable');
});
it('needs no FX service for a BIST-only or empty portfolio', async () => {
  await valuePositions([]);
  await valuePositions([{ ...crypto, symbol: 'THYAO.IS', type: 'BIST', entryPriceTry: null }]);
  expect(getUsdTryRate).not.toHaveBeenCalled();
});
it('refuses legacy crypto and mismatched source currencies instead of making up costs', async () => {
  await expect(valuePositions([{ ...crypto, entryPriceTry: null }])).rejects.toThrow('kur kaydı eksik');
  expect(getMarketQuotes).not.toHaveBeenCalled();
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'BTC-USD', price: 100, currency: 'TRY' } as any]);
  await expect(valuePositions([crypto])).rejects.toThrow('para birimi');
});
