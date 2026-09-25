import { expect, it } from 'vitest';
import { chartPerformance, previousSessionClose } from '../lib/chart-performance';
it('daily gap-up followed by decline is green if still above previous close (AKCNS regression)', () => {
  const daily = chartPerformance([{ close: 230 }, { close: 211.7 }], '1d', true, 209);
  expect(daily.direction).toBe('up');
  expect(daily.change).toBeCloseTo(2.7);
  expect(daily.percent).toBeCloseTo(1.29187);
  expect(chartPerformance([{ close: 230 }, { close: 211.7 }], '1w', true, 209).direction).toBe('down');
});
it('hover uses the same baseline and missing daily baseline is neutral, never a fabricated zero', () => {
  expect(chartPerformance([{ close: 230 }, { close: 211 }], '1d', true, 209, { close: 208 })).toMatchObject({ direction: 'down', change: -1 });
  expect(chartPerformance([{ close: 230 }, { close: 211 }], '1d', true, null)).toMatchObject({ direction: 'neutral', percent: null });
  expect(chartPerformance([], '1w', false)).toMatchObject({ percent: null });
  expect(chartPerformance([{ close: 100 }, { close: 110 }], '1d', false).percent).toBeCloseTo(10);
});
it('selects the preceding Istanbul session across weekends and cannot use the opening candle', () => {
  const ts = (s: string) => Date.parse(s) / 1000;
  const history = [{ time: ts('2026-09-18T14:55Z'), close: 209 }, { time: ts('2026-09-21T07:00Z'), close: 230 }];
  expect(previousSessionClose(history, history[1].time)).toBe(209);
  expect(previousSessionClose(history.slice(1), history[1].time)).toBeNull();
});
