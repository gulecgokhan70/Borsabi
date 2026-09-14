import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { deleteOwnAccount } from '../../lib/account-deletion';
import { transactionSummary } from '../../lib/transaction-summary';
import { applyPlatformSchema } from '../../lib/platform-migration';
import { executeTrade, tradeSchema } from '../../lib/trading';

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required; use a disposable localhost borsabi_test database.');
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi_test') throw new Error('Only a local borsabi_test database is allowed.');
const db = new PrismaClient({ datasources: { db: { url: connection } } });
const ids: string[] = []; const password = 'integration-only-password';
let hash: string;
beforeAll(async () => { await db.$connect(); hash = await bcrypt.hash(password, 4); await applyPlatformSchema(db); });
async function account() {
  const user = await db.user.create({ data: { email: `account-${randomUUID()}@example.test`, password: hash, balance: 1000, initialBalance: 1000 } });
  ids.push(user.id); return user;
}
afterAll(async () => {
  for (const id of ids) if (await db.user.findUnique({ where: { id } })) await deleteOwnAccount(db, id, password);
  await db.$disconnect();
});
async function relatedData(userId: string, otherId: string) {
  await executeTrade(db, userId, tradeSchema.parse({ symbol: 'THYAO.IS', type: 'BUY', quantity: 1, requestId: randomUUID() }), 100);
  await db.$transaction([
    db.chatMessage.create({ data: { userId, role: 'user', content: 'private note' } }),
    db.priceAlert.create({ data: { userId, symbol: 'THYAO.IS', name: 'THY', condition: 'above', targetPrice: 200 } }),
    db.achievement.create({ data: { userId, badge: 'first-trade' } }),
    db.watchlist.create({ data: { userId, symbol: 'THYAO.IS', name: 'THY' } }),
    db.appNotification.create({ data: { userId, eventKey: randomUUID(), title: 'Test', body: 'Test' } }),
    db.pushSubscription.create({ data: { userId, endpoint: `https://example.test/${randomUUID()}`, p256dh: 'test', auth: 'test' } }),
    db.replaySession.create({ data: { userId, state: {} } }),
    db.aiContentReport.create({ data: { userId, fingerprint: randomUUID(), source: 'ai-assistant', content: 'reported text', reason: 'other' } }),
    db.socialFollow.create({ data: { followerId: userId, followingId: otherId } }),
    db.socialFollow.create({ data: { followerId: otherId, followingId: userId } }),
  ]);
}
it('deletes all owned records atomically while preserving the other account and its data', async () => {
  const owner = await account(), other = await account(); await relatedData(owner.id, other.id);
  await db.chatMessage.create({ data: { userId: other.id, role: 'user', content: 'keep me' } });
  await deleteOwnAccount(db, owner.id, password);
  expect(await db.user.findUnique({ where: { id: owner.id } })).toBeNull();
  for (const model of ['position', 'transaction', 'tradeRequest', 'chatMessage', 'priceAlert', 'achievement', 'watchlist', 'appNotification', 'pushSubscription', 'replaySession', 'aiContentReport'] as const) {
    expect(await (db[model].count as any)({ where: { userId: owner.id } })).toBe(0);
  }
  expect(await db.socialFollow.count({ where: { OR: [{ followerId: owner.id }, { followingId: owner.id }] } })).toBe(0);
  expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).balance).toBe(1000);
  expect(await db.chatMessage.count({ where: { userId: other.id } })).toBe(1);
});
it('leaves data intact on password failure or a failed final delete', async () => {
  const owner = await account(), other = await account(); await relatedData(owner.id, other.id);
  await expect(deleteOwnAccount(db, owner.id, 'incorrect')).rejects.toThrow('şifreniz');
  const failing = db.$extends({ query: { user: { delete() { throw new Error('injected delete failure'); } } } });
  await expect(deleteOwnAccount(failing as unknown as PrismaClient, owner.id, password)).rejects.toThrow('injected delete failure');
  expect(await db.chatMessage.count({ where: { userId: owner.id } })).toBe(1);
  expect(await db.aiContentReport.count({ where: { userId: owner.id } })).toBe(1);
  expect(await db.socialFollow.count({ where: { followerId: owner.id } })).toBe(1);
  expect(await db.transaction.count({ where: { userId: owner.id } })).toBe(1);
});
it.each(['BUY', 'SELL'] as const)('serializes account deletion with a concurrent %s without orphan balances or orders', async type => {
  const owner = await account();
  if (type === 'SELL') await executeTrade(db, owner.id, tradeSchema.parse({ symbol: 'THYAO.IS', type: 'BUY', quantity: 1 }), 100);
  const [removal] = await Promise.allSettled([
    deleteOwnAccount(db, owner.id, password),
    executeTrade(db, owner.id, tradeSchema.parse({ symbol: 'THYAO.IS', type, quantity: 1, requestId: randomUUID() }), 100),
  ]);
  expect(removal.status).toBe('fulfilled');
  expect(await db.user.findUnique({ where: { id: owner.id } })).toBeNull();
  expect(await db.transaction.count({ where: { userId: owner.id } })).toBe(0);
  expect(await db.position.count({ where: { userId: owner.id } })).toBe(0);
  expect(await db.tradeRequest.count({ where: { userId: owner.id } })).toBe(0);
});
it('aggregates by account and exact date boundaries without subtracting paid commissions twice', async () => {
  const owner = await account(), other = await account();
  const start = new Date('2026-09-01T00:00:00Z'), end = new Date('2026-09-08T00:00:00Z');
  const base = { userId: owner.id, symbol: 'THYAO.IS', name: 'THY', quantity: 1, price: 100, total: 100, commission: 2, createdAt: start };
  await db.transaction.createMany({ data: [
    { ...base, type: 'BUY', note: 'entry reason', stopLoss: 90 },
    { ...base, type: 'SELL', pnl: 10, pricePnlTry: 12, fxPnlTry: 2, buyCommissionTry: 2 },
    { ...base, type: 'SELL', pnl: -4, note: '   ' },
    { ...base, type: 'SELL', pnl: null },
    { ...base, type: 'SELL', pnl: 0 },
    { ...base, type: 'SELL', pnl: 999, createdAt: new Date(start.getTime() - 1) },
    { ...base, type: 'SELL', pnl: 999, createdAt: end },
    { ...base, userId: other.id, type: 'SELL', pnl: 5000 },
  ] });
  const summary = await transactionSummary(db, owner.id, { start, end });
  expect(summary).toMatchObject({ total: 5, buyCount: 1, sellCount: 4, totalTrades: 3, winCount: 1, lossCount: 1, totalPnl: 6, totalCommission: 10, withNote: 1, buysWithStop: 1, attributedSales: 1, pricePnl: 12, fxPnl: 2, avgWin: 10, avgLoss: -4 });
  expect(summary.winRate).toBeCloseTo(100 / 3);
  const empty = await account(); expect(await transactionSummary(db, empty.id, { start, end })).toMatchObject({ total: 0, totalPnl: 0, winRate: 0 });
});
it('retains report records when additive deployment schema is applied again', async () => {
  const owner = await account();
  const report = await db.aiContentReport.create({ data: { userId: owner.id, fingerprint: randomUUID(), source: 'trade-coach', content: 'keep report', reason: 'other' } });
  await applyPlatformSchema(db); await applyPlatformSchema(db);
  expect(await db.aiContentReport.findUnique({ where: { id: report.id } })).toEqual(report);
});
