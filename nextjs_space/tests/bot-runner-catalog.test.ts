import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/db', () => ({ prisma: { paperBot: { findMany: vi.fn() }, scanCache: { upsert: vi.fn() } } }));
vi.mock('../lib/bot-lab/auto-market', () => ({ autoObservations: vi.fn() }));
vi.mock('../lib/bot-lab/market', () => ({ getObservation: vi.fn() }));
vi.mock('../lib/bot-lab/persistence', () => ({ persistBot: vi.fn() }));
import { prisma } from '../lib/db';
import { autoObservations } from '../lib/bot-lab/auto-market';
import { persistBot } from '../lib/bot-lab/persistence';
import { runBots } from '../lib/bot-lab/runner';
import { autoInitial, type AutoConfig } from '../lib/bot-lab/auto-engine';
const config: AutoConfig = { mode: 'auto-v2', scope: 'all', market: 'BIST', symbols: [], commission: 0, friction: 0, orderFraction: 0.05, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04, maxPositions: 3 };
const now = Date.now();
beforeEach(() => {
  vi.clearAllMocks();
  const state = autoInitial(); state.paused = false; state.cash = 99000;
  state.holdings['THYAO.IS'] = { quantity: 10, entry: 100, entryFee: 0, mark: 100, quoteTime: now - 60000, openedAt: now - 60000 };
  vi.mocked(prisma.paperBot.findMany).mockResolvedValueOnce([{ id: 'a', version: 4, state, config, message: '' }] as any).mockResolvedValue([]);
  vi.mocked(persistBot).mockResolvedValue(1);
  vi.mocked(autoObservations).mockImplementation(async c => ({ config: { ...c, symbols: ['THYAO.IS'] }, progress: undefined,
    observations: [{ symbol: 'THYAO.IS', bars: [], tick: { price: 95, time: now, open: true } }] }));
});
it('persists protective exits before starting broad scans and uses the advanced state version', async () => {
  await runBots();
  expect(vi.mocked(autoObservations).mock.calls[0][0]).toMatchObject({ scope: 'selected', symbols: ['THYAO.IS'] });
  expect(vi.mocked(persistBot).mock.calls[0][5]).toContainEqual(expect.objectContaining({ action: 'SELL', symbol: 'THYAO.IS' }));
  expect(vi.mocked(persistBot).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(autoObservations).mock.invocationCallOrder[1]);
  expect(vi.mocked(persistBot).mock.calls.map(call => call[2])).toEqual([4, 5]);
});
it('a concurrent user control cancels further processing of the stale bot version', async () => {
  vi.mocked(persistBot).mockResolvedValue(0);
  await runBots();
  expect(autoObservations).toHaveBeenCalledTimes(1);
  expect(persistBot).toHaveBeenCalledTimes(1);
});
