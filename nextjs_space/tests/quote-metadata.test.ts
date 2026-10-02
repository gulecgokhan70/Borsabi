import { expect, it } from 'vitest';
import { quoteTimestamp, quoteMarketOpen, aggregateMarketOpen, formatQuoteTime } from '../lib/quote-metadata';
it('keeps actual source time across seconds, milliseconds and dated values', () => {
  const date = new Date('2026-09-11T12:00:00Z');
  const now = Date.parse('2026-09-14T00:00:00Z');
  for (const value of [date, date.getTime(), date.getTime() / 1000, date.toISOString()]) expect(quoteTimestamp(value, now)).toBe(date.toISOString());
});
it('does not substitute request time for unknown, ambiguous or invalid dates', () => {
  for (const value of [null, undefined, '', 0, NaN, '2026-09-11 12:00:00', 'tomorrow', '9999-01-01T00:00:00Z']) expect(quoteTimestamp(value)).toBeNull();
  expect(formatQuoteTime(null)).toBe('Bilinmiyor');
});
it('keeps unknown session states separate from closed and open', () => {
  expect(quoteMarketOpen('REGULAR')).toBe(true);
  expect(quoteMarketOpen('POST')).toBe(false);
  expect(quoteMarketOpen(undefined)).toBeNull();
  expect(aggregateMarketOpen([null, false])).toBeNull();
  expect(aggregateMarketOpen([])).toBeNull();
  expect(aggregateMarketOpen([false, false])).toBe(false);
  expect(aggregateMarketOpen([null, true])).toBe(true);
});
