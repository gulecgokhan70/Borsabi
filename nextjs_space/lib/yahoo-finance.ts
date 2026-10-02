import YahooFinance from 'yahoo-finance2';

const yf: any = new (YahooFinance as any)();

import { SharedFetchCache } from './shared-fetch-cache';
const quoteCache = new SharedFetchCache<any>(1024, 60_000);
const chartCache = new SharedFetchCache<any>(128, 300_000);

// Quote misses in the same turn share one upstream batch, including direct callers.
// Quotes and chart history have separate lanes so slow history cannot block prices.
const queues = { quotes: Promise.resolve() as Promise<unknown>, charts: Promise.resolve() as Promise<unknown> };
function enqueue<T>(fn: (signal: AbortSignal) => Promise<T>, lane: keyof typeof queues): Promise<T> {
  const result = queues[lane].then(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Quote provider timeout')); }, 12_000); });
    try { return await Promise.race([fn(controller.signal), timeout]); }
    finally { clearTimeout(timer!); }
  });
  queues[lane] = result.catch(() => undefined);
  return result;
}
type Waiting = { symbol: string; resolve: (value: any) => void; reject: (error: unknown) => void };
let waiting: Waiting[] = [];
let scheduled = false;
function queueQuote(symbol: string): Promise<any> {
  return new Promise((resolve, reject) => {
    waiting.push({ symbol, resolve, reject });
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      const requests = waiting; waiting = []; scheduled = false;
      for (let offset = 0; offset < requests.length; offset += 100) {
        const group = requests.slice(offset, offset + 100);
        const symbols = group.map(r => r.symbol);
        void enqueue<any>(signal => yf.quote(symbols.length === 1 ? symbols[0] : symbols,
          symbols.length === 1 ? {} : { return: 'object' }, { fetchOptions: { signal } }), 'quotes')
          .then(result => group.forEach(request => {
            const value = symbols.length === 1 ? result : result?.[request.symbol];
            if (value) request.resolve(value); else request.reject(new Error('Quote unavailable'));
          }), error => group.forEach(request => request.reject(error)));
      }
    }, 0);
  });
}
export function cachedQuote(symbol: string): Promise<any> {
  return quoteCache.get(symbol, () => queueQuote(symbol));
}

export function cachedChart(symbol: string, opts: any): Promise<any> {
  // Include every option to prevent different requested ranges from colliding.
  const cacheKey = JSON.stringify([symbol, Object.keys(opts).sort().map(key => [key, opts[key]])]);
  return chartCache.get(cacheKey, () => enqueue(signal => yf.chart(symbol, opts, { fetchOptions: { signal } }), 'charts'));
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
