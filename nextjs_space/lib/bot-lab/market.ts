import { cachedChart, cachedQuote } from '@/lib/yahoo-finance';
import { Bar, Config, HOUR, Tick } from './engine';
const timestamp = (value: unknown) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value * 1000 : NaN;
export async function getObservation(config: Config): Promise<{ bars: Bar[]; tick: Tick }> {
  const now = Date.now();
  const [quote, chart, fx] = await Promise.all([
    cachedQuote(config.symbol),
    cachedChart(config.symbol, { period1: new Date(now - 14 * 86400000).toISOString().slice(0, 10), interval: '1h' }),
    config.market === 'CRYPTO' ? cachedQuote('USDTRY=X') : Promise.resolve(null),
  ]);
  let rate = 1;
  if (fx) {
    const age = now - timestamp(fx.regularMarketTime);
    // FX is deliberately fail-closed (including weekend gaps), never silently USD-as-TRY.
    if (fx.currency !== 'TRY' || !Number.isFinite(fx.regularMarketPrice) || fx.regularMarketPrice <= 0 || !Number.isFinite(age) || age < 0 || age > 20 * 60000)
      throw new Error('USD/TL kuru güncel değil; TL bazlı kripto işlemleri bekletiliyor.');
    rate = fx.regularMarketPrice;
  }
  if (quote.currency !== (config.market === 'BIST' ? 'TRY' : 'USD')) throw new Error('Fiyat para birimi doğrulanamadı.');
  const local = new Date(now + 3 * HOUR);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  // Provider marketState also rejects holidays/early closes. Unknown state fails closed.
  const open = config.market === 'CRYPTO' || (quote.marketState === 'REGULAR' && local.getUTCDay() > 0 && local.getUTCDay() < 6 && minute >= 600 && minute < 1080);
  return {
    bars: (chart?.quotes || []).map((q: { date: Date; close: number }) => ({ time: new Date(q.date).getTime() + HOUR, close: q.close })),
    tick: { time: timestamp(quote.regularMarketTime), price: quote.regularMarketPrice * rate, open },
  };
}
