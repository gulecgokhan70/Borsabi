/** Indicator history must be computed before cropping to the visible range. */
export type Candle = { time: number; date: string; open: number; high: number; low: number; close: number; volume: number };
export function ema(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = Array(values.length).fill(undefined);
  if (values.length < period) return out;
  out[period - 1] = values.slice(0, period).reduce((sum, n) => sum + n, 0) / period;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) out[i] = values[i] * alpha + out[i - 1]! * (1 - alpha);
  return out;
}
export function enrichCandles(candles: Candle[]) {
  const closes = candles.map(c => c.close);
  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const fast = ema(closes, 12), slow = ema(closes, 26);
  const macd = closes.map((_, i) => slow[i] === undefined ? undefined : fast[i]! - slow[i]!);
  const signal = ema(macd.slice(25) as number[], 9);
  return candles.map((c, i) => {
    const window = closes.slice(Math.max(0, i - 19), i + 1);
    const middle = window.length === 20 ? window.reduce((a, b) => a + b, 0) / 20 : undefined;
    const deviation = middle === undefined ? undefined : Math.sqrt(window.reduce((a, b) => a + (b - middle) ** 2, 0) / 20);
    const s = i >= 33 ? signal[i - 25] : undefined;
    return { ...c, ema20: e20[i], ema50: e50[i], ema200: e200[i],
      macd: s === undefined ? undefined : macd[i], macdSignal: s,
      macdHistogram: s === undefined ? undefined : macd[i]! - s,
      bbMiddle: middle, bbUpper: middle === undefined ? undefined : middle + 2 * deviation!,
      bbLower: middle === undefined ? undefined : middle - 2 * deviation! };
  });
}
export function chartHistoryStart(visibleStart: Date, now: Date, interval: string) {
  // Respect the provider's intraday retention limits. Missing history stays missing.
  const days = interval === '5m' ? 14 : ['15m', '30m'].includes(interval) ? 59 : ['1h', '4h'].includes(interval) ? 365 : 550;
  const start = new Date(visibleStart.getTime() - days * 86400000);
  const retention = ['5m', '15m', '30m'].includes(interval) ? 59 : ['1h', '4h'].includes(interval) ? 729 : Infinity;
  return new Date(Math.max(start.getTime(), now.getTime() - retention * 86400000));
}
/** Four-hour buckets start at the first actual hourly candle of each UTC day.
 * Never combine sessions or fabricate candles for missing hours. */
export function fourHourCandles(candles: Candle[]): Candle[] {
  const output: Candle[] = [];
  let day = '', start = 0, bucket = -1;
  for (const c of candles) {
    const nextDay = c.date.slice(0, 10);
    if (day !== nextDay) { day = nextDay; start = c.time; bucket = -1; }
    const nextBucket = Math.floor((c.time - start) / 14400);
    if (nextBucket !== bucket) { output.push({ ...c }); bucket = nextBucket; }
    else {
      const last = output[output.length - 1];
      last.high = Math.max(last.high, c.high); last.low = Math.min(last.low, c.low);
      last.close = c.close; last.volume += c.volume;
    }
  }
  return output;
}
