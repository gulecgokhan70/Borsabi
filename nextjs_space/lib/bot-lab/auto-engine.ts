import { INITIAL, Market, Tick } from './engine';

export const INTERVAL = 15 * 60000;
export const universe: Record<Market, { symbol: string; group: string }[]> = {
  BIST: [
    { symbol: 'THYAO.IS', group: 'Ulaşım' }, { symbol: 'PGSUS.IS', group: 'Ulaşım' },
    { symbol: 'TUPRS.IS', group: 'Rafineri' }, { symbol: 'ASELS.IS', group: 'Savunma' },
    { symbol: 'AKBNK.IS', group: 'Banka' }, { symbol: 'GARAN.IS', group: 'Banka' },
    { symbol: 'BIMAS.IS', group: 'Perakende' }, { symbol: 'EREGL.IS', group: 'Metal' },
  ],
  CRYPTO: [
    { symbol: 'BTC-USD', group: 'Bitcoin' }, { symbol: 'ETH-USD', group: 'Akıllı sözleşme' },
    { symbol: 'SOL-USD', group: 'Akıllı sözleşme' }, { symbol: 'AVAX-USD', group: 'Akıllı sözleşme' },
    { symbol: 'LTC-USD', group: 'Ödeme' },
  ],
};
export type AutoConfig = {
  mode: 'auto-v2'; market: Market; symbols: string[]; commission: number; friction: number;
  orderFraction: number; dailyLoss: number; stopLoss: number; takeProfit: number; maxPositions: number;
};
export type Candle = { time: number; close: number; volume: number };
export type Observation = { symbol: string; bars: Candle[]; tick: Tick; error?: string };
export type Candidate = { symbol: string; score: number; eligible: boolean; reason: string; barTime: number; cross: 'BUY' | 'SELL' | null };
export type Holding = { quantity: number; entry: number; entryFee: number; mark: number; quoteTime: number; openedAt: number };
export type Pending = { side: 'BUY' | 'SELL'; after: number; expires: number; reason: string };
export type AutoState = {
  mode: 'auto-v2'; paused: boolean; closeRequested: boolean; closeAfter: number; cash: number; equity: number; peak: number;
  drawdown: number; fees: number; frictionCost: number; realized: number; day: string; dayEquity: number;
  haltedDay: string | null; holdings: Record<string, Holding>; pending: Record<string, Pending>;
  lastBars: Record<string, number>; lastQuotes: Record<string, number>; candidates: Candidate[]; valuedAt: number;
};
export type AutoEvent = { time: number; action: 'BUY' | 'SELL' | 'WAIT' | 'HALT'; reason: string; symbol?: string; price?: number; quantity?: number; fee?: number; pnl?: number };
export function autoInitial(): AutoState {
  return { mode: 'auto-v2', paused: true, closeRequested: false, closeAfter: 0, cash: INITIAL, equity: INITIAL, peak: INITIAL,
    drawdown: 0, fees: 0, frictionCost: 0, realized: 0, day: '', dayEquity: INITIAL, haltedDay: null,
    holdings: {}, pending: {}, lastBars: {}, lastQuotes: {}, candidates: [], valuedAt: 0 };
}
export function fresh(tick: Tick, market: Market, now: number) {
  return tick.open && Number.isFinite(tick.price) && tick.price > 0 && Number.isFinite(tick.time) && tick.time <= now &&
    now - tick.time <= (market === 'BIST' ? 20 : 5) * 60000;
}
function emas(values: number[], period: number) {
  let value = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  const result = [value];
  for (const n of values.slice(period)) { value += 2 / (period + 1) * (n - value); result.push(value); }
  return result;
}
export function rankObservation(o: Observation, market: Market, now: number): Candidate {
  const base: Candidate = { symbol: o.symbol, score: 0, eligible: false, reason: '', barTime: 0, cross: null };
  const reject = (reason: string) => ({ ...base, reason });
  if (o.error) return reject(o.error);
  if (!fresh(o.tick, market, now)) return reject('Piyasa kapalı veya fiyat eski/geçersiz.');
  const bars = o.bars.filter(b => b.time <= o.tick.time).sort((a, b) => a.time - b.time).slice(-120);
  if (bars.length < 51) return reject('En az 51 kapanmış 15 dakikalık mum gerekli.');
  if (bars.some((b, i) => !Number.isFinite(b.time) || !Number.isFinite(b.close) || b.close <= 0 || !Number.isFinite(b.volume) || b.volume < 0 || (i > 0 && b.time <= bars[i - 1].time)))
    return reject('Mum fiyatı, hacmi veya zaman sırası geçersiz.');
  base.barTime = bars[bars.length - 1].time;
  if (now - base.barTime > (market === 'BIST' ? 40 : 20) * 60000) return reject('Kapanmış mum verisi eski.');
  const recent = bars.slice(-21);
  if (recent.some((b, i) => i > 0 && b.time - recent[i - 1].time !== INTERVAL))
    return reject('Son 21 mum kesintisiz değil; yeni veri bekleniyor.');
  const prices = bars.map(b => b.close);
  const fast = emas(prices, 20), slow = emas(prices, 50);
  const f = fast[fast.length - 1], p = fast[fast.length - 2];
  const l = slow[slow.length - 1], q = slow[slow.length - 2];
  base.cross = p <= q && f > l ? 'BUY' : p >= q && f < l ? 'SELL' : null;
  const last = prices[prices.length - 1];
  const momentum = last / prices[prices.length - 6] - 1;
  const meanVolume = bars.slice(-21, -1).reduce((sum, b) => sum + b.volume, 0) / 20;
  const volumeRatio = meanVolume > 0 ? bars[bars.length - 1].volume / meanVolume : 0;
  const returns = recent.slice(1).map((b, i) => b.close / recent[i].close - 1);
  const mean = returns.reduce((sum, v) => sum + v, 0) / returns.length;
  const volatility = Math.sqrt(returns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / returns.length);
  const cap = market === 'BIST' ? 0.025 : 0.04;
  const trend = f > l && last > f;
  base.score = Math.round((trend ? 40 : 0) + Math.min(25, Math.max(0, momentum) * 500) + Math.min(20, volumeRatio * 10) + Math.max(0, 15 * (1 - volatility / cap)));
  base.eligible = trend && momentum > 0 && momentum < 0.2 && volumeRatio >= 1 && volatility <= cap && base.score >= 65 && base.cross === 'BUY';
  base.reason = base.eligible ? 'EMA20/50 yukarı kesişimi, pozitif momentum ve hacim koşulu sağlandı.' :
    !trend ? 'Yükseliş eğilimi koşulu yok.' : volatility > cap ? 'Oynaklık sınırın üzerinde.' :
    volumeRatio < 1 ? 'Hacim son 20 mum ortalamasının altında.' : base.cross !== 'BUY' ? 'Yeni EMA20/50 yukarı kesişimi bekleniyor.' : 'Momentum veya uygunluk puanı yeterli değil.';
  return base;
}
const dayKey = (time: number) => new Date(time).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const group = (c: AutoConfig, symbol: string) => universe[c.market].find(v => v.symbol === symbol)?.group ?? symbol;
export function controlAuto(original: AutoState, action: 'start' | 'stop' | 'close', now = Date.now()) {
  const s: AutoState = structuredClone(original);
  if (action === 'start' && s.closeRequested) throw new Error('Pozisyon kapatma tamamlanmadan başlatılamaz.');
  s.paused = action !== 'start';
  s.pending = Object.fromEntries(Object.entries(s.pending).filter(([, p]) => p.side === 'SELL'));
  if (action === 'start') s.lastBars = {}; // no historical entry on resume
  if (action === 'close') { s.closeRequested = true; s.closeAfter = now; }
  return s;
}
/** No network/broker access. Single atomic state transition; caller persists with version guard. */
export function autoStep(original: AutoState, c: AutoConfig, observations: Observation[], now: number): { state: AutoState; events: AutoEvent[]; message: string } {
  const s: AutoState = structuredClone(original);
  const events: AutoEvent[] = [];
  const valid = new Map<string, Observation>();
  for (const o of observations) if (c.symbols.includes(o.symbol) && !o.error && fresh(o.tick, c.market, now)) valid.set(o.symbol, o);
  const mark = () => {
    s.equity = s.cash + Object.values(s.holdings).reduce((sum, h) => sum + h.quantity * h.mark, 0);
    s.peak = Math.max(s.peak, s.equity); s.drawdown = Math.max(s.drawdown, (s.peak - s.equity) / s.peak * 100);
  };
  const day = dayKey(now);
  if (s.day !== day) { s.day = day; s.dayEquity = s.equity; s.haltedDay = null; }
  for (const [symbol, h] of Object.entries(s.holdings)) {
    const o = valid.get(symbol);
    if (o && o.tick.time >= h.quoteTime) { h.mark = o.tick.price; h.quoteTime = o.tick.time; }
  }
  mark();
  const halt = () => {
    if (s.equity <= s.dayEquity * (1 - c.dailyLoss)) {
      if (s.haltedDay !== day) events.push({ time: now, action: 'HALT', reason: 'Günlük zarar sınırı; yeni alımlar durdu, açık pozisyonların çıkış kontrolleri devam ediyor.' });
      s.haltedDay = day;
    }
  };
  halt();
  const staleHolding = Object.entries(s.holdings).some(([symbol, h]) => !valid.has(symbol) || valid.get(symbol)!.tick.time < h.quoteTime);
  if (!staleHolding) s.valuedAt = now;
  // Protective exits are evaluated before entry orders, even while paused or daily-locked.
  for (const [symbol, h] of Object.entries(s.holdings)) {
    const o = valid.get(symbol); if (!o || o.tick.time <= (s.lastQuotes[symbol] || 0)) continue;
    const pending = s.pending[symbol];
    const reason = s.closeRequested && o.tick.time > s.closeAfter ? 'Kullanıcı tüm sanal pozisyonları kapattı.' :
      o.tick.price <= h.entry * (1 - c.stopLoss) ? 'Zarar sınırı tetiklendi; mevcut fiyatla sanal satış.' :
      o.tick.price >= h.entry * (1 + c.takeProfit) ? 'Kâr hedefi tetiklendi; mevcut fiyatla sanal satış.' :
      pending?.side === 'SELL' && o.tick.time > pending.after && now <= pending.expires ? pending.reason : '';
    if (!reason) continue;
    const price = o.tick.price * (1 - c.friction), fee = price * h.quantity * c.commission;
    const pnl = (price - h.entry) * h.quantity - h.entryFee - fee;
    s.cash += price * h.quantity - fee; s.fees += fee; s.realized += pnl;
    s.frictionCost += (o.tick.price - price) * h.quantity;
    delete s.holdings[symbol]; delete s.pending[symbol];
    events.push({ time: now, symbol, action: 'SELL', reason, quantity: h.quantity, price, fee, pnl });
    s.lastQuotes[symbol] = o.tick.time;
  }
  mark(); halt();
  if (s.closeRequested && !Object.keys(s.holdings).length) s.closeRequested = false;
  for (const [symbol, pending] of Object.entries(s.pending)) {
    if (now > pending.expires) { delete s.pending[symbol]; continue; }
    if (pending.side !== 'BUY') continue;
    if (s.paused || s.haltedDay === day || staleHolding || s.closeRequested) { delete s.pending[symbol]; continue; }
    const o = valid.get(symbol);
    if (!o || o.tick.time <= pending.after || o.tick.time <= (s.lastQuotes[symbol] || 0)) continue;
    delete s.pending[symbol];
    if (s.holdings[symbol] || Object.keys(s.holdings).length >= c.maxPositions || Object.keys(s.holdings).some(v => group(c, v) === group(c, symbol))) continue;
    const price = o.tick.price * (1 + c.friction);
    const budget = Math.min(s.cash, s.equity * c.orderFraction);
    const raw = budget / (price * (1 + c.commission));
    const quantity = c.market === 'BIST' ? Math.floor(raw) : Math.floor(raw * 1e8) / 1e8;
    if (quantity <= 0) continue;
    const fee = quantity * price * c.commission;
    s.cash -= quantity * price + fee; s.fees += fee; s.frictionCost += (price - o.tick.price) * quantity;
    s.holdings[symbol] = { quantity, entry: price, entryFee: fee, mark: o.tick.price, quoteTime: o.tick.time, openedAt: now };
    s.lastQuotes[symbol] = o.tick.time;
    events.push({ time: now, symbol, action: 'BUY', reason: pending.reason + ' Gözlemden sonraki fiyat kullanıldı.', price, quantity, fee });
    mark(); halt();
  }
  s.candidates = observations.filter(o => c.symbols.includes(o.symbol)).map(o => rankObservation(o, c.market, now)).sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));
  const reserved = [...Object.keys(s.holdings), ...Object.keys(s.pending).filter(k => s.pending[k].side === 'BUY')];
  for (const candidate of s.candidates) {
    const previous = s.lastBars[candidate.symbol] || 0;
    if (!candidate.barTime || candidate.barTime <= previous) continue;
    s.lastBars[candidate.symbol] = candidate.barTime;
    // First observation establishes baseline for entries, but bearish exits are still allowed.
    if (candidate.cross === 'SELL' && s.holdings[candidate.symbol]) {
      s.pending[candidate.symbol] = { side: 'SELL', after: now, expires: now + 2 * INTERVAL, reason: 'EMA20/50 aşağı kesişimi; sonraki fiyatla sanal satış.' };
    } else if (previous && candidate.eligible && !s.paused && s.haltedDay !== day && !staleHolding && !reserved.includes(candidate.symbol) && reserved.length < c.maxPositions && !reserved.some(v => group(c, v) === group(c, candidate.symbol))) {
      s.pending[candidate.symbol] = { side: 'BUY', after: now, expires: now + 2 * INTERVAL, reason: candidate.reason };
      reserved.push(candidate.symbol);
    }
  }
  for (const [symbol, o] of valid) s.lastQuotes[symbol] = Math.max(s.lastQuotes[symbol] || 0, o.tick.time);
  if (s.paused || s.haltedDay === day) s.pending = Object.fromEntries(Object.entries(s.pending).filter(([, p]) => p.side === 'SELL'));
  const message = staleHolding ? 'Bazı açık pozisyonların fiyatı güncel değil; yeni alımlar engellendi.' :
    s.closeRequested ? 'Pozisyon kapatma için yeni ve geçerli fiyat bekleniyor.' :
    s.haltedDay === day ? 'Günlük zarar kilidi açık; yalnızca çıkış kontrolleri çalışıyor.' :
    s.paused ? 'Yeni alımlar duraklatıldı; açık pozisyonların çıkış kontrolleri sürüyor.' :
    Object.keys(s.pending).length ? 'Sinyal oluştu; sonraki geçerli fiyat bekleniyor.' : 'Tarama tamamlandı; uygun yeni kesişim bekleniyor.';
  return { state: s, events, message };
}
