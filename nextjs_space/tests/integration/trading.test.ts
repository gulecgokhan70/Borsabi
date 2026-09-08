import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { executeTrade, tradeSchema } from '../../lib/trading';

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
    await executeTrade(db, userId, crypto('BUY', 0.00002), 60000);
    await executeTrade(db, userId, crypto('SELL', 0.00001), 61000);
    const position = await db.position.findFirstOrThrow({ where: { userId } });
    expect(position.status).toBe('OPEN');
    expect(position.quantity).toBeCloseTo(0.00001, 10);
  });
});
