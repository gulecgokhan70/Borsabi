import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { autoInitial } from '../../lib/bot-lab/auto-engine';
import { applyBotSchema } from '../../lib/bot-lab/migration';
import { json, persistBot } from '../../lib/bot-lab/persistence';
const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL required');
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi_test') throw new Error('Only disposable local borsabi_test is allowed.');
const db = new PrismaClient({ datasources: { db: { url: connection } } });
let userId: string;
beforeAll(async () => {
  await applyBotSchema(db);
  const user = await db.user.create({ data: { email: `paper-${randomUUID()}@example.test`, password: 'test-only', balance: 3210 } });
  userId = user.id;
});
afterAll(async () => { if (userId) await db.user.delete({ where: { id: userId } }); await db.$disconnect(); });
it('migration can repeat without resetting either ordinary or bot money', async () => {
  const bot = await db.paperBot.create({ data: { userId, market: 'BIST', symbol: 'AUTO', config: {}, state: json({ ...autoInitial(), cash: 99000 }) } });
  await applyBotSchema(db); await applyBotSchema(db);
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(3210);
  expect((await db.paperBot.findUniqueOrThrow({ where: { id: bot.id } })).state).toEqual({ ...autoInitial(), cash: 99000 });
});
it('concurrent workers commit only one state and one event without touching trading ledger', async () => {
  const bot = await db.paperBot.create({ data: { userId, market: 'CRYPTO', symbol: 'AUTO', running: true, config: {}, state: json(autoInitial()) } });
  const event = { time: Date.now(), action: 'BUY' as const, reason: 'fixture', symbol: 'BTC-USD', quantity: 1, price: 100 };
  const outcome = await Promise.all([persistBot(db, bot.id, 0, { ...autoInitial(), cash: 99900 }, 'fixture', [event]), persistBot(db, bot.id, 0, { ...autoInitial(), cash: 99900 }, 'fixture', [event])]);
  expect(outcome.sort()).toEqual([0, 1]);
  expect(await db.paperBotEvent.count({ where: { botId: bot.id } })).toBe(1);
  expect(await db.position.count({ where: { userId } })).toBe(0);
  expect(await db.transaction.count({ where: { userId } })).toBe(0);
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(3210);
  await db.paperBot.update({ where: { id: bot.id }, data: { version: { increment: 1 } } });
  expect(await persistBot(db, bot.id, 1, {}, 'stale', [event])).toBe(0);
  expect(await db.paperBotEvent.count({ where: { botId: bot.id } })).toBe(1);
});
it('database unique constraint rejects a second account for the same user and market', async () => {
  await expect(db.paperBot.create({ data: { userId, market: 'BIST', symbol: 'AUTO', config: {}, state: {} } })).rejects.toMatchObject({ code: 'P2002' });
});
