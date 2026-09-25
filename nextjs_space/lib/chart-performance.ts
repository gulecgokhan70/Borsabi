type Point = { close: number; date?: string };
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
/** Daily BIST performance uses the previous session, never the opening candle. */
export function chartPerformance(points: Point[], period: string, bist: boolean, previousClose?: number | null, active?: Point | null) {
  const first = points[0], last = points[points.length - 1];
  const price = active?.close ?? last?.close;
  const baseline = period === '1d' && bist ? previousClose : first?.close;
  const valid = positive(price) && positive(baseline) && (points.length > 1 || !!active || (period === '1d' && bist));
  const change = valid ? price - baseline : null;
  const percent = valid ? (price / baseline - 1) * 100 : null;
  return { price, baseline: positive(baseline) ? baseline : null, change, percent,
    direction: change === null || change === 0 ? 'neutral' : change > 0 ? 'up' : 'down' } as const;
}

/** Source-consistent baseline: last available candle before the displayed Istanbul session. */
export function previousSessionClose(history: { time: number; close: number }[], firstTime?: number) {
  if (!firstTime) return null;
  const day = (t: number) => new Date(t * 1000 + 3 * 3600000).toISOString().slice(0, 10);
  const session = day(firstTime);
  const previous = history.filter(p => p.time < firstTime && day(p.time) < session && positive(p.close));
  return previous.length ? previous[previous.length - 1].close : null;
}
