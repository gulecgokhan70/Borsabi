import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
vi.mock('../../lib/news-feed', () => ({ getAllNews: vi.fn() }));
import { getAllNews } from '../../lib/news-feed';
import { runRadarCycle, RADAR_STATE_ID } from '../../lib/radar-worker';
const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL required');
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi_test') throw new Error('Disposable local test DB required');
const db = new PrismaClient({ datasources: { db: { url: connection } } });
let userId: string;
const now = Date.now();
beforeAll(async () => {
  await db.$connect();
  await db.scanCache.deleteMany({ where: { id: RADAR_STATE_ID } });
  const user = await db.user.create({ data: { email: `radar-${randomUUID()}@example.test`, password: 'test-only', createdAt: new Date(now - 86400000) } });
  userId = user.id;
});
afterAll(async () => {
  await db.appNotification.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.scanCache.deleteMany({ where: { id: RADAR_STATE_ID } });
  await db.$disconnect();
});
it('commits notifications and checkpoint together and deduplicates concurrent workers', async () => {
  const event = { title: 'Petrol yükseldi', date: new Date(now).toISOString(), url: 'https://dunya.com/test-radar', dateVerified: true };
  vi.mocked(getAllNews).mockResolvedValue([event] as any);
  await runRadarCycle(db, now);
  expect(await db.appNotification.count({ where: { userId } })).toBe(0);
  vi.mocked(getAllNews).mockResolvedValue([{ ...event, title: 'Petrol düştü', date: new Date(now + 600000).toISOString() }] as any);
  const failing = db.$extends({ query: { scanCache: { upsert() { throw new Error('injected checkpoint failure'); } } } });
  await expect(runRadarCycle(failing as unknown as PrismaClient, now + 600000)).rejects.toThrow('injected');
  expect(await db.appNotification.count({ where: { userId } })).toBe(0);
  await Promise.all([runRadarCycle(db, now + 600000), runRadarCycle(db, now + 600000)]);
  expect(await db.appNotification.count({ where: { userId } })).toBe(1);
  await runRadarCycle(db, now + 1200000);
  expect(await db.appNotification.count({ where: { userId } })).toBe(1);
});
