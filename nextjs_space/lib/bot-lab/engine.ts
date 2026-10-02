/** Pure execution engine shared by forward simulation and historical replay. Amounts are TRY. */
export type Market = 'BIST' | 'CRYPTO';
export type Config = { market: Market; symbol: string; commission: number; friction: number; maxOrder: number; dailyLoss: number };
export type Bar = { time: number; close: number };
export type Tick = { time: number; price: number; open: boolean };
export type Decision = { time: number; action: 'BUY' | 'SELL' | 'WAIT' | 'HALT'; reason: string; price?: number; quantity?: number; fee?: number };
export type State = {
  cash: number; quantity: number; fees: number; frictionCost: number; equity: number; peak: number; drawdown: number;
  day: string; dayEquity: number; haltedDay: string | null; lastQuote: number; lastBar: number;
  pending: { side: 'BUY' | 'SELL'; after: number; expires: number } | null;
  benchmarkQuantity: number; benchmarkCash: number; benchmarkEquity: number; price: number; quoteTime: number;
};
export const INITIAL = 100000;
export const HOUR = 3600000;
export const symbols: Record<Market, string[]> = { BIST: ['THYAO.IS', 'ASELS.IS', 'TUPRS.IS'], CRYPTO: ['BTC-USD', 'ETH-USD', 'SOL-USD'] };
export function initialState(): State {
  return { cash: INITIAL, quantity: 0, fees: 0, frictionCost: 0, equity: INITIAL, peak: INITIAL, drawdown: 0,
    day: '', dayEquity: INITIAL, haltedDay: null, lastQuote: 0, lastBar: 0, pending: null,
    benchmarkQuantity: 0, benchmarkCash: INITIAL, benchmarkEquity: INITIAL, price: 0, quoteTime: 0 };
}
const dayKey = (time: number) => new Date(time).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
export function crossover(bars: Bar[]): 'BUY' | 'SELL' | null {
  if (bars.length < 21) return null;
  const avg = (end: number, size: number) => bars.slice(end - size, end).reduce((s, b) => s + b.close, 0) / size;
  const n = bars.length;
  const previous = avg(n - 1, 5) - avg(n - 1, 20);
  const current = avg(n, 5) - avg(n, 20);
  return previous <= 0 && current > 0 ? 'BUY' : previous >= 0 && current < 0 ? 'SELL' : null;
}
export function step(original: State, config: Config, bars: Bar[], tick: Tick, now: number): { state: State; decision: Decision } {
  const s: State = { ...original, pending: original.pending ? { ...original.pending } : null };
  const result = (action: Decision['action'], reason: string, extra: Partial<Decision> = {}) => ({ state: s, decision: { time: now, action, reason, ...extra } });
  const maxAge = config.market === 'BIST' ? 20 * 60000 : 5 * 60000;
  if (!tick.open) return result('WAIT', 'Piyasa kapalı; emir gönderilmedi.');
  if (!Number.isFinite(tick.price) || tick.price <= 0 || !Number.isFinite(tick.time) || now - tick.time > maxAge || tick.time > now)
    return result('WAIT', 'Fiyat eski veya geçersiz; işlem engellendi.');
  if (tick.time <= s.lastQuote) return result('WAIT', 'Yeni fiyat bekleniyor.');
  s.lastQuote = tick.time; s.price = tick.price; s.quoteTime = tick.time;
  const mark = () => {
    s.equity = s.cash + s.quantity * tick.price;
    s.peak = Math.max(s.peak, s.equity);
    s.drawdown = Math.max(s.drawdown, (s.peak - s.equity) / s.peak * 100);
    s.benchmarkEquity = s.benchmarkCash + s.benchmarkQuantity * tick.price;
  };
  if (!s.benchmarkQuantity) {
    const raw = INITIAL / (tick.price * (1 + config.friction) * (1 + config.commission));
    s.benchmarkQuantity = config.market === 'BIST' ? Math.floor(raw) : Math.floor(raw * 1e8) / 1e8;
    s.benchmarkCash = INITIAL - s.benchmarkQuantity * tick.price * (1 + config.friction) * (1 + config.commission);
  }
  // Include overnight changes in the new day's loss, using the previous observed valuation.
  const day = dayKey(now);
  if (s.day !== day) { s.day = day; s.dayEquity = s.equity; s.haltedDay = null; }
  mark();
  if (s.haltedDay === day || s.equity <= s.dayEquity * (1 - config.dailyLoss)) {
    s.haltedDay = day; s.pending = null;
    return result('HALT', 'Günlük zarar sınırı: günün kalanında işlem durdu. Açık pozisyon korunuyor.');
  }
  let executed: Decision | null = null;
  if (s.pending && now > s.pending.expires) s.pending = null;
  if (s.pending && tick.time > s.pending.after) {
    const side = s.pending.side;
    s.pending = null;
    const price = tick.price * (1 + (side === 'BUY' ? config.friction : -config.friction));
    let quantity = s.quantity;
    if (side === 'BUY' && s.quantity === 0) {
      const raw = Math.min(config.maxOrder, s.cash) / (price * (1 + config.commission));
      quantity = config.market === 'BIST' ? Math.floor(raw) : Math.floor(raw * 1e8) / 1e8;
      if (quantity > 0) { const fee = quantity * price * config.commission; s.cash -= quantity * price + fee; s.quantity = quantity; s.fees += fee;
        executed = { time: now, action: side, reason: '5/20 ortalama yukarı kesişti; sonraki fiyatla sanal alış.', price, quantity, fee }; }
    } else if (side === 'SELL' && quantity > 0) {
      const fee = quantity * price * config.commission; s.cash += quantity * price - fee; s.quantity = 0; s.fees += fee;
      executed = { time: now, action: side, reason: '5/20 ortalama aşağı kesişti; sonraki fiyatla sanal satış.', price, quantity, fee };
    }
    if (executed) s.frictionCost += Math.abs(price - tick.price) * quantity;
    mark();
    if (s.equity <= s.dayEquity * (1 - config.dailyLoss)) { s.haltedDay = day; s.pending = null; }
  }
  // Bar.time is its CLOSE time. Never use an unfinished or future bar.
  const closed = bars.filter(b => Number.isFinite(b.close) && b.close > 0 && b.time <= tick.time).sort((a, b) => a.time - b.time);
  const latest = closed[closed.length - 1];
  let reason = 'Yeni kesişim yok; bekleniyor.';
  if (latest && latest.time > s.lastBar) {
    const cold = s.lastBar === 0;
    s.lastBar = latest.time;
    const signal = crossover(closed);
    if (cold) reason = 'Başlangıç verisi alındı; geçmiş sinyaller çalıştırılmadı.';
    else if (now - latest.time > 2 * HOUR) reason = 'Strateji verisi eski; yeni sinyal bekleniyor.';
    else if (signal && s.haltedDay !== day && ((signal === 'BUY' && !s.quantity) || (signal === 'SELL' && s.quantity > 0))) {
      s.pending = { side: signal, after: now, expires: now + 2 * HOUR };
      reason = 'Kesişim görüldü; gözlem anından sonraki fiyat bekleniyor.';
    }
  } else if (closed.length < 21) reason = 'En az 21 kapanmış saatlik veri bekleniyor.';
  return executed ? { state: s, decision: executed } : result('WAIT', reason);
}
