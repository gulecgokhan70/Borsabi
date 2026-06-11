export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_TOP_STOCKS } from '@/lib/constants';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns, candlePatternScore } from '@/lib/candle-patterns';
import { cachedScan } from '@/lib/scan-cache';
import { calculateRSI, calculateEMA, calculateMACD, calculateATR, calculateVWAP } from '@/lib/technical-indicators';
import { processInBatches, fetchStockData, isBistMarketHours, SCAN_BATCH_SIZE } from '@/lib/scan-utils';

// ===== MASTER TRADER DAY TRADE PUANLAMA SİSTEMİ =====

interface DayTradeScore {
  score: number;
  signals: string[];
  hacimPuan: number;
  trendPuan: number;
  momentumPuan: number;
  formasyonPuan: number;
  riskOdulPuan: number;
  passesFilter: boolean;
}

function scoreDayTrade(
  quote: any,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  rsi5: number,
  rsi14: number,
  macd: any,
  vwap: number,
  ema9: number,
  ema21: number,
  atr: number
): DayTradeScore {
  const signals: string[] = [];
  const rawPrice = quote?.regularMarketPrice ?? 0;
  const price = rawPrice > 0 ? rawPrice : (quote?.regularMarketPreviousClose ?? 0);
  const open = quote?.regularMarketOpen ?? price;
  const prevClose = quote?.regularMarketPreviousClose ?? price;
  const rawVol = quote?.regularMarketVolume ?? 0;
  const volume = rawVol > 0 ? rawVol : (quote?.averageDailyVolume3Month ?? 0);
  const avgVolume = quote?.averageDailyVolume3Month ?? 0;
  const dayChange = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

  // ===== FİLTRE KRİTERLERİ =====
  const volumeOk = avgVolume > 0 && volume > avgVolume;
  const vwapOk = vwap > 0 && price > vwap;
  const emaOk = ema9 > ema21;
  const rsi5Ok = rsi5 > 55;
  const macdOk = (macd?.macd ?? 0) > 0;
  const changeOk = dayChange > 1;
  const passesFilter = volumeOk && vwapOk && emaOk && rsi5Ok && macdOk && changeOk;

  // ===== 1. HACİM GÜCÜ (20 Puan) =====
  let hacimPuan = 0;
  const volumeRatio = avgVolume > 0 ? volume / avgVolume : 0;
  if (volumeRatio >= 3) { hacimPuan = 20; signals.push('🔥 Aşırı hacim patlaması (3x+)'); }
  else if (volumeRatio >= 2) { hacimPuan = 16; signals.push('Güçlü hacim (2x+)'); }
  else if (volumeRatio >= 1.5) { hacimPuan = 12; signals.push('Hacim artışı (1.5x)'); }
  else if (volumeRatio >= 1) { hacimPuan = 8; signals.push('Ortalama üstü hacim'); }
  else { hacimPuan = 3; }

  const last5Vol = volumes.slice(-5);
  const prev5Vol = volumes.slice(-10, -5);
  const avgLast5 = last5Vol.reduce((s: number, v: number) => s + v, 0) / (last5Vol.length || 1);
  const avgPrev5 = prev5Vol.reduce((s: number, v: number) => s + v, 0) / (prev5Vol.length || 1);
  if (avgPrev5 > 0 && avgLast5 > avgPrev5 * 1.3) {
    hacimPuan = Math.min(20, hacimPuan + 3);
    signals.push('Yakın dönem hacim ivmesi');
  }

  if (price > open && price > (highs[highs.length - 1] ?? 0) * 0.98) {
    hacimPuan = Math.min(20, hacimPuan + 2);
    signals.push('Güçlü alıcı baskısı');
  }

  // ===== 2. TREND GÜCÜ (20 Puan) =====
  let trendPuan = 0;
  if (ema9 > ema21) { trendPuan += 8; signals.push('EMA9 > EMA21 ✓'); }
  if (price > ema9) { trendPuan += 4; signals.push('Fiyat > EMA9'); }
  if (vwapOk) { trendPuan += 5; signals.push('VWAP üzerinde ✓'); }

  const gapPercent = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
  if (gapPercent > 1.5) { trendPuan += 3; signals.push(`Gap Up %${gapPercent.toFixed(1)}`); }
  else if (gapPercent > 0.5) { trendPuan += 1; }
  if (gapPercent < -1) { signals.push(`⚠️ Gap Down %${Math.abs(gapPercent).toFixed(1)}`); }
  trendPuan = Math.min(20, trendPuan);

  // ===== 3. MOMENTUM (20 Puan) =====
  let momentumPuan = 0;
  if (rsi5 >= 60 && rsi5 <= 75) { momentumPuan += 8; signals.push(`RSI(5): ${rsi5.toFixed(0)} - Güçlü momentum`); }
  else if (rsi5 >= 55 && rsi5 < 60) { momentumPuan += 5; signals.push(`RSI(5): ${rsi5.toFixed(0)} - Pozitif momentum`); }
  else if (rsi5 > 75) { momentumPuan += 3; signals.push(`⚠️ RSI(5): ${rsi5.toFixed(0)} - Aşırı alım dikkat`); }

  if ((macd?.histogram ?? 0) > 0 && (macd?.macd ?? 0) > (macd?.signal ?? 0)) {
    momentumPuan += 7; signals.push('MACD alış sinyali ✓');
  } else if ((macd?.histogram ?? 0) > 0) {
    momentumPuan += 4; signals.push('MACD pozitif');
  }

  if (dayChange > 3) { momentumPuan += 5; signals.push(`Günlük %${dayChange.toFixed(1)} güçlü yükseliiş`); }
  else if (dayChange > 1) { momentumPuan += 3; signals.push(`Günlük %${dayChange.toFixed(1)} yükseliiş ✓`); }
  momentumPuan = Math.min(20, momentumPuan);

  // ===== 4. TEKNİK FORMASYON (20 Puan) =====
  let formasyonPuan = 0;
  const last3 = closes.slice(-3);
  if (last3.length === 3 && last3[2] > last3[1] && last3[1] > last3[0]) {
    formasyonPuan += 6; signals.push('3 ardışık yükselen mum');
  }

  const lastClose = closes[closes.length - 1] ?? 0;
  const prevCloseCandle = closes[closes.length - 2] ?? 0;
  if (lastClose > prevCloseCandle && (lastClose - open) > Math.abs(prevCloseCandle - (closes[closes.length - 3] ?? prevCloseCandle)) * 1.2) {
    formasyonPuan += 5; signals.push('Boğa yutan formasyon');
  }

  const high20 = Math.max(...closes.slice(-20));
  if (price >= high20 * 0.99) {
    formasyonPuan += 5; signals.push('20 günlük zirve kırılımı');
  }

  const lowToday = quote?.regularMarketDayLow ?? 0;
  if (ema9 > 0 && lowToday > 0 && lowToday <= ema9 * 1.005 && price > ema9) {
    formasyonPuan += 4; signals.push('EMA9 desteğinden sekme');
  }
  formasyonPuan = Math.min(20, formasyonPuan);

  // ===== 5. RİSK/ÖDÜL ORANI (20 Puan) =====
  let riskOdulPuan = 0;
  const tavanLimit = prevClose > 0 ? prevClose * 1.10 : price * 1.10;
  const tabanLimit = prevClose > 0 ? prevClose * 0.90 : price * 0.90;
  const stopDistance = atr > 0 ? Math.min(atr * 1.5, price - tabanLimit) : price * 0.015;
  const stopLevel = Math.max(price - stopDistance, tabanLimit);
  let target1 = Math.min(price + (stopDistance * 2), tavanLimit);
  let target2 = Math.min(price + (stopDistance * 3), tavanLimit);
  if (target1 >= tavanLimit) {
    target1 = price + (tavanLimit - price) * 0.75;
    target2 = price + (tavanLimit - price) * 0.95;
  }
  const rr = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

  if (rr >= 3) { riskOdulPuan = 20; signals.push(`R:R ${rr.toFixed(1)} - Mükemmel`); }
  else if (rr >= 2.5) { riskOdulPuan = 16; signals.push(`R:R ${rr.toFixed(1)} - Çok iyi`); }
  else if (rr >= 2) { riskOdulPuan = 12; signals.push(`R:R ${rr.toFixed(1)} - İyi`); }
  else if (rr >= 1.5) { riskOdulPuan = 8; }
  else { riskOdulPuan = 4; }

  const totalScore = hacimPuan + trendPuan + momentumPuan + formasyonPuan + riskOdulPuan;

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    signals,
    hacimPuan, trendPuan, momentumPuan, formasyonPuan, riskOdulPuan,
    passesFilter,
  };
}

async function runDayTradingScan(): Promise<{ data: any[]; marketOpen: boolean }> {
    const results: any[] = [];

    let midasMap = new Map<string, MidasStock>();
    try {
      midasMap = await getMidasStockMap();
      if (midasMap.size > 0) console.log(`[DayTrade] Midas: ${midasMap.size} hisse`);
    } catch (e) {
      console.warn('[DayTrade] Midas başarısız, tam Yahoo fallback');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 3);

    const processStock = async (stock: any) => {
      try {
        const cleanSym = stock.symbol.replace('.IS', '').toUpperCase();
        const midasData = midasMap.get(cleanSym) || null;

        const data = await fetchStockData(
          cleanSym, stock.symbol, midasData,
          { period1: startDate, period2: endDate, interval: '1d' }
        );
        if (!data) return null;

        const { ohlcv, effectiveQuote, price } = data;
        const { closes, highs, lows, volumes, candleData } = ohlcv;

        if (closes.length < 26) return null;

        const candlePatterns = detectCandlePatterns(candleData);
        const cpScore = candlePatternScore(candlePatterns);

        const rsi5 = calculateRSI(closes, 5);
        const rsi14 = calculateRSI(closes, 14);
        const macd = calculateMACD(closes);
        const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
        const ema9 = calculateEMA(closes, 9);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(highs, lows, closes);

        const lastEma9 = ema9[ema9.length - 1] ?? 0;
        const lastEma21 = ema21[ema21.length - 1] ?? 0;

        const result = scoreDayTrade(
          effectiveQuote, closes, highs, lows, volumes,
          rsi5, rsi14, macd, vwap, lastEma9, lastEma21, atr
        );

        // Midas'tan gerçek tavan/taban
        const prevClose = effectiveQuote?.regularMarketPreviousClose ?? price;
        const midasTavan = midasData?.UpperLimit;
        const midasTaban = midasData?.LowerLimit;
        const tavanFiyat = midasTavan && midasTavan > 0 ? midasTavan : prevClose * 1.10;
        const tabanFiyat = midasTaban && midasTaban > 0 ? midasTaban : prevClose * 0.90;
        const stopDistance = atr > 0 ? Math.min(atr * 1.5, price - tabanFiyat) : price * 0.015;
        const stopLevel = Math.max(price - stopDistance, tabanFiyat);
        let target1 = Math.min(price + (stopDistance * 2), tavanFiyat);
        let target2 = Math.min(price + (stopDistance * 3), tavanFiyat);
        if (target1 >= tavanFiyat) {
          target1 = price + (tavanFiyat - price) * 0.75;
          target2 = price + (tavanFiyat - price) * 0.95;
        }
        const riskReward = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

        if (riskReward < 1.2) return null;

        if (candlePatterns.length > 0) {
          for (const cp of candlePatterns) {
            result.signals.push(`🕯 ${cp.name}`);
          }
          result.formasyonPuan = Math.min(20, result.formasyonPuan + Math.max(0, cpScore));
          result.score = Math.min(100, result.hacimPuan + result.trendPuan + result.momentumPuan + result.formasyonPuan + result.riskOdulPuan);
        }

        let quality = 'İşlem Yok';
        if (result.score >= 85) quality = 'Elite Kurulum';
        else if (result.score >= 70) quality = 'Güçlü Fırsat';
        else if (result.score >= 55) quality = 'İzlenebilir';
        else if (result.score >= 40) quality = 'Zayıf';

        return {
          symbol: stock.shortName,
          yahooSymbol: stock.symbol,
          name: stock.name,
          price,
          change: effectiveQuote?.regularMarketChangePercent ?? 0,
          volume: effectiveQuote?.regularMarketVolume ?? 0,
          avgVolume: effectiveQuote?.averageDailyVolume3Month ?? 0,
          open: effectiveQuote?.regularMarketOpen ?? 0,
          high: effectiveQuote?.regularMarketDayHigh ?? 0,
          low: effectiveQuote?.regularMarketDayLow ?? 0,
          score: Math.round(result.score),
          quality,
          signals: result.signals,
          candlePatterns: candlePatterns.map(cp => ({ name: cp.name, type: cp.type, strength: cp.strength })),
          passesFilter: result.passesFilter,
          hacimPuan: result.hacimPuan,
          trendPuan: result.trendPuan,
          momentumPuan: result.momentumPuan,
          formasyonPuan: result.formasyonPuan,
          riskOdulPuan: result.riskOdulPuan,
          entry: price,
          prevClose,
          tavan: Math.round(tavanFiyat * 100) / 100,
          taban: Math.round(tabanFiyat * 100) / 100,
          stop: Math.round(stopLevel * 100) / 100,
          target1: Math.round(target1 * 100) / 100,
          target2: Math.round(target2 * 100) / 100,
          riskReward: Math.round(riskReward * 100) / 100,
          rsi: Math.round(rsi5 * 10) / 10,
          rsi14: Math.round(rsi14 * 10) / 10,
          vwap: Math.round((midasData?.VWAP || vwap) * 100) / 100,
          macd: {
            macd: Math.round((macd?.macd ?? 0) * 100) / 100,
            signal: Math.round((macd?.signal ?? 0) * 100) / 100,
            histogram: Math.round((macd?.histogram ?? 0) * 100) / 100,
          },
        };
      } catch (e: any) {
        console.error(`[DayTrade] ${stock?.shortName || stock?.symbol}: ${e?.message}`);
        return null;
      }
    };

    const allResults = await processInBatches(BIST_TOP_STOCKS as any[], SCAN_BATCH_SIZE, processStock);
    for (const r of allResults) {
      if (r) results.push(r);
    }

    results.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));
    const filtered = results.filter((r: any) => r.score >= 40);
    const top10 = filtered.slice(0, 10);
    const marketOpen = isBistMarketHours();
    return { data: top10, marketOpen };
}

export async function GET(request: NextRequest) {
  try {
    const { result, cachedAt, fresh } = await cachedScan('day-trading', runDayTradingScan);
    return NextResponse.json({ ...result, cachedAt, fresh });
  } catch (error: any) {
    console.error('Day trading error:', error);
    return NextResponse.json({ error: 'Day trading taraması yapılamadı' }, { status: 500 });
  }
}
