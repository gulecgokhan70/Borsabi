import YahooFinance from 'yahoo-finance2';

const yf: any = new (YahooFinance as any)();

import { SharedFetchCache } from './shared-fetch-cache';
const quoteCache = new SharedFetchCache<any>(1024, 60_000);
const chartCache = new SharedFetchCache<any>(128, 300_000);

// Request queue for rate limiting
let requestQueue: Promise<void> = Promise.resolve();
const REQUEST_DELAY = 100; // ms between requests

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = requestQueue.then(async () => {
    await delay(REQUEST_DELAY);
    return fn();
  });
  requestQueue = result.then(() => {}, () => {});
  return result;
}

export function cachedQuote(symbol: string): Promise<any> {
  return quoteCache.get(symbol, () => enqueue(() => yf.quote(symbol)));
}

export function cachedChart(symbol: string, opts: any): Promise<any> {
  // Include every option to prevent different requested ranges from colliding.
  const cacheKey = JSON.stringify([symbol, Object.keys(opts).sort().map(key => [key, opts[key]])]);
  return chartCache.get(cacheKey, () => enqueue(() => yf.chart(symbol, opts)));
}

export async function cachedQuoteBatch(symbols: string[]): Promise<Map<string, any>> {
  const unique = [...new Set(symbols)];
  const values = await Promise.all(unique.map(async symbol => {
    try { return [symbol, await cachedQuote(symbol)] as const; }
    catch { return [symbol, null] as const; }
  }));
  return new Map(values);
}

export { yf };
