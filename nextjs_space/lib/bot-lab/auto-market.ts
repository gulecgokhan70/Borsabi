import { cachedChart, cachedQuote } from '@/lib/yahoo-finance';
import { AutoConfig, INTERVAL, Observation } from './auto-engine';
const timestamp = (value: unknown) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value * 1000 : NaN;
export async function autoObservations(c: AutoConfig): Promise<Observation[]> {
  const now = Date.now();
  let rate = 1, rateTime = now;
  if (c.market === 'CRYPTO') {
    const fx = await cachedQuote('USDTRY=X'); rateTime = timestamp(fx.regularMarketTime);
    if (fx.currency !== 'TRY' || !Number.isFinite(fx.regularMarketPrice) || fx.regularMarketPrice <= 0 || !Number.isFinite(rateTime) || rateTime > now || now - rateTime > 20 * 60000)
      throw new Error('USD/TL kuru güncel değil; TL bazlı kripto işlemleri bekletiliyor.');
    rate = fx.regularMarketPrice;
  }
  const results: Observation[] = [];
  // Bounded provider concurrency; shared cache avoids repeating requests for every user.
  for (let i = 0; i < c.symbols.length; i += 3) {
    results.push(...await Promise.all(c.symbols.slice(i, i + 3).map(async symbol => {
      try {
        const [q, chart] = await Promise.all([cachedQuote(symbol), cachedChart(symbol, { period1: new Date(now - 7 * 86400000).toISOString().slice(0, 10), interval: '15m' })]);
        if (q.currency !== (c.market === 'BIST' ? 'TRY' : 'USD')) throw new Error('currency');
        const local = new Date(now + 3 * 3600000), minute = local.getUTCHours() * 60 + local.getUTCMinutes();
        const open = c.market === 'CRYPTO' || (q.marketState === 'REGULAR' && local.getUTCDay() > 0 && local.getUTCDay() < 6 && minute >= 600 && minute < 1080);
        return { symbol, bars: (chart?.quotes || []).map((b: { date: Date; close: number; volume: number }) => ({ time: new Date(b.date).getTime() + INTERVAL, close: b.close, volume: b.volume })),
          tick: { time: timestamp(q.regularMarketTime), price: q.regularMarketPrice * rate, open } };
      } catch { return { symbol, bars: [], tick: { time: 0, price: 0, open: false }, error: 'Fiyat veya mum verisine ulaşılamadı.' }; }
    })));
  }
  return results;
}
