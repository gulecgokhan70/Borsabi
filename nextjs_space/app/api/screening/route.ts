export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_TOP_STOCKS } from '@/lib/constants';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns, candlePatternScore, type CandlePattern } from '@/lib/candle-patterns';
import { cachedScan } from '@/lib/scan-cache';
import { calculateRSI, calculateEMA, calculateMACD, calculateATR, calculateVWAP, lastEMA } from '@/lib/technical-indicators';
import { processInBatches, fetchStockData, isBistMarketHours, SCAN_BATCH_SIZE } from '@/lib/scan-utils';


// ===== MASTER TRADER BİRLEŞİK TARAMA MOTORU =====

interface ScreenResult {
  dayTradeUygun: boolean;
  swingUygun: boolean;
  hacimPuan: number;
  trendPuan: number;
  momentumPuan: number;
  formasyonPuan: number;
  riskOdulPuan: number;
  totalScore: number;
  signals: string[];
  sapanDetected: boolean;
  dipBipDetected: boolean;
  formations: string[];
}

function screenStock(
  quote: any,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  rsi14: number,
  rsi5: number,
  macd: any,
  ema9Last: number,
  ema20Last: number,
  ema21Last: number,
  ema50Last: number,
  ema200Last: number,
  vwap: number,
  atr: number
): ScreenResult {
  const rawPrice = quote?.regularMarketPrice ?? 0;
  const price = rawPrice > 0 ? rawPrice : (quote?.regularMarketPreviousClose ?? 0);
  const rawVol = quote?.regularMarketVolume ?? 0;
  const volume = rawVol > 0 ? rawVol : (quote?.averageDailyVolume3Month ?? 0);
  const avgVolume = quote?.averageDailyVolume3Month ?? 0;
  const change = quote?.regularMarketChangePercent ?? 0;
  const signals: string[] = [];
  const formations: string[] = [];

  // === DAY TRADE FİLTRE ===
  const dayVolumeOk = avgVolume > 0 && volume > avgVolume;
  const dayVwapOk = price > vwap;
  const dayEmaOk = ema9Last > ema21Last;
  const dayRsiOk = rsi5 > 55;
  const dayMacdOk = (macd?.histogram ?? 0) > 0;
  const dayChangeOk = change > 1;
  const dayTradeUygun = dayVolumeOk && dayVwapOk && dayEmaOk && dayRsiOk && dayMacdOk && dayChangeOk;

  // === SWING FİLTRE ===
  const swingEma20Ok = price > ema20Last;
  const swingEmaOrderOk = ema20Last > ema50Last;
  const swingRsiOk = rsi14 >= 50 && rsi14 <= 70;
  const swingMacdOk = (macd?.histogram ?? 0) > 0;
  const swingVolumeOk = avgVolume > 0 && volume > avgVolume * 0.8;
  const swingUygun = swingEma20Ok && swingEmaOrderOk && swingRsiOk && swingMacdOk && swingVolumeOk;

  if (dayTradeUygun) signals.push('Day Trade Uygun');
  if (swingUygun) signals.push('Swing Uygun');

  // === SAPAN SİSTEMİ (Pullback to EMA20) ===
  let sapanDetected = false;
  if (closes.length >= 20) {
    const nearEma20 = Math.abs(price - ema20Last) / ema20Last < 0.02;
    const recentVols = volumes.slice(-5);
    const prevVols = volumes.slice(-10, -5);
    const recentAvg = recentVols.reduce((s: number, v: number) => s + v, 0) / (recentVols.length || 1);
    const prevAvg = prevVols.reduce((s: number, v: number) => s + v, 0) / (prevVols.length || 1);
    const volDecreasing = prevAvg > 0 && recentAvg < prevAvg * 0.85;
    const prevClose = closes[closes.length - 2] ?? 0;
    const greenCandle = price > prevClose;
    const rsiInRange = rsi14 >= 45 && rsi14 <= 60;
    if (nearEma20 && volDecreasing && greenCandle && rsiInRange) {
      sapanDetected = true;
      signals.push('Sapan Sistemi');
    }
  }

  // === DİP-BİP SİSTEMİ ===
  let dipBipDetected = false;
  if (closes.length >= 20) {
    const prevRsi = calculateRSI(closes.slice(0, -1));
    const rsiTurning = prevRsi < 35 && rsi14 > prevRsi;
    const macdTurning = (macd?.histogram ?? 0) > 0;
    const lastVol = volumes[volumes.length - 1] ?? 0;
    const prevAvgVol = volumes.slice(-10, -1).reduce((s: number, v: number) => s + v, 0) / 9;
    const volumeUp = prevAvgVol > 0 && lastVol > prevAvgVol * 1.1;
    const prevClose = closes[closes.length - 2] ?? 0;
    const strongGreen = price > prevClose && ((price - prevClose) / prevClose) * 100 > 0.5;
    const low20 = Math.min(...lows.slice(-20).filter((l: number) => l > 0));
    const nearSupport = low20 > 0 && price <= low20 * 1.05;
    const conditions = [rsiTurning, macdTurning, volumeUp, strongGreen, nearSupport];
    if (conditions.filter(Boolean).length >= 3) {
      dipBipDetected = true;
      signals.push('Dip-Bip Sistemi');
    }
  }

  // === FORMASYON TESPİTİ ===
  const len = closes.length;
  if (len >= 30) {
    const firstHalf = closes.slice(-30, -15);
    const secondHalf = closes.slice(-15);
    const firstAvg = firstHalf.reduce((s: number, v: number) => s + v, 0) / firstHalf.length;
    const midMin = Math.min(...closes.slice(-25, -5));
    const secondAvg = secondHalf.reduce((s: number, v: number) => s + v, 0) / secondHalf.length;
    if (firstAvg > midMin * 1.02 && secondAvg > midMin * 1.02 && secondAvg >= firstAvg * 0.97) {
      formations.push('Çanak');
    }
    const r15Lows = lows.slice(-15);
    const r15Highs = highs.slice(-15);
    const ftLow = Math.min(...r15Lows.slice(0, 5).filter((l: number) => l > 0));
    const ltLow = Math.min(...r15Lows.slice(-5).filter((l: number) => l > 0));
    const ftHigh = Math.max(...r15Highs.slice(0, 5));
    const ltHigh = Math.max(...r15Highs.slice(-5));
    if (ltLow > ftLow * 1.01 && Math.abs(ltHigh - ftHigh) / ftHigh < 0.02) {
      formations.push('Yükselen Üçgen');
    }
    const min1 = Math.min(...closes.slice(-30, -15).filter((c: number) => c > 0));
    const min2 = Math.min(...closes.slice(-15).filter((c: number) => c > 0));
    if (min1 > 0 && min2 > 0 && Math.abs(min1 - min2) / min1 < 0.03 && closes[len - 1] > Math.max(min1, min2) * 1.03) {
      formations.push('Çift Dip');
    }
  }
  if (formations.length > 0) signals.push(...formations.map((f: string) => `${f} Formasyonu`));

  // === 5 KATEGORİ PUANLAMA (Toplam 100P) ===
  let hacimPuan = 0;
  if (avgVolume > 0) {
    const volRatio = volume / avgVolume;
    if (volRatio > 2) hacimPuan = 20;
    else if (volRatio > 1.5) hacimPuan = 16;
    else if (volRatio > 1.2) hacimPuan = 12;
    else if (volRatio > 1) hacimPuan = 8;
    else if (volRatio > 0.8) hacimPuan = 4;
  }

  let trendPuan = 0;
  if (price > ema20Last) trendPuan += 5;
  if (price > ema50Last) trendPuan += 5;
  if (price > ema200Last) trendPuan += 4;
  if (ema20Last > ema50Last) trendPuan += 3;
  if (ema50Last > ema200Last) trendPuan += 3;

  let momentumPuan = 0;
  if (rsi14 >= 50 && rsi14 <= 70) momentumPuan += 8;
  else if (rsi14 < 30) momentumPuan += 10;
  if ((macd?.histogram ?? 0) > 0) momentumPuan += 6;
  if ((macd?.macd ?? 0) > (macd?.signal ?? 0)) momentumPuan += 6;

  let formasyonPuan = 0;
  if (sapanDetected) formasyonPuan += 10;
  if (dipBipDetected) formasyonPuan += 10;
  formasyonPuan += Math.min(10, formations.length * 5);
  formasyonPuan = Math.min(20, formasyonPuan);

  let riskOdulPuan = 0;
  const stopLevel = price - atr * 1.5;
  const targetLevel = price + atr * 3;
  const riskReward = stopLevel > 0 && price > stopLevel ? (targetLevel - price) / (price - stopLevel) : 0;
  if (riskReward >= 3) riskOdulPuan = 20;
  else if (riskReward >= 2.5) riskOdulPuan = 16;
  else if (riskReward >= 2) riskOdulPuan = 12;
  else if (riskReward >= 1.5) riskOdulPuan = 8;
  else if (riskReward >= 1) riskOdulPuan = 4;

  if (price > ema200Last) signals.push('EMA200 Üstü');
  if (change > 2) signals.push('Güçlü Yükseliiş');
  if (price > vwap) signals.push('VWAP Üstü');

  const totalScore = hacimPuan + trendPuan + momentumPuan + formasyonPuan + riskOdulPuan;

  return {
    dayTradeUygun,
    swingUygun,
    hacimPuan,
    trendPuan,
    momentumPuan,
    formasyonPuan,
    riskOdulPuan,
    totalScore: Math.min(100, Math.max(0, totalScore)),
    signals,
    sapanDetected,
    dipBipDetected,
    formations,
  };
}

async function runScreeningScan(): Promise<{ data: any[]; marketOpen: boolean }> {
    const results: any[] = [];

    let midasMap = new Map<string, MidasStock>();
    try {
      midasMap = await getMidasStockMap();
      if (midasMap.size > 0) console.log(`[Screening] Midas: ${midasMap.size} hisse`);
    } catch (e) {
      console.warn('[Screening] Midas başarısız, tam Yahoo fallback');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);

    const processStock = async (stock: any) => {
      try {
        const cleanSym = stock.symbol.replace('.IS', '').toUpperCase();
        const midasData = midasMap.get(cleanSym) || null;

        const data = await fetchStockData(
          cleanSym, stock.symbol, midasData,
          { period1: startDate, period2: endDate, interval: '1d' }
        );
        if (!data) return null;

        const { ohlcv, effectiveQuote, price, changePercent } = data;
        const { closes, highs, lows, volumes, candleData } = ohlcv;

        if (closes.length < 30) return null;

        // Mum formasyonları tespiti
        const candlePatterns = detectCandlePatterns(candleData);
        const cpScore = candlePatternScore(candlePatterns);

        const rsi14 = calculateRSI(closes, 14);
        const rsi5 = calculateRSI(closes, 5);
        const macd = calculateMACD(closes);
        const ema9 = calculateEMA(closes, 9);
        const ema20 = calculateEMA(closes, 20);
        const ema21 = calculateEMA(closes, 21);
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, Math.min(200, closes.length - 1));
        const atr = calculateATR(highs, lows, closes);
        const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));

        const ema9Last = ema9[ema9.length - 1] ?? 0;
        const ema20Last = ema20[ema20.length - 1] ?? 0;
        const ema21Last = ema21[ema21.length - 1] ?? 0;
        const ema50Last = ema50[ema50.length - 1] ?? 0;
        const ema200Last = ema200[ema200.length - 1] ?? 0;

        const result = screenStock(
          effectiveQuote, closes, highs, lows, volumes,
          rsi14, rsi5, macd,
          ema9Last, ema20Last, ema21Last, ema50Last, ema200Last,
          vwap, atr
        );

        const stopLevel = price - atr * 1.5;
        const target1 = price + atr * 2;
        const target2 = price + atr * 3;
        const riskReward = price > stopLevel ? (target1 - price) / (price - stopLevel) : 0;

        // Mum formasyonlarını sinyallere ve skora ekle
        if (candlePatterns.length > 0) {
          for (const cp of candlePatterns) {
            result.signals.push(`🕯 ${cp.name}`);
          }
          result.formasyonPuan = Math.min(20, result.formasyonPuan + Math.max(0, cpScore));
          result.totalScore = Math.min(100, result.hacimPuan + result.trendPuan + result.momentumPuan + result.formasyonPuan + result.riskOdulPuan);
        }

        const quality = result.totalScore >= 80 ? 'Elite' : result.totalScore >= 65 ? 'Güçlü' : result.totalScore >= 50 ? 'İzleme' : 'Zayıf';

        return {
          symbol: stock.shortName,
          yahooSymbol: stock.symbol,
          name: stock.name,
          price,
          change: changePercent,
          volume: data.volume,
          avgVolume: data.avgVolume,
          score: Math.round(result.totalScore),
          quality,
          signals: result.signals,
          dayTradeUygun: result.dayTradeUygun,
          swingUygun: result.swingUygun,
          sapanDetected: result.sapanDetected,
          dipBipDetected: result.dipBipDetected,
          formations: result.formations,
          candlePatterns: candlePatterns.map((cp: CandlePattern) => ({ name: cp.name, type: cp.type, strength: cp.strength })),
          candleScore: cpScore,
          hacimPuan: result.hacimPuan,
          trendPuan: result.trendPuan,
          momentumPuan: result.momentumPuan,
          formasyonPuan: result.formasyonPuan,
          riskOdulPuan: result.riskOdulPuan,
          rsi: Math.round(rsi14 * 10) / 10,
          macd: {
            macd: Math.round((macd?.macd ?? 0) * 100) / 100,
            signal: Math.round((macd?.signal ?? 0) * 100) / 100,
            histogram: Math.round((macd?.histogram ?? 0) * 100) / 100,
          },
          ema20: Math.round(ema20Last * 100) / 100,
          ema50: Math.round(ema50Last * 100) / 100,
          ema200: Math.round(ema200Last * 100) / 100,
          vwap: Math.round(vwap * 100) / 100,
          entry: price,
          stop: Math.round(stopLevel * 100) / 100,
          target: Math.round(target1 * 100) / 100,
          target2: Math.round(target2 * 100) / 100,
          riskReward: Math.round(riskReward * 100) / 100,
        };
      } catch (e: any) {
        console.error(`[Screening] ${stock?.shortName || stock?.symbol}: ${e?.message}`);
        return null;
      }
    };

    const allResults = await processInBatches(BIST_TOP_STOCKS as any[], SCAN_BATCH_SIZE, processStock);
    for (const r of allResults) {
      if (r) results.push(r);
    }

    results.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));
    const top10 = results.filter((r: any) => (r?.score ?? 0) >= 30).slice(0, 10);

    const marketOpen = isBistMarketHours();
    return { data: top10, marketOpen };
}

export async function GET(request: NextRequest) {
  try {
    const { result, cachedAt, fresh } = await cachedScan('screening', runScreeningScan);
    return NextResponse.json({ ...result, cachedAt, fresh });
  } catch (error: any) {
    console.error('Screening error:', error);
    return NextResponse.json({ error: 'Tarama yapılamadı' }, { status: 500 });
  }
}
