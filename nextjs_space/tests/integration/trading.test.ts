import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { executeTrade, tradeSchema } from '../../lib/trading';
import { applyCurrencySchema, currencyAudit } from '../../lib/currency-migration';
import { applyPlatformSchema } from '../../lib/platform-migration';
import { pnlBreakdown } from '../../lib/pnl-breakdown';

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required; use a disposable localhost borsabi_test database.');
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi_test') {
  throw new Error('Integration tests only accept a local database named borsabi_test.');
}
const db = new PrismaClient({ datasources: { db: { url: connection } } });
const createdIds: string[] = [];
let userId: string;
const input = (type: 'BUY' | 'SELL', quantity: number) => tradeSchema.parse({ symbol: 'THYAO.IS', type, quantity });
beforeAll(async () => { await db.$connect(); });
beforeEach(async () => {
  const user = await db.user.create({ data: { email: `regression-${randomUUID()}@example.test`, password: 'test-only', balance: 1000, initialBalance: 1000 } });
  userId = user.id;
  createdIds.push(userId);
});
afterAll(async () => {
  if (createdIds.length) {
    await db.$transaction([
      db.transaction.deleteMany({ where: { userId: { in: createdIds } } }),
      db.position.deleteMany({ where: { userId: { in: createdIds } } }),
      db.user.deleteMany({ where: { id: { in: createdIds } } }),
    ]);
  }
  await db.$disconnect();
});
describe('PostgreSQL trading ledger', () => {
  it('applies the platform schema twice without changing balances or opting old positions into automation', async () => {
    await executeTrade(db, userId, input('BUY', 1), 100);
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
    await applyPlatformSchema(db); await applyPlatformSchema(db);
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
    expect((await db.position.findFirstOrThrow({ where: { userId } })).autoExit).toBe(false);
  });
  it('blocks a price or FX move beyond the budget before any cash or ledger write', async () => {
    const order = tradeSchema.parse({ ...input('BUY', 9), maxSpendTry: 910, requestId: randomUUID() });
    await expect(executeTrade(db, userId, order, 102)).rejects.toThrow('bütçe sınırı');
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(1000);
    const crypto = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', quantity: .1, maxSpendTry: 305, requestId: randomUUID() });
    await expect(executeTrade(db, userId, crypto, 100, { rate: 31, asOf: new Date() })).rejects.toThrow('bütçe sınırı');
    expect(await db.tradeRequest.count({ where: { userId } })).toBe(0);
  });
  it('returns the saved result for concurrent and later retries without double debits', async () => {
    const order = tradeSchema.parse({ ...input('BUY', 2), requestId: randomUUID(), maxSpendTry: 201 });
    const results = await Promise.all([executeTrade(db, userId, order, 100), executeTrade(db, userId, order, 100)]);
    expect(results[0]).toEqual(results[1]);
    expect(await executeTrade(db, userId, order, 200)).toEqual(results[0]);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBeCloseTo(799.6);
    await expect(executeTrade(db, userId, { ...order, quantity: 3 }, 100)).rejects.toThrow('farklı bir emir');
  });
  it('rolls back a receipt together with the failed ledger write and allows a retry', async () => {
    const order = tradeSchema.parse({ ...input('BUY', 2), requestId: randomUUID() });
    const failed = db.$extends({ query: { tradeRequest: { create() { throw new Error('receipt unavailable'); } } } });
    await expect(executeTrade(failed as unknown as PrismaClient, userId, order, 100)).rejects.toThrow('receipt unavailable');
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(1000);
    await executeTrade(db, userId, order, 100);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
  });
  it('reconciles saved price, FX and commission attribution with realized cash', async () => {
    const buy = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', quantity: .1 });
    await executeTrade(db, userId, buy, 100, { rate: 30, asOf: new Date() });
    await executeTrade(db, userId, { ...buy, type: 'SELL' }, 110, { rate: 32, asOf: new Date() });
    const t = await db.transaction.findFirstOrThrow({ where: { userId, type: 'SELL' } });
    const parts = pnlBreakdown(.1, 100, 3000, 110, 32, .6, .704);
    expect(t.pricePnlTry).toBeCloseTo(parts.pricePnlTry); expect(t.fxPnlTry).toBeCloseTo(parts.fxPnlTry);
    expect(t.pnl).toBeCloseTo(t.pricePnlTry! + t.fxPnlTry! - t.buyCommissionTry! - t.commission);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance - 1000).toBeCloseTo(t.pnl!);
  });
  it('sells an opted-in position at most once and persists its notification atomically', async () => {
    await executeTrade(db, userId, { ...input('BUY', 2), autoExit: true, stopLoss: 90 }, 100);
    const p = await db.position.findFirstOrThrow({ where: { userId } });
    const sell = tradeSchema.parse({ ...input('SELL', 2), requestId: `auto:${p.id}:${p.updatedAt.getTime()}` });
    const options = { positionId: p.id, updatedAt: p.updatedAt, reason: 'Zarar kes' };
    await Promise.all([executeTrade(db, userId, sell, 89, undefined, options), executeTrade(db, userId, sell, 89, undefined, options)]);
    expect(await db.transaction.count({ where: { userId, type: 'SELL' } })).toBe(1);
    expect(await db.appNotification.count({ where: { userId } })).toBe(1);
    expect((await db.position.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('CLOSED');
  });
  it('does not sell from an old automation snapshot after a manual position change or opt-out', async () => {
    await executeTrade(db, userId, { ...input('BUY', 2), autoExit: true, stopLoss: 90 }, 100);
    const p = await db.position.findFirstOrThrow({ where: { userId } });
    await executeTrade(db, userId, { ...input('BUY', 1), autoExit: false }, 101);
    await expect(executeTrade(db, userId, input('SELL', 2), 89, undefined, { positionId: p.id, updatedAt: p.updatedAt, reason: 'Zarar kes' })).rejects.toThrow('Pozisyon değişti');
    expect(await db.transaction.count({ where: { userId, type: 'SELL' } })).toBe(0);
    expect((await db.position.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(3);
  });
  it('permits only the affordable concurrent buy', async () => {
    const results = await Promise.allSettled([
      executeTrade(db, userId, input('BUY', 6), 100),
      executeTrade(db, userId, input('BUY', 6), 100),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBeCloseTo(398.8);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
    expect((await db.position.findMany({ where: { userId } })).map(p => p.quantity)).toEqual([6]);
  });
  it('permits only one of two sales that together exceed the holding', async () => {
    await executeTrade(db, userId, input('BUY', 8), 100);
    const results = await Promise.allSettled([
      executeTrade(db, userId, input('SELL', 6), 110),
      executeTrade(db, userId, input('SELL', 6), 110),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.position.findFirstOrThrow({ where: { userId } })).quantity).toBe(2);
    expect(await db.transaction.count({ where: { userId, type: 'SELL' } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBeCloseTo(857.08);
  });
  it('rolls back both the cash and position if the ledger insert fails', async () => {
    const failingDb = db.$extends({ query: { transaction: { create() { throw new Error('Injected ledger failure'); } } } });
    await expect(executeTrade(failingDb as unknown as PrismaClient, userId, input('BUY', 5), 100)).rejects.toThrow('Injected ledger failure');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(1000);
    expect(await db.position.count({ where: { userId } })).toBe(0);
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
  });
  it('reconciles partial and final sale PnL against final cash', async () => {
    await executeTrade(db, userId, input('BUY', 8), 100);
    const first = await executeTrade(db, userId, input('SELL', 4), 110);
    expect((await db.position.findFirstOrThrow({ where: { userId } })).commission).toBeCloseTo(0.8);
    const second = await executeTrade(db, userId, input('SELL', 4), 120);
    const position = await db.position.findFirstOrThrow({ where: { userId } });
    expect(position.status).toBe('CLOSED');
    expect(position.pnl).toBeCloseTo(first.pnl! + second.pnl!);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance - user.initialBalance).toBeCloseTo(position.pnl);
    expect(position.pnl).toBeCloseTo(116.56);
  });
  it('keeps tiny residual crypto positions open', async () => {
    const crypto = (type: 'BUY' | 'SELL', quantity: number) => tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type, quantity });
    await executeTrade(db, userId, crypto('BUY', 0.00002), 60000, { rate: 30, asOf: new Date() });
    await executeTrade(db, userId, crypto('SELL', 0.00001), 61000, { rate: 31, asOf: new Date() });
    const position = await db.position.findFirstOrThrow({ where: { userId } });
    expect(position.status).toBe('OPEN');
    expect(position.quantity).toBeCloseTo(0.00001, 10);
  });
  it('settles multiple crypto purchases and partial sales in TRY at their individual FX rates', async () => {
    await db.user.update({ where: { id: userId }, data: { balance: 10000, initialBalance: 10000 } });
    const crypto = (type: 'BUY' | 'SELL', quantity: number) => tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type, quantity });
    const asOf = new Date();
    await executeTrade(db, userId, crypto('BUY', 0.1), 100, { rate: 30, asOf });
    await executeTrade(db, userId, crypto('BUY', 0.1), 200, { rate: 40, asOf });
    const bought = await db.position.findFirstOrThrow({ where: { userId } });
    expect(bought.entryPrice).toBeCloseTo(150);
    expect(bought.entryPriceTry).toBeCloseTo(5500);
    expect(bought.commission).toBeCloseTo(2.2);
    const first = await executeTrade(db, userId, crypto('SELL', 0.05), 180, { rate: 45, asOf });
    expect(first.pnl).toBeCloseTo(128.64);
    const remaining = await db.position.findFirstOrThrow({ where: { userId } });
    const second = await executeTrade(db, userId, crypto('SELL', remaining.quantity), 150, { rate: 50, asOf });
    expect(second.pnl).toBeCloseTo(296.1);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const closed = await db.position.findFirstOrThrow({ where: { userId } });
    expect(user.balance - user.initialBalance).toBeCloseTo(424.74);
    expect(closed.pnl).toBeCloseTo(424.74);
    expect(closed.status).toBe('CLOSED');
    const entries = await db.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    expect(entries.map(t => t.fxRate)).toEqual([30, 40, 45, 50]);
    expect(entries.every(t => t.fxAsOf?.getTime() === asOf.getTime())).toBe(true);
    expect(entries.map(t => t.price)).toEqual([100, 200, 180, 150]);
    expect(entries[0].total).toBe(300);
    expect(entries[2].total).toBe(405);
  });
  it('blocks crypto spending affordable in USD but unaffordable in the TL account', async () => {
    const crypto = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', quantity: 0.01 });
    await expect(executeTrade(db, userId, crypto, 60000, { rate: 32, asOf: new Date() })).rejects.toThrow('Yetersiz bakiye');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(1000);
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
    expect(await db.position.count({ where: { userId } })).toBe(0);
  });
  it('requires crypto FX metadata before starting any write', async () => {
    const crypto = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', quantity: 0.01 });
    await expect(executeTrade(db, userId, crypto, 100)).rejects.toThrow('doğrulanmış USD/TL kuru');
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
  });
  it('serializes concurrent crypto purchases against the TRY balance', async () => {
    const crypto = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', quantity: 0.2 });
    const results = await Promise.allSettled([
      executeTrade(db, userId, crypto, 100, { rate: 30, asOf: new Date() }),
      executeTrade(db, userId, crypto, 100, { rate: 30, asOf: new Date() }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBeCloseTo(398.8);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
  });
  it('rolls back converted cash and position if the crypto ledger insert fails', async () => {
    const failingDb = db.$extends({ query: { transaction: { create() { throw new Error('Injected currency ledger failure'); } } } });
    const crypto = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', quantity: 0.1 });
    await expect(executeTrade(failingDb as unknown as PrismaClient, userId, crypto, 100, { rate: 30, asOf: new Date() })).rejects.toThrow('Injected currency ledger failure');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(1000);
    expect(await db.position.count({ where: { userId } })).toBe(0);
  });
  it('applies the additive schema idempotently without changing cash or rows', async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
    await applyCurrencySchema(db);
    await applyCurrencySchema(db);
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
  });
  it('keeps legacy crypto untouched and blocks both automatic migration and mixed-cost trading', async () => {
    await db.position.create({ data: { userId, symbol: 'BTC-USD', name: 'Bitcoin', type: 'CRYPTO', quantity: 0.1, entryPrice: 100, currentPrice: 100 } });
    await db.transaction.create({ data: { userId, symbol: 'BTC-USD', name: 'Bitcoin', marketType: 'CRYPTO', type: 'BUY', quantity: 0.1, price: 100, total: 10 } });
    const before = await db.position.findFirstOrThrow({ where: { userId } });
    const audit = await currencyAudit(db);
    expect(audit.positions).toBe(1); expect(audit.transactions).toBe(1);
    await expect(applyCurrencySchema(db)).rejects.toThrow('Otomatik geçiş durduruldu');
    const crypto = tradeSchema.parse({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'SELL', quantity: 0.1 });
    await expect(executeTrade(db, userId, crypto, 110, { rate: 30, asOf: new Date() })).rejects.toThrow('kur kaydı eksik');
    expect(await db.position.findFirstOrThrow({ where: { userId } })).toEqual(before);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(1000);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
  });
});
