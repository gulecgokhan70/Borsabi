import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/yahoo-finance', () => ({ cachedQuote: vi.fn() }));
vi.mock('../lib/bot-lab/chart-provider', () => ({ botChart: vi.fn() }));
import { cachedQuote } from '../lib/yahoo-finance';
import { botChart } from '../lib/bot-lab/chart-provider';
import { autoInitial, autoStep, type AutoConfig } from '../lib/bot-lab/auto-engine';
const now = Date.parse('2026-09-25T12:00:00Z');
const config: AutoConfig = { mode: 'auto-v2', scope: 'all', market: 'BIST', symbols: [], commission: 0, friction: 0, orderFraction: 0.05, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04, maxPositions: 3 };
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.mocked(cachedQuote).mockImplementation(async (symbol: string) => ({ currency: symbol.endsWith('-USD') ? 'USD' : 'TRY', regularMarketTime: new Date(now), regularMarketPrice: symbol === 'USDTRY=X' ? 40 : 90, marketState: 'REGULAR' }));
  vi.mocked(botChart).mockResolvedValue({ quotes: [] });
});
afterEach(() => vi.useRealTimers());
it('fetches holdings outside a rotated batch and preserves a usable exit quote when chart history fails', async () => {
  const { autoObservations } = await import('../lib/bot-lab/auto-market');
  const state = autoInitial(); state.cash = 99000;
  state.holdings['ZZZ.IS'] = { quantity: 10, entry: 100, entryFee: 0, mark: 100, quoteTime: now - 60000, openedAt: now - 60000 };
  vi.mocked(botChart).mockRejectedValue(new Error('chart outage'));
  const batch = await autoObservations(config, state);
  expect(batch.progress?.batchSize).toBe(48);
  expect(batch.config.symbols).toContain('ZZZ.IS');
  expect(batch.observations.find(o => o.symbol === 'ZZZ.IS')?.tick.price).toBe(90);
  const result = autoStep(state, batch.config, batch.observations, now);
  expect(result.events).toContainEqual(expect.objectContaining({ action: 'SELL', symbol: 'ZZZ.IS' }));
});
it('shares native observations across accounts and revalidates FX without multiplying cached prices twice', async () => {
  const { autoObservations } = await import('../lib/bot-lab/auto-market');
  const crypto = { ...config, market: 'CRYPTO' as const };
  const first = await autoObservations(crypto, autoInitial());
  const second = await autoObservations(crypto, autoInitial());
  expect(first.observations[0].tick.price).toBe(3600);
  expect(second.observations[0].tick.price).toBe(3600);
  expect(botChart).toHaveBeenCalledTimes(40);
  const previous = vi.mocked(cachedQuote).getMockImplementation()!;
  vi.mocked(cachedQuote).mockImplementation(async symbol => symbol === 'USDTRY=X'
    ? { currency: 'TRY', regularMarketPrice: 40, regularMarketTime: new Date(now - 21 * 60000) }
    : previous(symbol));
  await expect(autoObservations(crypto, autoInitial())).rejects.toThrow('USD/TL');
});
it('uses the priority chart cache for selected/shortlist observations and preserves source price time', async () => {
  const { autoObservations } = await import('../lib/bot-lab/auto-market');
  vi.mocked(cachedQuote).mockResolvedValue({ currency: 'TRY', regularMarketTime: new Date(now - 15 * 60000), regularMarketPrice: 90, marketState: 'REGULAR' });
  const result = await autoObservations({ ...config, scope: 'selected', symbols: ['THYAO.IS'] });
  expect(botChart).toHaveBeenCalledWith('THYAO.IS', true);
  expect(result.observations[0]).toMatchObject({ source: 'Yahoo Finance', observedAt: now, tick: { time: now - 15 * 60000 } });
});
