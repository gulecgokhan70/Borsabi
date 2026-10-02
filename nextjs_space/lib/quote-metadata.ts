/** A provider timestamp, never the time we fetched the response. */
export function quoteTimestamp(value: unknown, now = Date.now()): string | null {
  let ms: number;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number' && Number.isFinite(value)) ms = value < 1e12 ? value * 1000 : value;
  else if (typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) ms = Date.parse(value);
  else return null;
  return Number.isFinite(ms) && ms >= Date.UTC(2000, 0, 1) && ms <= now + 60_000 ? new Date(ms).toISOString() : null;
}
export function quoteMarketOpen(state: unknown): boolean | null {
  if (state === 'REGULAR') return true;
  if (['CLOSED', 'PRE', 'PREPRE', 'POST', 'POSTPOST'].includes(state as string)) return false;
  return null;
}
export function aggregateMarketOpen(states: unknown[]): boolean | null {
  if (states.some(state => state === true)) return true;
  return states.length > 0 && states.every(state => state === false) ? false : null;
}
export function formatQuoteTime(value: unknown): string {
  const timestamp = quoteTimestamp(value);
  return timestamp ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(timestamp)) + ' (Türkiye saati)' : 'Bilinmiyor';
}
