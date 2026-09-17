import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/yahoo-finance', () => ({ cachedQuoteBatch: vi.fn() }));
vi.mock('../lib/fx', () => ({ getUsdTryRate: vi.fn() }));
vi.mock('../lib/trading', async original => ({ ...await original<typeof import('../lib/trading')>(), executeTrade: vi.fn() }));
import { exitDecision, processAutoPosition, runAutomationCycle, usableAutomationQuote } from '../lib/automation';
import { executeTrade } from '../lib/trading';
import { getUsdTryRate } from '../lib/fx';
import { cachedQuoteBatch } from '../lib/yahoo-finance';
const position: any = { id: 'pos', userId: 'user', symbol: 'BTC-USD', name: 'Bitcoin', type: 'CRYPTO', autoExit: true, quantity: 0.1,
  entryPrice: 100, trailingStopPercent: 5, trailingStopHighest: 110, stopLoss: 90, takeProfit: 120, updatedAt: new Date() };
const quote = { price: 100, currency: 'USD', asOf: new Date(), marketState: 'REGULAR' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getUsdTryRate).mockResolvedValue({ rate: 40, asOf: new Date() }); });
it('trailing stops never move down and take precedence over lower fixed stops', () => {
  expect(exitDecision(position, 100)).toMatchObject({ high: 110, stop: 104.5, reason: 'İz süren stop' });
  expect(exitDecision({ ...position, stopLoss: 108 }, 107).stop).toBe(108);
  expect(exitDecision(position, 121).reason).toBe('Kâr al');
});
it('does not execute opted-out, stale, missing, invalid or currency-mismatched prices', async () => {
  for (const q of [undefined, { ...quote, price: 0 }, { ...quote, currency: 'TRY' }, { ...quote, asOf: new Date(0) }]) await processAutoPosition({} as any, position, q);
  await processAutoPosition({} as any, { ...position, autoExit: false }, quote);
  expect(executeTrade).not.toHaveBeenCalled();
  expect(usableAutomationQuote({ ...quote, currency: 'TRY', marketState: 'CLOSED' }, 'BIST')).toBe(false);
});
it('passes the original position version into the atomic ledger for a fresh threshold crossing', async () => {
  await processAutoPosition({} as any, position, quote);
  expect(executeTrade).toHaveBeenCalledWith({}, 'user', expect.objectContaining({ requestId: `auto:pos:${position.updatedAt.getTime()}`, type: 'SELL', quantity: 0.1 }),
    100, expect.objectContaining({ rate: 40 }), expect.objectContaining({ positionId: 'pos', updatedAt: position.updatedAt }));
});
it('a rising trailing high uses an optimistic version check', async () => {
  const db = { position: { updateMany: vi.fn() } };
  await processAutoPosition(db as any, position, { ...quote, price: 115 });
  expect(db.position.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ updatedAt: position.updatedAt, autoExit: true }), data: expect.objectContaining({ trailingStopHighest: 115, stopLoss: 109.25 }) }));
});
it('claims price alerts and inserts their notification in the same transaction', async () => {
  const create = vi.fn(), claim = vi.fn().mockResolvedValue({ count: 1 });
  const tx = { priceAlert: { updateMany: claim }, appNotification: { create } };
  const db = { position: { findMany: vi.fn().mockResolvedValue([]) }, priceAlert: { findMany: vi.fn().mockResolvedValue([{ id: 'a', userId: 'u', symbol: 'BTC-USD', condition: 'above', targetPrice: 90, createdAt: new Date(0) }]) }, scanCache: { upsert: vi.fn() }, $transaction: vi.fn(fn => fn(tx)) };
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['BTC-USD', { regularMarketPrice: 100, currency: 'USD', regularMarketTime: new Date() }]]) as any);
  await runAutomationCycle(db as any); expect(create).toHaveBeenCalledTimes(1);
  claim.mockResolvedValue({ count: 0 }); await runAutomationCycle(db as any); expect(create).toHaveBeenCalledTimes(1);
});
it('keeps legacy trailing positions notification-only without silently enabling sales', async () => {
  const create = vi.fn(), updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = { position: { updateMany }, appNotification: { create } };
  const db = { position: { findMany: vi.fn().mockResolvedValue([{ ...position, autoExit: false, currentPrice: 110 }]) }, priceAlert: { findMany: vi.fn().mockResolvedValue([]) }, scanCache: { upsert: vi.fn() }, $transaction: vi.fn(fn => fn(tx)) };
  vi.mocked(cachedQuoteBatch).mockResolvedValue(new Map([['BTC-USD', { regularMarketPrice: 100, currency: 'USD', regularMarketTime: new Date() }]]) as any);
  await runAutomationCycle(db as any);
  expect(create).toHaveBeenCalledTimes(1);
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ autoExit: false, updatedAt: position.updatedAt }) }));
  expect(executeTrade).not.toHaveBeenCalled();
});
