export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cachedChart } from '@/lib/yahoo-finance';
import { BIST_TOP_STOCKS } from '@/lib/constants';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns, candlePatternScore, type CandleData, type CandlePattern } from '@/lib/candle-patterns';

// ===== CACHE =====
let cachedResult: any = null;
let cachedAt: number = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 saat

// ===== TEKNİK İNDİKATÖR HESAPLAMALARI =====

function calculateRSI(closes: number[], period = 14): number {
  if ((closes?.length ?? 0) < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = (closes.length) - period; i < closes.length; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push((data[i] * k) + (ema[i - 1] * (1 - k)));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - (ema26[i] ?? 0));
  const signalLine = calculateEMA(macdLine, 9);
  const lastIdx = macdLine.length - 1;
  return {
    macd: macdLine[lastIdx] ?? 0,
    signal: signalLine[lastIdx] ?? 0,
    histogram: (macdLine[lastIdx] ?? 0) - (signalLine[lastIdx] ?? 0),
  };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 0;
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      (highs[i] ?? 0) - (lows[i] ?? 0),
      Math.abs((highs[i] ?? 0) - (closes[i - 1] ?? 0)),
      Math.abs((lows[i] ?? 0) - (closes[i - 1] ?? 0))
    );
    trueRanges.push(tr);
  }
  const recent = trueRanges.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = ((highs[i] ?? 0) + (lows[i] ?? 0) + (closes[i] ?? 0)) / 3;
    cumTPV += tp * (volumes[i] ?? 0);
    cumVol += volumes[i] ?? 0;
  }
  return cumVol > 0 ? cumTPV / cumVol : 0;
}

// Destek/Direnç seviyeleri hesapla
function findSupportResistance(closes: number[], highs: number[], lows: number[]) {
  const len = closes.length;
  if (len < 20) return { support1: 0, support2: 0, resistance1: 0, resistance2: 0 };

  // Son 60 gün içindeki dip/tepe noktalarını bul
  const lookback = Math.min(60, len);
  const recentCloses = closes.slice(-lookback);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback).filter(l => l > 0);

  const currentPrice = closes[len - 1];

  // Pivot noktaları (classic)
  const h = Math.max(...recentHighs.slice(-5));
  const l = Math.min(...recentLows.slice(-5).filter(x => x > 0));
  const c = currentPrice;
  const pivot = (h + l + c) / 3;

  const support1 = (2 * pivot) - h;
  const support2 = pivot - (h - l);
  const resistance1 = (2 * pivot) - l;
  const resistance2 = pivot + (h - l);

  return { support1, support2, resistance1, resistance2, pivot };
}

// Son 5 günlük performans
function last5DayPerformance(closes: number[]): number {
  if (closes.length < 6) return 0;
  const current = closes[closes.length - 1];
  const fiveDaysAgo = closes[closes.length - 6];
  return fiveDaysAgo > 0 ? ((current - fiveDaysAgo) / fiveDaysAgo) * 100 : 0;
}

// ===== DAY TRADE ANALİZİ =====
function analyzeDayTrade(
  midas: MidasStock,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  candles: CandleData[]
) {
  const price = midas.Last || midas.Close;
  const prevClose = midas.PreviousClose;
  if (price <= 0 || prevClose <= 0) return null;

  const rsi5 = calculateRSI(closes, 5);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const atr = calculateATR(highs, lows, closes);
  const vwap = midas.VWAP || calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
  const last5 = last5DayPerformance(closes);
  const sr = findSupportResistance(closes, highs, lows);

  const lastEma9 = ema9[ema9.length - 1] ?? 0;
  const lastEma21 = ema21[ema21.length - 1] ?? 0;
  const lastEma20 = ema20[ema20.length - 1] ?? 0;
  const lastEma50 = ema50.length > 0 ? ema50[ema50.length - 1] : 0;

  const volume = midas.TotalVolume;
  const avgVolume = volumes.length > 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : volume;
  const volRatio = avgVolume > 0 ? volume / avgVolume : 1;
  const change = midas.DailyChangePercent;

  // === PUANLAMA (100 puan) ===
  let score = 0;
  const signals: string[] = [];

  // Hacim artışı (25P)
  if (volRatio > 2.5) { score += 25; signals.push('Çok Güçlü Hacim (' + volRatio.toFixed(1) + 'x)'); }
  else if (volRatio > 2) { score += 22; signals.push('Güçlü Hacim (' + volRatio.toFixed(1) + 'x)'); }
  else if (volRatio > 1.5) { score += 18; signals.push('Yüksek Hacim (' + volRatio.toFixed(1) + 'x)'); }
  else if (volRatio > 1.2) { score += 12; signals.push('Hacim Artışı'); }
  else if (volRatio > 1) { score += 6; }

  // RSI (15P)
  if (rsi14 >= 50 && rsi14 <= 65) { score += 15; signals.push('RSI İdeal (' + rsi14.toFixed(0) + ')'); }
  else if (rsi14 >= 40 && rsi14 < 50) { score += 10; signals.push('RSI Toparlanma (' + rsi14.toFixed(0) + ')'); }
  else if (rsi14 > 65 && rsi14 <= 75) { score += 8; }
  else if (rsi14 < 35) { score += 12; signals.push('Aşırı Satım (RSI ' + rsi14.toFixed(0) + ')'); }

  // MACD (15P)
  if (macd.histogram > 0 && macd.macd > macd.signal) { score += 15; signals.push('MACD Al Sinyali'); }
  else if (macd.histogram > 0) { score += 10; signals.push('MACD Pozitif'); }
  else if (macd.histogram > -0.1 && macd.macd > macd.signal) { score += 5; }

  // EMA20/EMA50 (15P)
  if (price > lastEma20 && lastEma20 > lastEma50) { score += 15; signals.push('EMA Dizilimi Güçlü'); }
  else if (price > lastEma20) { score += 10; signals.push('EMA20 Üstü'); }
  else if (price > lastEma50) { score += 5; }

  // Son 5 gün performans (15P)
  if (last5 > 5) { score += 15; signals.push('5G Güçlü +' + last5.toFixed(1) + '%'); }
  else if (last5 > 3) { score += 12; signals.push('5G İyi +' + last5.toFixed(1) + '%'); }
  else if (last5 > 1) { score += 8; signals.push('5G Pozitif'); }
  else if (last5 > 0) { score += 4; }

  // Destek/Direnç & VWAP (15P)
  if (price > vwap && sr.pivot && price > sr.pivot) { score += 15; signals.push('VWAP+Pivot Üstü'); }
  else if (price > vwap) { score += 10; signals.push('VWAP Üstü'); }
  else if (price > sr.support1) { score += 5; signals.push('Destek Yakını'); }

  // Mum formasyonları
  const candlePatterns = detectCandlePatterns(candles);
  const cpScore = candlePatternScore(candlePatterns);
  if (cpScore > 0) { score += Math.min(10, cpScore); signals.push(...candlePatterns.filter(p => p.type === 'bullish').map(p => '🕯 ' + p.name)); }
  else if (cpScore < 0) { score += Math.max(-5, cpScore); signals.push(...candlePatterns.filter(p => p.type === 'bearish').map(p => '🕯 ' + p.name)); }

  // Tavan/Taban limitleri
  const tavanFiyat = midas.UpperLimit > 0 ? midas.UpperLimit : prevClose * 1.10;
  const tabanFiyat = midas.LowerLimit > 0 ? midas.LowerLimit : prevClose * 0.90;

  // Giriş/Stop/Hedef hesapla
  const entry = price;
  const stopDistance = atr > 0 ? Math.min(atr * 1.5, price - tabanFiyat) : price * 0.015;
  const stopLoss = Math.max(Math.round((price - stopDistance) * 100) / 100, tabanFiyat);
  let target1 = Math.min(price + (stopDistance * 2), tavanFiyat);
  let target2 = Math.min(price + (stopDistance * 3), tavanFiyat);
  if (target1 >= tavanFiyat * 0.99) {
    target1 = price + (tavanFiyat - price) * 0.6;
    target2 = price + (tavanFiyat - price) * 0.9;
  }
  const riskReward = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

  // Minimum kriterleri
  if (riskReward < 1.2) return null;
  if (score < 40) return null;

  return {
    symbol: midas.Code,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    volume,
    volRatio: Math.round(volRatio * 100) / 100,
    score: Math.min(100, score),
    signals,
    rsi14: Math.round(rsi14 * 10) / 10,
    rsi5: Math.round(rsi5 * 10) / 10,
    macd: {
      macd: Math.round(macd.macd * 100) / 100,
      signal: Math.round(macd.signal * 100) / 100,
      histogram: Math.round(macd.histogram * 100) / 100,
    },
    ema20: Math.round(lastEma20 * 100) / 100,
    ema50: Math.round(lastEma50 * 100) / 100,
    vwap: Math.round(vwap * 100) / 100,
    last5Day: Math.round(last5 * 100) / 100,
    support: Math.round((sr.support1) * 100) / 100,
    resistance: Math.round((sr.resistance1) * 100) / 100,
    entry: Math.round(entry * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    target1: Math.round(target1 * 100) / 100,
    target2: Math.round(target2 * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
    tavan: Math.round(tavanFiyat * 100) / 100,
    taban: Math.round(tabanFiyat * 100) / 100,
    prevClose: Math.round(prevClose * 100) / 100,
    fk: midas.PriceEarning,
    pddd: midas.PriceBookValue,
    marketValue: midas.MarketValue,
    volatility: midas.Volatility,
    candlePatterns,
  };
}

// ===== SWING TRADE ANALİZİ =====
function analyzeSwingTrade(
  midas: MidasStock,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  candles: CandleData[]
) {
  const price = midas.Last || midas.Close;
  const prevClose = midas.PreviousClose;
  if (price <= 0 || closes.length < 50) return null;

  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, Math.min(200, closes.length - 1));
  const atr = calculateATR(highs, lows, closes);
  const last5 = last5DayPerformance(closes);
  const sr = findSupportResistance(closes, highs, lows);

  const lastEma20 = ema20[ema20.length - 1] ?? 0;
  const lastEma50 = ema50[ema50.length - 1] ?? 0;
  const lastEma200 = ema200.length > 0 ? ema200[ema200.length - 1] : 0;

  const volume = midas.TotalVolume;
  const avgVolume = volumes.length > 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : volume;
  const volRatio = avgVolume > 0 ? volume / avgVolume : 1;
  const change = midas.DailyChangePercent;

  // === PUANLAMA (100 puan) ===
  let score = 0;
  const signals: string[] = [];

  // Trend yönü (25P) - 50 ve 200 günlük ortalamalar
  if (price > lastEma50 && price > lastEma200 && lastEma50 > lastEma200) {
    score += 25; signals.push('Güçlü Yükseliş Trendi');
  } else if (price > lastEma50 && price > lastEma200) {
    score += 20; signals.push('Yükseliş Trendi');
  } else if (price > lastEma50) {
    score += 12; signals.push('EMA50 Üstü');
  } else if (price > lastEma200) {
    score += 8; signals.push('EMA200 Üstü');
  }

  // 50/200 günlük ortalamalar (20P)
  if (lastEma50 > lastEma200 * 1.02) {
    score += 20; signals.push('Golden Cross Aktif');
  } else if (lastEma50 > lastEma200) {
    score += 15; signals.push('EMA50>EMA200');
  } else if (lastEma50 > lastEma200 * 0.98) {
    score += 8; signals.push('Golden Cross Yakın');
  }

  // Hacim artışı (20P)
  if (volRatio > 2) { score += 20; signals.push('Güçlü Hacim Artışı'); }
  else if (volRatio > 1.5) { score += 16; signals.push('Hacim Artışı (' + volRatio.toFixed(1) + 'x)'); }
  else if (volRatio > 1.2) { score += 10; }
  else if (volRatio > 0.8) { score += 5; }

  // Kırılım potansiyeli (20P)
  const nearResistance = sr.resistance1 > 0 && price > sr.resistance1 * 0.97;
  const breakout = sr.resistance1 > 0 && price > sr.resistance1;
  if (breakout && volRatio > 1.3) {
    score += 20; signals.push('Kırılım Teyit (Hacimli)');
  } else if (breakout) {
    score += 15; signals.push('Direnç Kırılımı');
  } else if (nearResistance) {
    score += 10; signals.push('Kırılım Beklentisi');
  }
  // MACD bonus
  if (macd.histogram > 0 && macd.macd > macd.signal) {
    score += 5; signals.push('MACD Pozitif');
  }
  // RSI sağlık kontrolü
  if (rsi14 >= 50 && rsi14 <= 70) {
    score += 5; signals.push('RSI Sağlıklı');
  }

  // Mum formasyonları
  const candlePatterns = detectCandlePatterns(candles);
  const cpScore = candlePatternScore(candlePatterns);
  if (cpScore > 0) { score += Math.min(10, cpScore); signals.push(...candlePatterns.filter(p => p.type === 'bullish').map(p => '🕯 ' + p.name)); }
  else if (cpScore < 0) { score += Math.max(-5, cpScore); signals.push(...candlePatterns.filter(p => p.type === 'bearish').map(p => '🕯 ' + p.name)); }

  // Risk/Getiri oranı (15P) - hesapla ve puanla
  const stopDistance = atr > 0 ? atr * 2 : price * 0.03;
  const stopLoss = price - stopDistance;
  const target1 = price + (stopDistance * 2);
  const target2 = price + (stopDistance * 3.5);
  const riskReward = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

  if (riskReward >= 3) { score += 15; }
  else if (riskReward >= 2.5) { score += 12; }
  else if (riskReward >= 2) { score += 8; }
  else if (riskReward >= 1.5) { score += 5; }

  if (riskReward < 1.5) return null;
  if (score < 35) return null;

  // Holding süresi tahmini
  let holdingPeriod = '1-2 hafta';
  if (score >= 80) holdingPeriod = '2-4 hafta';
  else if (score >= 60) holdingPeriod = '1-3 hafta';
  else holdingPeriod = '3-7 gün';

  return {
    symbol: midas.Code,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    volume,
    volRatio: Math.round(volRatio * 100) / 100,
    score: Math.min(100, score),
    signals,
    rsi14: Math.round(rsi14 * 10) / 10,
    macd: {
      macd: Math.round(macd.macd * 100) / 100,
      signal: Math.round(macd.signal * 100) / 100,
      histogram: Math.round(macd.histogram * 100) / 100,
    },
    ema50: Math.round(lastEma50 * 100) / 100,
    ema200: Math.round(lastEma200 * 100) / 100,
    last5Day: Math.round(last5 * 100) / 100,
    support: Math.round((sr.support1) * 100) / 100,
    resistance: Math.round((sr.resistance1) * 100) / 100,
    entry: Math.round(price * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    target1: Math.round(target1 * 100) / 100,
    target2: Math.round(target2 * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
    holdingPeriod,
    prevClose: Math.round(prevClose * 100) / 100,
    trendDirection: price > lastEma50 && lastEma50 > lastEma200 ? 'Yükseliş' : price > lastEma50 ? 'Nötr-Pozitif' : 'Nötr-Negatif',
    fk: midas.PriceEarning,
    pddd: midas.PriceBookValue,
    marketValue: midas.MarketValue,
    volatility: midas.Volatility,
    candlePatterns,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Önbellekten dön
    const { searchParams } = new URL(request.url);
    const wantCached = searchParams.get('cached') === 'true';
    if (wantCached) {
      if (cachedResult && (Date.now() - cachedAt) < CACHE_TTL) {
        return NextResponse.json(cachedResult);
      }
      return NextResponse.json({ error: 'no_cache' });
    }

    // 1) Midas'tan tüm BIST verilerini al
    let midasMap = new Map<string, MidasStock>();
    try {
      midasMap = await getMidasStockMap();
      console.log(`[AksamAnalizi] Midas: ${midasMap.size} hisse`);
    } catch (e) {
      console.error('[AksamAnalizi] Midas başarısız');
      return NextResponse.json({ error: 'Piyasa verileri alınamadı' }, { status: 500 });
    }

    if (midasMap.size === 0) {
      return NextResponse.json({ error: 'Midas verisi boş' }, { status: 500 });
    }

    // 2) BIST_TOP_STOCKS için chart verilerini çek
    const dayResults: any[] = [];
    const swingResults: any[] = [];
    let analyzed = 0;

    const promises = BIST_TOP_STOCKS.map(async (stock: any) => {
      try {
        const cleanSym = stock.symbol.replace('.IS', '').toUpperCase();
        const midasData = midasMap.get(cleanSym);
        if (!midasData || (midasData.Last <= 0 && midasData.Close <= 0)) return;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);

        const chart = await cachedChart(stock.symbol, {
          period1: startDate,
          period2: endDate,
          interval: '1d' as any,
        }).catch(() => null);

        if (!chart) return;

        const quotes = chart?.quotes ?? [];
        const closes = quotes.map((q: any) => q?.close ?? 0).filter((c: number) => c > 0);
        const highs = quotes.map((q: any) => q?.high ?? 0);
        const lows = quotes.map((q: any) => q?.low ?? 0);
        const volumes = quotes.map((q: any) => q?.volume ?? 0);

        if (closes.length < 30) return;
        analyzed++;

        // Mum verileri oluştur
        const candles: CandleData[] = quotes.filter((q: any) => q?.open > 0 && q?.close > 0).map((q: any) => ({
          open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume ?? 0
        }));

        // Day Trade analizi
        const dayResult = analyzeDayTrade(midasData, closes, highs, lows, volumes, candles);
        if (dayResult) {
          (dayResult as any).name = stock.name;
          dayResults.push(dayResult);
        }

        // Swing Trade analizi
        if (closes.length >= 50) {
          const swingResult = analyzeSwingTrade(midasData, closes, highs, lows, volumes, candles);
          if (swingResult) {
            (swingResult as any).name = stock.name;
            swingResults.push(swingResult);
          }
        }
      } catch (e) {
        // Sessiz geç
      }
    });

    await Promise.allSettled(promises);

    // 3) Puanlara göre sırala, en iyi 10'u al
    dayResults.sort((a, b) => b.score - a.score);
    swingResults.sort((a, b) => b.score - a.score);

    const top10Day = dayResults.slice(0, 10);
    const top10Swing = swingResults.slice(0, 10);

    // 4) Analiz zamanı
    const now = new Date();
    const analizZamani = now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

    const result = {
      analizZamani,
      tarananHisse: analyzed,
      toplamDayTrade: dayResults.length,
      toplamSwing: swingResults.length,
      dayTrade: top10Day,
      swingTrade: top10Swing,
    };

    // Sonucu önbelleğe al
    cachedResult = result;
    cachedAt = Date.now();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Akşam analizi error:', error);
    return NextResponse.json({ error: 'Analiz yapılamadı: ' + (error?.message || 'Bilinmeyen hata') }, { status: 500 });
  }
}
