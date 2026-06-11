/**
 * Midas API Client
 * Primary data source for BIST stocks
 * https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data
 * 
 * - API key gerektirmez (public endpoint)
 * - User-Agent header gerekli
 * - Yanıt JSON-in-JSON olarak gelebilir (double parse)
 * - Hisse verileri ~15 dk gecikmeli
 * - Döviz verileri neredeyse anlık
 */

export interface MidasStock {
  _id: string;
  Code: string;
  Open: number;
  High: number;
  Low: number;
  Last: number;
  Close: number;
  PreviousClose: number;
  DateTime: number;
  DailyChange: number;
  DailyChangePercent: number;
  TotalVolume: number;
  TotalTurnover: number;
  Ask: number;
  Bid: number;
  VWAP: number;
  YearlyChange: number;
  LowerLimit: number; // Taban fiyat
  WOWHigh: number;    // Haftalık yüksek
  MOMHigh: number;    // Aylık yüksek
  PriceEarning: number; // F/K oranı
  FreeFloatRate: number;
  UpperLimit: number; // Tavan fiyat
  WOWLow: number;     // Haftalık düşük
  MOMLow: number;     // Aylık düşük
  MarketValue: number;
  NetProfit: number;
  Capital: number;
  PriceBookValue: number; // PD/DD
  ReturnOnEquity: number;
  WeeklyChange: number;
  WeeklyChangePercent: number;
  MonthlyChange: number;
  MonthlyChangePercent: number;
  YearlyChangePercent: number;
  Volatility: number;
}

export interface MidasForex {
  _id: string;
  Code: string;
  Open: number;
  High: number;
  Low: number;
  Last: number;
  Close: number;
  PreviousClose: number;
  DateTime: number;
  DailyChange: number;
  DailyChangePercent: number;
  Ask: number;
  Bid: number;
  YearlyChange: number;
  WOWHigh: number;
  MOMHigh: number;
  WOWLow: number;
  MOMLow: number;
  WeeklyChange: number;
  WeeklyChangePercent: number;
  MonthlyChange: number;
  MonthlyChangePercent: number;
  YearlyChangePercent: number;
  Volatility?: number;
}

const MIDAS_BASE = 'https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Cache
const STOCK_CACHE_TTL = 180_000; // 3 dakika
const FOREX_CACHE_TTL = 30_000; // 30 saniye (döviz daha sık güncellenir)

let stockCache: { data: MidasStock[]; ts: number } | null = null;
let forexCache: { data: MidasForex[]; ts: number } | null = null;

/**
 * Midas API'den ham veri çeker
 * Yanıt bazen JSON-in-JSON olarak gelir, double parse gerekli
 */
async function fetchMidas<T>(endpoint: string): Promise<T[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  let res: Response;
  try {
    res = await fetch(endpoint, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Midas API error: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  if (!text || text.trim() === '' || text.trim() === '""' || text.trim() === '[]') {
    return [];
  }

  try {
    // İlk parse
    let parsed = JSON.parse(text);
    // Eğer string olarak geldiyse (JSON-in-JSON), tekrar parse et
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Midas API parse error:', e);
    return [];
  }
}

/**
 * Tüm BIST hisse verilerini getirir (cached)
 */
export async function getMidasStocks(): Promise<MidasStock[]> {
  const now = Date.now();
  if (stockCache && (now - stockCache.ts) < STOCK_CACHE_TTL) {
    return stockCache.data;
  }

  try {
    const data = await fetchMidas<MidasStock>(`${MIDAS_BASE}?sortId=&return=table`);
    if (data.length > 0) {
      stockCache = { data, ts: now };
      console.log(`[Midas] ${data.length} hisse verisi güncellendi`);
      return data;
    }
  } catch (e) {
    console.error('[Midas] Hisse verisi alınamadı:', e);
  }

  // Stale cache fallback
  if (stockCache) {
    console.log('[Midas] Stale cache kullanılıyor (hisse)');
    return stockCache.data;
  }
  return [];
}

/**
 * Tüm döviz verilerini getirir (cached)
 */
export async function getMidasForex(): Promise<MidasForex[]> {
  const now = Date.now();
  if (forexCache && (now - forexCache.ts) < FOREX_CACHE_TTL) {
    return forexCache.data;
  }

  try {
    const data = await fetchMidas<MidasForex>(`${MIDAS_BASE}?sortId=&return=doviz`);
    if (data.length > 0) {
      forexCache = { data, ts: now };
      console.log(`[Midas] ${data.length} döviz verisi güncellendi`);
      return data;
    }
  } catch (e) {
    console.error('[Midas] Döviz verisi alınamadı:', e);
  }

  if (forexCache) {
    console.log('[Midas] Stale cache kullanılıyor (döviz)');
    return forexCache.data;
  }
  return [];
}

/**
 * Belirli bir hissenin Midas verisini getirir
 */
export async function getMidasStock(symbol: string): Promise<MidasStock | null> {
  const stocks = await getMidasStocks();
  // Midas Code alanı sadece sembol (THYAO), Yahoo'da THYAO.IS formatında
  const cleanSymbol = symbol.replace('.IS', '').toUpperCase();
  return stocks.find(s => s.Code === cleanSymbol) || null;
}

/**
 * Birden fazla hisse için Midas verisini Map olarak döner
 * Key: symbol (Code alanı, örn: "THYAO")
 */
export async function getMidasStockMap(): Promise<Map<string, MidasStock>> {
  const stocks = await getMidasStocks();
  const map = new Map<string, MidasStock>();
  for (const s of stocks) {
    map.set(s.Code, s);
  }
  return map;
}

/**
 * Midas verisinden Yahoo Finance quote benzeri obje oluşturur
 * Mevcut kodla uyumluluk için
 */
export function midasToQuote(m: MidasStock) {
  return {
    symbol: `${m.Code}.IS`,
    regularMarketPrice: m.Last || m.Close,
    regularMarketOpen: m.Open,
    regularMarketDayHigh: m.High,
    regularMarketDayLow: m.Low,
    regularMarketVolume: m.TotalVolume,
    regularMarketPreviousClose: m.PreviousClose,
    regularMarketChange: m.DailyChange,
    regularMarketChangePercent: m.DailyChangePercent,
    bid: m.Bid,
    ask: m.Ask,
    // Midas'tan gelen ekstra veriler
    _midas: {
      vwap: m.VWAP,
      tavan: m.UpperLimit,
      taban: m.LowerLimit,
      fk: m.PriceEarning,
      pddd: m.PriceBookValue,
      marketValue: m.MarketValue,
      netProfit: m.NetProfit,
      freeFloat: m.FreeFloatRate,
      roe: m.ReturnOnEquity,
      volatility: m.Volatility,
      weeklyHigh: m.WOWHigh,
      weeklyLow: m.WOWLow,
      monthlyHigh: m.MOMHigh,
      monthlyLow: m.MOMLow,
      weeklyChangePercent: m.WeeklyChangePercent,
      monthlyChangePercent: m.MonthlyChangePercent,
      yearlyChangePercent: m.YearlyChangePercent,
    }
  };
}
