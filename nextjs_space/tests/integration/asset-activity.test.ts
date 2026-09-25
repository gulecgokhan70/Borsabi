import { afterAll, afterEach, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { activityAsset, readAssetActivity } from '../../lib/asset-activity';
const connection = process.env.TEST_DATABASE_URL!;
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi_test') throw new Error('Only disposable local borsabi_test allowed');
const db = new PrismaClient({ datasources: { db: { url: connection } } });
const users: string[] = [];
afterEach(async () => {
  await db.transaction.deleteMany({ where: { userId: { in: users } } });
  await db.position.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } }); users.length = 0;
});
afterAll(async () => { await db.$disconnect(); });
it('scopes real PostgreSQL records and JSON events by owner, market, symbol and executed action', async () => {
  for (let i = 0; i < 2; i++) users.push((await db.user.create({ data: { email: `activity-${randomUUID()}@example.test`, password: 'test' } })).id);
  const symbol = 'A1CAP.IS';
  for (const userId of users) {
    await db.position.createMany({ data: [
      { userId, symbol, name: symbol, type: 'BIST', quantity: 1, entryPrice: 4 },
      { userId, symbol: 'A1CAP', name: symbol, type: 'BIST', quantity: 0, entryPrice: 4, status: 'CLOSED', closedAt: new Date(), pnl: 2 },
      { userId, symbol: 'THYAO.IS', name: 'other', type: 'BIST', quantity: 1, entryPrice: 300 },
    ] });
    await db.transaction.createMany({ data: [
      { userId, symbol, name: symbol, marketType: 'BIST', type: 'BUY', quantity: 1, price: 4, total: 4 },
      { userId, symbol: 'A1CAP', name: symbol, marketType: 'BIST', type: 'SELL', quantity: 1, price: 5, total: 5 },
      { userId, symbol, name: 'wrong market', marketType: 'CRYPTO', type: 'BUY', quantity: 1, price: 4, total: 4 },
    ] });
    for (const market of ['BIST', 'CRYPTO']) {
      const bot = await db.paperBot.create({ data: { userId, symbol: 'AUTO', market, config: { mode: 'auto-v2' }, state: { holdings: {} } } });
      await db.paperBotEvent.createMany({ data: [
        { botId: bot.id, data: { symbol, action: 'SELL', time: Date.now(), quantity: 1, price: 5, fee: 0, pnl: 1 } },
        { botId: bot.id, data: { symbol, action: 'WAIT', time: Date.now() } },
        { botId: bot.id, data: { symbol: 'THYAO.IS', action: 'BUY', time: Date.now(), quantity: 1, price: 300 } },
      ] });
    }
  }
  const result = await db.$transaction(tx => readAssetActivity(tx, users[0], activityAsset('a1cap')!), { isolationLevel: 'RepeatableRead' });
  expect(result.open).toHaveLength(1); expect(result.closed).toHaveLength(1); expect(result.trades).toHaveLength(2);
  expect([...result.open, ...result.closed, ...result.trades].every(r => r.userId === users[0])).toBe(true);
  expect(result.bots).toHaveLength(1); expect(result.events).toHaveLength(1); expect(result.exits).toHaveLength(1);
  expect(result.events[0].botId).toBe(result.bots[0].id);
  expect(result.exits[0].id).toBe(result.events[0].id);
});
