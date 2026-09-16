import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { buildEventRadar, type RadarEvent, type RadarReport } from './event-radar';
import { getAllNews } from './news-feed';
export const RADAR_STATE_ID = 'event-radar-worker-v1';
export const RADAR_INTERVAL = 10 * 60_000;
export const radarPreferenceId = (id: string) => `event-radar-disabled:${id}`;
type State = { scenarioVersion?: 1; checkedAt: number; baselineAt: number | null; seen: Record<string, number>; report?: RadarReport };
export function readRadarState(data?: string | null): State {
  if (!data) return { checkedAt: 0, baselineAt: null, seen: {} };
  // A malformed checkpoint must fail closed, not replay old notifications.
  const state = JSON.parse(data) as State;
  if (!Number.isFinite(state.checkedAt) || !(state.baselineAt === null || Number.isFinite(state.baselineAt)) || !state.seen || typeof state.seen !== 'object' || Array.isArray(state.seen) || !Object.values(state.seen).every(Number.isFinite)) throw new Error('Invalid radar checkpoint');
  return state;
}
export function radarFingerprint(event: RadarEvent) {
  return createHash('sha256').update(JSON.stringify([event.category,
    event.title.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(), event.symbols, event.channels])).digest('hex');
}
function conditionalEvents(report: RadarReport): RadarEvent[] {
  return (report.headlines ?? []).filter(h => !h.older && h.scenario).map(h => ({
    id: `conditional:${h.sourceUrl}`, title: h.title, publishedAt: h.publishedAt,
    sourceUrl: h.sourceUrl, sourceHost: h.sourceHost, sourceType: ['kap.org.tr', 'tcmb.gov.tr', 'tuik.gov.tr'].includes(h.sourceHost) ? 'Birincil kaynak' : 'Haber kaynağı',
    category: `Koşullu senaryo · ${h.scenario!.topic}`, symbols: [],
    channels: h.scenario!.sectors.map(s => ({ sector: s.sector, direction: 'belirsiz', mechanism: s.positive, counterScenario: s.negative })),
  }));
}
export function radarTransition(previous: State, report: RadarReport, feedAvailable: boolean, now: number) {
  const seen = Object.fromEntries(Object.entries(previous.seen).filter(([, time]) => now - time < 7 * 86400000));
  const expanded = conditionalEvents(report);
  // First cycle after the feature upgrade silently baselines expanded coverage.
  // Existing subscribers must not receive a backlog of newly classified old headlines.
  const candidates = [...report.events, ...(previous.scenarioVersion === 1 ? expanded : [])];
  const changes = previous.baselineAt === null ? [] : candidates.filter(event => !seen[radarFingerprint(event)]);
  for (const event of [...report.events, ...expanded]) seen[radarFingerprint(event)] = now;
  return { changes, state: { scenarioVersion: 1, checkedAt: now, baselineAt: previous.baselineAt ?? (feedAvailable ? now : null), seen, report } satisfies State };
}
export async function runRadarCycle(db: PrismaClient, now = Date.now()) {
  const cached = await db.scanCache.findUnique({ where: { id: RADAR_STATE_ID } });
  if (now - readRadarState(cached?.data).checkedAt < RADAR_INTERVAL) return;
  const news = await getAllNews();
  const report = buildEventRadar(news, now);
  await db.$transaction(async tx => {
    // One durable writer even if more than one worker is accidentally started.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(728194)`;
    const row = await tx.scanCache.findUnique({ where: { id: RADAR_STATE_ID } });
    const previous = readRadarState(row?.data);
    if (now - previous.checkedAt < RADAR_INTERVAL) return;
    const { changes, state } = radarTransition(previous, report, news.length > 0, now);
    if (changes.length) {
      const disabled = await tx.scanCache.findMany({ where: { id: { startsWith: 'event-radar-disabled:' } }, select: { id: true } });
      const optedOut = new Set(disabled.map(p => p.id));
      let cursor: string | undefined;
      do {
        const users = await tx.user.findMany({ select: { id: true, createdAt: true }, orderBy: { id: 'asc' }, take: 200,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        const notifications = users.flatMap(user => {
          if (optedOut.has(radarPreferenceId(user.id))) return [];
          const eligible = changes.filter(e => Date.parse(e.publishedAt) >= user.createdAt.getTime());
          if (!eligible.length) return [];
          const key = createHash('sha256').update(eligible.map(radarFingerprint).sort().join(':')).digest('hex');
          return [{ userId: user.id, eventKey: `radar:${user.id}:${key}`, title: `${eligible.length} yeni gelişme`,
            body: eligible.slice(0, 2).map(e => e.title).join(' • ').slice(0, 350) + ' · Olası etkileri incele.', url: '/alerts#radar' }];
        });
        if (notifications.length) await tx.appNotification.createMany({ data: notifications, skipDuplicates: true });
        cursor = users.length === 200 ? users[users.length - 1].id : undefined;
      } while (cursor);
    }
    const data = JSON.stringify(state);
    await tx.scanCache.upsert({ where: { id: RADAR_STATE_ID }, create: { id: RADAR_STATE_ID, data }, update: { data } });
  }, { timeout: 30_000 });
}
