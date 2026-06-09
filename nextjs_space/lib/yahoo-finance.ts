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
const QUOTE_TTL = 60_000;  // 1 dakika
const CHART_TTL = 120_000; // 2 dakika

// Request queue for rate limiting
let requestQueue: Promise<void> = Promise.resolve();
const REQUEST_DELAY = 150; // ms between requests

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

// Batch quote - tek seferde birden fazla sembol
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
  
  // Cache'de olmayanları fetch edelim (sıralı, rate limit'e dikkat)
  for (const sym of toFetch) {
    try {
      const data = await enqueue(() => yf.quote(sym));
      quoteCache.set(sym, { data, expiry: now + QUOTE_TTL });
      results.set(sym, data);
    } catch (e: any) {
      // Stale cache varsa onu kullan
      const stale = quoteCache.get(sym);
      if (stale) results.set(sym, stale.data);
      else results.set(sym, null);
    }
  }
  
  return results;
}

export { yf };
