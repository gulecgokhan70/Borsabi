import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/news-feed', () => ({ getAllNews: vi.fn() }));
import { getAllNews } from '../lib/news-feed';
import { buildEventRadar, type RadarNews } from '../lib/event-radar';
import { radarTransition, readRadarState, runRadarCycle, radarPreferenceId } from '../lib/radar-worker';
const now = Date.parse('2026-09-16T12:00:00Z');
const news = (title: string, extra: Partial<RadarNews> = {}) => ({ title, date: new Date(now).toISOString(), url: 'https://dunya.com/haber-1', ...extra });
beforeEach(() => vi.resetAllMocks());
it('silently baselines, deduplicates across restart and empty feeds, and emits a changed headline once', () => {
  const report = buildEventRadar([news('Petrol yükseldi')], now);
  const baseline = radarTransition(readRadarState(), report, true, now);
  expect(baseline.changes).toEqual([]);
  const repeated = radarTransition(readRadarState(JSON.stringify(baseline.state)), report, true, now + 600000);
  expect(repeated.changes).toEqual([]);
  const outage = radarTransition(repeated.state, buildEventRadar([], now), false, now + 1200000);
  expect(radarTransition(outage.state, report, true, now + 1800000).changes).toEqual([]);
  const changed = buildEventRadar([news('Petrol düştü')], now);
  expect(radarTransition(outage.state, changed, true, now + 1800000).changes).toHaveLength(1);
  const syndication = buildEventRadar([news('Petrol yükseldi', { url: 'https://bloomberght.com/other', date: new Date(now + 1000).toISOString() })], now + 1000);
  expect(radarTransition(baseline.state, syndication, true, now + 600000).changes).toEqual([]);
});
it('waits for the first nonempty feed before baselining and rejects corrupt persisted state', () => {
  const empty = radarTransition(readRadarState(), buildEventRadar([], now), false, now);
  expect(empty.state.baselineAt).toBeNull();
  expect(radarTransition(empty.state, buildEventRadar([news('Petrol yükseldi')], now), true, now).changes).toEqual([]);
  expect(() => readRadarState('{bad')).toThrow();
});
it('writes one digest per eligible user, skips opt-out/new users and checkpoints inside the transaction', async () => {
  const baseline = radarTransition(readRadarState(), buildEventRadar([], now - 600000), true, now - 600000).state;
  let data = JSON.stringify(baseline);
  const records: any[] = [];
  const tx = {
    $executeRaw: vi.fn(), scanCache: {
      findUnique: vi.fn(async () => ({ data })),
      findMany: vi.fn(async () => [{ id: radarPreferenceId('disabled') }]),
      upsert: vi.fn(async (q: any) => { data = q.update.data; }),
    },
    user: { findMany: vi.fn(async () => ['old', 'disabled', 'new'].map(id => ({ id, createdAt: new Date(now + (id === 'new' ? 1 : -86400000)) }))) },
    appNotification: { createMany: vi.fn(async ({ data: items }: any) => { records.push(...items); }) },
  };
  const db = { ...tx, $transaction: vi.fn(async (callback: any) => callback(tx)) } as any;
  vi.mocked(getAllNews).mockResolvedValue([news('Petrol yükseldi'), news('Aselsan sözleşme imzaladı', { url: 'https://dunya.com/haber-2' })] as any);
  await runRadarCycle(db, now);
  expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ userId: 'old', title: '2 yeni gelişme', url: '/alerts#radar' });
  expect(tx.appNotification.createMany).toHaveBeenCalledWith({ data: expect.any(Array), skipDuplicates: true });
  await runRadarCycle(db, now + 30000);
  expect(getAllNews).toHaveBeenCalledTimes(1);
  await runRadarCycle(db, now + 600000);
  expect(records).toHaveLength(1);
});
