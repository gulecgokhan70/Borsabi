import { cachedQuote } from '@/lib/yahoo-finance';
import { AutoConfig, AutoState, INTERVAL, Observation } from './auto-engine';
import { botCatalog } from './catalog';
import { CatalogScanner } from './catalog-scanner';
import { botChart } from './chart-provider';
const scanner = new CatalogScanner();
const timestamp = (value: unknown) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value * 1000 : NaN;
export async function autoObservations(c: AutoConfig, state?: AutoState) {
  const symbols = c.scope === 'all' ? botCatalog[c.market] : c.symbols;
  const watch = [...new Set([...Object.keys(state?.holdings || {}), ...Object.keys(state?.pending || {})])];
  const config = { ...c, symbols: [...new Set([...symbols, ...watch])] };
  const batch = c.scope === 'all'
    ? await scanner.scan(c.market, symbols, batchSymbols => loadObservations({ ...c, symbols: batchSymbols }))
    : { observations: await loadObservations(config, true), progress: undefined };
  // Refresh held/pending quotes after the batch; a rotating universe must never lose exits.
  const protectedRows = c.scope === 'all' && watch.length ? await loadObservations({ ...c, symbols: watch }, true) : [];
  let observations = [...new Map([...batch.observations, ...protectedRows].map(o => [o.symbol, o])).values()];
  // Cached observations are in native currency. Revalidate FX at each account transition.
  if (c.market === 'CRYPTO') {
    const now = Date.now(), fx = await cachedQuote('USDTRY=X');
    const rateTime = timestamp(fx.regularMarketTime);
    if (fx.currency !== 'TRY' || !Number.isFinite(fx.regularMarketPrice) || fx.regularMarketPrice <= 0 || !Number.isFinite(rateTime) || rateTime > now || now - rateTime > 20 * 60000)
      throw new Error('USD/TL kuru güncel değil; TL bazlı kripto işlemleri bekletiliyor.');
    observations = observations.map(o => ({ ...o, tick: { ...o.tick, price: o.tick.price * fx.regularMarketPrice } }));
  }
  return { config, observations, progress: batch.progress };
}
async function loadObservations(c: AutoConfig, priority = false): Promise<Observation[]> {
  const results: Observation[] = [];
  // Bounded provider concurrency; shared cache avoids repeating requests for every user.
  for (let i = 0; i < c.symbols.length; i += 6) {
    results.push(...await Promise.all(c.symbols.slice(i, i + 6).map(async symbol => {
      try {
        const [q, chart] = await Promise.all([cachedQuote(symbol), botChart(symbol, priority).catch(() => null)]);
        if (q.currency !== (c.market === 'BIST' ? 'TRY' : 'USD')) throw new Error('currency');
        const local = new Date(Date.now() + 3 * 3600000), minute = local.getUTCHours() * 60 + local.getUTCMinutes();
        const open = c.market === 'CRYPTO' || (q.marketState === 'REGULAR' && local.getUTCDay() > 0 && local.getUTCDay() < 6 && minute >= 600 && minute < 1080);
        return { symbol, source: 'Yahoo Finance', observedAt: Date.now(), bars: (chart?.quotes || []).map((b: { date: Date; close: number; volume: number }) => ({ time: new Date(b.date).getTime() + INTERVAL, close: b.close, volume: b.volume })),
          tick: { time: timestamp(q.regularMarketTime), price: q.regularMarketPrice, open } };
      } catch { return { symbol, bars: [], tick: { time: 0, price: 0, open: false }, error: 'Fiyat veya mum verisine ulaşılamadı.' }; }
    })));
  }
  return results;
}
