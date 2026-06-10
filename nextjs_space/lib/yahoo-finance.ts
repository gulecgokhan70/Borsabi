import YahooFinance from 'yahoo-finance2';

const yf: any = new (YahooFinance as any)();

// === In-memory cache for Yahoo Finance API ===
interface CacheEntry {
  data: any;
  expiry: number;
}

const quoteCache = new Map<string, CacheEntry>();
const chartCache = new Map<string, CacheEntry>();

// Cache TTL (ms)
const QUOTE_TTL = 120_000;  // 2 dakika
const CHART_TTL = 300_000;  // 5 dakika

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

export async function cachedQuote(symbol: string): Promise<any> {
  const now = Date.now();
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  
  try {
    const data = await enqueue(() => yf.quote(symbol));
    quoteCache.set(symbol, { data, expiry: now + QUOTE_TTL });
    return data;
  } catch (e: any) {
    // Rate limit ise eski cache'i döndür (stale)
    if (cached) return cached.data;
    throw e;
  }
}

export async function cachedChart(symbol: string, opts: any): Promise<any> {
  const cacheKey = `${symbol}:${opts.period1}:${opts.period2}:${opts.interval ?? '1d'}`;
  const now = Date.now();
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  
  try {
    const data = await enqueue(() => yf.chart(symbol, opts));
    chartCache.set(cacheKey, { data, expiry: now + CHART_TTL });
    return data;
  } catch (e: any) {
    // Rate limit ise eski cache'i döndür (stale)
    if (cached) return cached.data;
    throw e;
  }
}

// Batch quote - paralel küçük gruplarla hızlı fetch
export async function cachedQuoteBatch(symbols: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  const toFetch: string[] = [];
  const now = Date.now();
  
  // Önce cache'den bakalım
  for (const sym of symbols) {
    const cached = quoteCache.get(sym);
    if (cached && cached.expiry > now) {
      results.set(sym, cached.data);
    } else {
      toFetch.push(sym);
    }
  }
  
  if (toFetch.length === 0) return results;

  // Paralel gruplar halinde fetch (4'lü gruplar)
  const BATCH_SIZE = 4;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(sym =>
        enqueue(() => yf.quote(sym))
          .then((data: any) => {
            quoteCache.set(sym, { data, expiry: now + QUOTE_TTL });
            return { sym, data };
          })
          .catch(() => {
            const stale = quoteCache.get(sym);
            return { sym, data: stale?.data ?? null };
          })
      )
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.set(r.value.sym, r.value.data);
      }
    }
  }
  
  return results;
}

export { yf };
