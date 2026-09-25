import { prisma } from '@/lib/db';
import { Config, State, Decision, step } from './engine';
import { getObservation } from './market';
import { AutoConfig, AutoState, AutoEvent, autoStep } from './auto-engine';
import { autoObservations } from './auto-market';
import { persistBot } from './persistence';
import { botCatalog } from './catalog';
export async function runBots() {
  let cursor: string | undefined;
  let processed = 0;
  while (true) {
    const bots = await prisma.paperBot.findMany({ where: { running: true }, orderBy: { id: 'asc' }, take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!bots.length) break;
    for (const bot of bots) {
      await prisma.scanCache.upsert({ where: { id: 'bot-lab-worker' }, create: { id: 'bot-lab-worker', data: JSON.stringify({ processed }) }, update: { data: JSON.stringify({ processed }) } });
      let version = bot.version;
      let state = bot.state as unknown as State | AutoState;
      let events: (Decision | AutoEvent)[] = [], message: string;
      try {
        if ((bot.config as { mode?: string }).mode === 'auto-v2') {
          const c = bot.config as unknown as AutoConfig;
          if (c.scope === 'all') {
            const current = state as AutoState;
            const watch = [...new Set([...Object.keys(current.holdings), ...Object.keys(current.pending)])];
            if (watch.length || current.paused) {
              const protective = watch.length ? await autoObservations({ ...c, scope: 'selected', symbols: watch }, current) : { observations: [] };
              const result = autoStep(current, { ...c, symbols: [...new Set([...botCatalog[c.market], ...watch])] }, protective.observations, Date.now());
              const saved = await persistBot(prisma, bot.id, version, result.state, result.message, result.events);
              if (!saved) { processed++; continue; } // User changed controls during provider fetch.
              state = result.state; version++;
              if (result.state.paused) { processed++; continue; }
            }
          }
          const batch = await autoObservations(c, state as AutoState);
          const result = autoStep(state as AutoState, batch.config, batch.observations, Date.now());
          if (batch.progress) result.state.scan = batch.progress;
          state = result.state; events = result.events; message = result.message;
        } else {
          const observation = await getObservation(bot.config as unknown as Config);
          const result = step(state as State, bot.config as unknown as Config, observation.bars, observation.tick, Date.now());
          state = result.state; events = [result.decision]; message = result.decision.reason;
        }
      } catch (error) {
        message = error instanceof Error && error.message.includes('TL') ? error.message : 'Veri sağlayıcısına ulaşılamadı; işlem yapılmadı.';
      }
      if (message !== bot.message && !events.some(e => e.reason === message)) events.push({ time: Date.now(), action: 'WAIT', reason: message });
      await persistBot(prisma, bot.id, version, state, message, events.filter(e => e.action !== 'WAIT' || e.reason !== bot.message));
      processed++;
    }
    cursor = bots[bots.length - 1].id;
  }
  await prisma.scanCache.upsert({ where: { id: 'bot-lab-worker' }, create: { id: 'bot-lab-worker', data: JSON.stringify({ processed }) }, update: { data: JSON.stringify({ processed }) } });
  return processed;
}
