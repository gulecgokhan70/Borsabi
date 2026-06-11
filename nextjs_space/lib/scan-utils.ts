/**
 * Paylaşılan tarama yardımcı fonksiyonları
 * Concurrency limiting, retry, timeout, veri çıkarma
 */

import { cachedQuote, cachedChart } from '@/lib/yahoo-finance';
import { type MidasStock } from '@/lib/midas-api';

// ===== CONCURRENCY LIMITER =====
// Aynı anda max N adet async iş çalıştırır
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R | null>
): Promise<(R | null)[]> {
  const results: (R | null)[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(processor));
    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : null);
    }
  }
  return results;
}

// ===== TIMEOUT WRAPPER =====
export async function withTimeout<T>(promise: Promise<T>, ms: number, label = ''): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Timeout: ${label} (${ms}ms)`));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

// ===== RETRY WRAPPER =====
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

// ===== CHART VERİSİ ÇIKARMA =====
export interface OHLCVData {
  closes: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  candleData: { open: number; high: number; low: number; close: number }[];
}

/**
 * Chart verisinden OHLCV dizileri çıkarır.
 * Kritik: closes filtrelendiğinde diğer diziler de hizalanır.
 */
export function extractOHLCV(quotes: any[]): OHLCVData {
  // Geçerli mumları filtrele (open, close, high, low hepsi > 0)
  const validQuotes = quotes.filter((q: any) =>
    q && q.close > 0 && q.high > 0 && q.low > 0
  );

  return {
    closes: validQuotes.map((q: any) => q.close),
    opens: validQuotes.map((q: any) => q.open ?? q.close),
    highs: validQuotes.map((q: any) => q.high),
    lows: validQuotes.map((q: any) => q.low),
    volumes: validQuotes.map((q: any) => q.volume ?? 0),
    candleData: validQuotes
      .filter((q: any) => q.open > 0)
      .map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close })),
  };
}

// ===== FETCH STOCK DATA =====
const CHART_TIMEOUT = 8000; // 8 saniye
const QUOTE_TIMEOUT = 5000; // 5 saniye

export interface StockFetchResult {
  ohlcv: OHLCVData;
  effectiveQuote: any;
  price: number;
  volume: number;
  avgVolume: number;
  changePercent: number;
}

/**
 * Tek bir hisse için veri çeker (Midas + Yahoo fallback)
 * Timeout + retry ile güvenilir
 */
export async function fetchStockData(
  symbol: string,
  yahooSymbol: string,
  midasData: MidasStock | null,
  chartPeriod: { period1: any; period2: any; interval: string },
): Promise<StockFetchResult | null> {
  // Chart her zaman Yahoo'dan (tarihsel veri)
  const chart = await withRetry(
    () => withTimeout(
      cachedChart(yahooSymbol, chartPeriod as any).catch(() => null),
      CHART_TIMEOUT,
      `chart:${symbol}`
    ),
    1, 300
  ).catch(() => null);

  if (!chart) return null;

  const quotes = chart?.quotes ?? [];
  const ohlcv = extractOHLCV(quotes);

  if (ohlcv.closes.length < 26) return null;

  // Quote: Midas varsa onu kullan, yoksa Yahoo fallback
  let quote: any = null;
  if (!midasData) {
    quote = await withTimeout(
      cachedQuote(yahooSymbol).catch(() => null),
      QUOTE_TIMEOUT,
      `quote:${symbol}`
    ).catch(() => null);
  }

  const lastClose = ohlcv.closes[ohlcv.closes.length - 1];
  let price = 0, volume = 0, avgVolume = 0, changePercent = 0;
  let effectiveQuote: any;

  if (midasData) {
    price = midasData.Last || midasData.Close || lastClose;
    volume = midasData.TotalVolume || (ohlcv.volumes.length > 0 ? ohlcv.volumes[ohlcv.volumes.length - 1] : 0);
    avgVolume = ohlcv.volumes.length > 20
      ? ohlcv.volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
      : volume;
    changePercent = midasData.DailyChangePercent ?? 0;
    effectiveQuote = {
      regularMarketPrice: price,
      regularMarketPreviousClose: midasData.PreviousClose,
      regularMarketOpen: midasData.Open,
      regularMarketDayHigh: midasData.High,
      regularMarketDayLow: midasData.Low,
      regularMarketVolume: volume,
      averageDailyVolume3Month: avgVolume,
      regularMarketChangePercent: changePercent,
    };
  } else {
    const rawPrice = quote?.regularMarketPrice ?? 0;
    price = rawPrice > 0 ? rawPrice : (quote?.regularMarketPreviousClose ?? lastClose);
    const rawVol = quote?.regularMarketVolume ?? 0;
    volume = rawVol > 0 ? rawVol : (ohlcv.volumes.length > 0 ? ohlcv.volumes[ohlcv.volumes.length - 1] : 0);
    avgVolume = quote?.averageDailyVolume3Month
      ?? (ohlcv.volumes.length > 20 ? ohlcv.volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : volume);
    changePercent = quote?.regularMarketChangePercent ?? 0;
    effectiveQuote = quote || {
      regularMarketPrice: price,
      regularMarketPreviousClose: ohlcv.closes.length >= 2 ? ohlcv.closes[ohlcv.closes.length - 2] : price,
      regularMarketOpen: lastClose,
      regularMarketVolume: volume,
      averageDailyVolume3Month: avgVolume,
      regularMarketChangePercent: 0,
    };
  }

  if (price <= 0) return null;

  return { ohlcv, effectiveQuote, price, volume, avgVolume, changePercent };
}

// ===== BIST MARKET OPEN CHECK =====
// BIST saatleri: Pazartesi-Cuma 10:00-18:00 İstanbul (UTC+3)
export function isBistMarketHours(): boolean {
  const now = new Date();
  // Istanbul UTC+3
  const utcHour = now.getUTCHours();
  const istanbulHour = (utcHour + 3) % 24;
  const day = now.getUTCDay(); // 0=Pazar, 6=Cumartesi
  // Hafta sonu kapalı
  if (day === 0 || day === 6) return false;
  // 10:00 - 18:00 İstanbul saati
  return istanbulHour >= 10 && istanbulHour < 18;
}

// ===== BATCH SIZE =====
export const SCAN_BATCH_SIZE = 8;
