import { expect, it, vi } from 'vitest';
import { sharedStep, budgetInput } from '../lib/bot-lab/shared-portfolio';
import { autoInitial, type AutoConfig } from '../lib/bot-lab/auto-engine';
import { buildEquityCurve } from '../lib/portfolio-accounting';
const config: AutoConfig = { mode: 'auto-v2', funding: 'portfolio', market: 'CRYPTO', symbols: ['BTC-USD'], commission: 0, friction: 0, orderFraction: .05, dailyLoss: .02, stopLoss: .02, takeProfit: .04, maxPositions: 3 };
const db = (balance: number, used = 0) => ({
  user: { findUniqueOrThrow: vi.fn(async () => ({ balance, initialBalance: 10000 })) },
  portfolioBotBudget: { findUnique: vi.fn(async () => ({ allocationPercent: 30, perTradePercent: 10, version: 1, capitalChanges: [] })) },
  paperBot: { findMany: vi.fn(async () => used ? [{ config, state: { ...autoInitial(), holdings: { 'ETH-USD': { quantity: 1, entry: used, entryFee: 0, mark: used } } } }] : []) },
});
it('rebases external cash usage without treating another bot purchase as a trading loss', async () => {
  const now = Date.now(); const state = autoInitial(3000); state.paused = false;
  const result = await sharedStep(db(9000, 1000) as any, 'owner', state, config, [], now);
  expect(result.state.cash).toBe(2000); expect(result.state.haltedDay).toBeNull();
  expect(result.state.drawdown).toBe(0); expect(state.cash).toBe(3000);
});
it('zero available cash produces finite state without fabricated money', async () => {
  const result = await sharedStep(db(0) as any, 'owner', autoInitial(0), config, [], Date.now());
  expect(result.state.cash).toBe(0); expect(result.state.equity).toBe(0); expect(result.state.drawdown).toBe(0);
});
it('enforces finite valid capital and percentages', () => {
  const valid = { capital: 10000, allocationPercent: 30, perTradePercent: 10, version: 0 };
  expect(budgetInput.safeParse(valid).success).toBe(true);
  for (const patch of [{ capital: 0 }, { capital: Infinity }, { allocationPercent: 101 }, { perTradePercent: -1 }, { version: -1 }, { cash: 100000 }]) expect(budgetInput.safeParse({ ...valid, ...patch }).success).toBe(false);
});
it('capital flows do not erase bot costs and manual/bot lots of one asset stay distinct', () => {
  const common = { symbol: 'THYAO.IS', quantity: 1, commission: 0, pnl: null, createdAt: new Date() };
  const curve = buildEquityCurve(1000, [
    { ...common, type: 'BUY', total: 100 },
    { ...common, holdingKey: 'bot:THYAO.IS', type: 'BUY', total: 200 },
    { ...common, holdingKey: 'bot:THYAO.IS', type: 'SELL', total: 220, pnl: 20 },
    { ...common, type: 'CAPITAL', quantity: 0, total: 500 },
  ]);
  expect(curve.at(-1)?.balance).toBe(1520);
});
