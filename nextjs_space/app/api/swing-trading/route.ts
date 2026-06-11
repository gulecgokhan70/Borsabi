export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_TOP_STOCKS } from '@/lib/constants';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns, candlePatternScore } from '@/lib/candle-patterns';
import { cachedScan } from '@/lib/scan-cache';
import { calculateRSI, calculateEMA, calculateMACD, calculateATR } from '@/lib/technical-indicators';
import { processInBatches, fetchStockData, isBistMarketHours, SCAN_BATCH_SIZE } from '@/lib/scan-utils';

// ===== SAPAN SİSTEMİ =====
function detectSapan(
  closes: number[], volumes: number[], ema20: number[], ema50: number[],
  rsi: number, price: number
): { detected: boolean; strength: number } {
  const len = closes.length;
  if (len < 25) return { detected: false, strength: 0 };

  const lastEma20 = ema20[ema20.length - 1] ?? 0;
  const lastEma50 = ema50[ema50.length - 1] ?? 0;
  const prevClose = closes[len - 2] ?? 0;

  const aboveEma20 = price >= lastEma20 * 0.995;
  const ema20AboveEma50 = lastEma20 > lastEma50;
  const recentLows = closes.slice(-5);
  const pullbackToEma20 = recentLows.some((c: number) => c <= lastEma20 * 1.01 && c >= lastEma20 * 0.98);
  const vol3 = volumes.slice(-3).reduce((s: number, v: number) => s + v, 0) / 3;
  const vol10 = volumes.slice(-10, -3).reduce((s: number, v: number) => s + v, 0) / Math.max(1, volumes.slice(-10, -3).length);
  const volumeDecreased = vol10 > 0 && vol3 < vol10 * 0.85;
  const greenCandle = price > prevClose;
  const rsiOk = rsi >= 45 && rsi <= 60;

  const conditions = [aboveEma20, ema20AboveEma50, pullbackToEma20, volumeDecreased, greenCandle, rsiOk];
  const metCount = conditions.filter(Boolean).length;

  return { detected: metCount >= 5, strength: Math.round((metCount / 6) * 100) };
}

// ===== DİP-BİP SİSTEMİ =====
function detectDipBip(
  closes: number[], volumes: number[], rsi: number, prevRsi: number,
  macd: any, price: number, lows: number[]
): { detected: boolean; strength: number } {
  const len = closes.length;
  if (len < 20) return { detected: false, strength: 0 };

  const rsiTurning = prevRsi < 35 && rsi > prevRsi;
  const macdTurning = (macd?.prevHistogram ?? 0) < 0 && (macd?.histogram ?? 0) > (macd?.prevHistogram ?? 0);
  const lastVol = volumes[volumes.length - 1] ?? 0;
  const prevAvgVol = volumes.slice(-10, -1).reduce((s: number, v: number) => s + v, 0) / Math.max(1, volumes.slice(-10, -1).length);
  const volumeUp = prevAvgVol > 0 && lastVol > prevAvgVol * 1.1;
  const prevClose = closes[len - 2] ?? 0;
  const strongGreen = price > prevClose && ((price - prevClose) / prevClose) * 100 > 0.5;
  const validLows = lows.slice(-20).filter((l: number) => l > 0);
  const low20 = validLows.length > 0 ? Math.min(...validLows) : 0;
  const nearSupport = low20 > 0 && price <= low20 * 1.05;

  const conditions = [rsiTurning, macdTurning, volumeUp, strongGreen, nearSupport];
  const metCount = conditions.filter(Boolean).length;

  return { detected: metCount >= 3, strength: Math.round((metCount / 5) * 100) };
}

// ===== FORMASYON TESPİTİ =====
function detectFormations(closes: number[], highs: number[], lows: number[]): string[] {
  const formations: string[] = [];
  const len = closes.length;
  if (len < 30) return formations;

  const firstHalf = closes.slice(-30, -15);
  const secondHalf = closes.slice(-15);
  const firstAvg = firstHalf.reduce((s: number, v: number) => s + v, 0) / firstHalf.length;
  const midMin = Math.min(...closes.slice(-25, -5));
  const secondAvg = secondHalf.reduce((s: number, v: number) => s + v, 0) / secondHalf.length;
  if (firstAvg > midMin * 1.02 && secondAvg > midMin * 1.02 && secondAvg >= firstAvg * 0.97) {
    formations.push('Çanak Formasyonu');
  }

  const recent15Lows = lows.slice(-15);
  const recent15Highs = highs.slice(-15);
  const firstThirdLow = Math.min(...recent15Lows.slice(0, 5).filter((l: number) => l > 0));
  const lastThirdLow = Math.min(...recent15Lows.slice(-5).filter((l: number) => l > 0));
  const firstThirdHigh = Math.max(...recent15Highs.slice(0, 5));
  const lastThirdHigh = Math.max(...recent15Highs.slice(-5));
  if (firstThirdLow > 0 && lastThirdLow > firstThirdLow * 1.01 && Math.abs(lastThirdHigh - firstThirdHigh) / firstThirdHigh < 0.02) {
    formations.push('Yükselen Üçgen');
  }

  const min1 = Math.min(...closes.slice(-30, -15).filter((c: number) => c > 0));
  const min2 = Math.min(...closes.slice(-15).filter((c: number) => c > 0));
  if (min1 > 0 && min2 > 0 && Math.abs(min1 - min2) / min1 < 0.03 && closes[len - 1] > Math.max(min1, min2) * 1.03) {
    formations.push('Çift Dip');
  }

  return formations;
}

// ===== SWING TRADE PUANLAMA =====
interface SwingTradeScore {
  score: number;
  signals: string[];
  sapanDetected: boolean;
  dipBipDetected: boolean;
  formations: string[];
  passesFilter: boolean;
  hacimPuan: number;
  trendPuan: number;
  momentumPuan: number;
  formasyonPuan: number;
  riskOdulPuan: number;
}

function scoreSwingTrade(
  closes: number[], highs: number[], lows: number[], volumes: number[],
  rsi: number, macd: any,
  ema20Arr: number[], ema50Arr: number[],
  price: number, volume: number, avgVolume: number, atr: number
): SwingTradeScore {
  const signals: string[] = [];
  const len = closes.length;

  const lastEma20 = ema20Arr[ema20Arr.length - 1] ?? 0;
  const lastEma50 = ema50Arr[ema50Arr.length - 1] ?? 0;

  const aboveEma20 = price > lastEma20;
  const ema20AboveEma50 = lastEma20 > lastEma50;
  const rsiOk = rsi >= 50 && rsi <= 70;
  const macdPositive = (macd?.macd ?? 0) > 0;
  const volumeAboveAvg = avgVolume > 0 && volume > avgVolume;
  const passesFilter = aboveEma20 && ema20AboveEma50 && rsiOk && macdPositive && volumeAboveAvg;

  let hacimPuan = 0, trendPuan = 0, momentumPuan = 0, formasyonPuan = 0, riskOdulPuan = 0;

  // === TREND (25 Puan) ===
  if (aboveEma20) { trendPuan += 8; signals.push('EMA20 üzerinde ✓'); }
  if (ema20AboveEma50) { trendPuan += 8; signals.push('EMA20 > EMA50 ✓'); }
  const ema200Arr = calculateEMA(closes, Math.min(200, len - 1));
  const lastEma200 = ema200Arr[ema200Arr.length - 1] ?? 0;
  if (price > lastEma200) { trendPuan += 5; signals.push('EMA200 üzerinde'); }
  const recent20 = closes.slice(-20);
  const first10Avg = recent20.slice(0, 10).reduce((s: number, v: number) => s + v, 0) / 10;
  const last10Avg = recent20.slice(-10).reduce((s: number, v: number) => s + v, 0) / 10;
  if (last10Avg > first10Avg) { trendPuan += 4; signals.push('Yükselen trend'); }
  trendPuan = Math.min(25, trendPuan);

  // === MOMENTUM (20 Puan) ===
  if (rsiOk) { momentumPuan += 8; signals.push(`RSI(14): ${rsi.toFixed(0)} - Trend bölgesi ✓`); }
  else if (rsi > 70) { signals.push(`⚠️ RSI(14): ${rsi.toFixed(0)} - Aşırı alım`); }
  else if (rsi < 50 && rsi > 30) { momentumPuan += 3; signals.push(`RSI(14): ${rsi.toFixed(0)}`); }
  if (macdPositive) { momentumPuan += 6; signals.push('MACD pozitif ✓'); }
  if ((macd?.histogram ?? 0) > 0 && (macd?.macd ?? 0) > (macd?.signal ?? 0)) {
    momentumPuan += 6; signals.push('MACD alış sinyali');
  }
  momentumPuan = Math.min(20, momentumPuan);

  // === HACİM (15 Puan) ===
  if (volumeAboveAvg) {
    const vRatio = avgVolume > 0 ? volume / avgVolume : 0;
    if (vRatio >= 2) { hacimPuan += 15; signals.push('Güçlü hacim patlaması (2x+)'); }
    else if (vRatio >= 1.5) { hacimPuan += 10; signals.push('Hacim artışı (1.5x)'); }
    else { hacimPuan += 6; signals.push('Ortalama üstü hacim ✓'); }
  }

  // === SAPAN SİSTEMİ (10 Puan) ===
  const prevRsiCloses = closes.slice(0, -1);
  const prevRsi = prevRsiCloses.length > 14 ? calculateRSI(prevRsiCloses) : rsi;
  const sapan = detectSapan(closes, volumes, ema20Arr, ema50Arr, rsi, price);
  if (sapan.detected) {
    formasyonPuan += 10; signals.push(`🎯 Sapan Sinyali (Güç: %${sapan.strength})`);
  } else if (sapan.strength >= 50) {
    formasyonPuan += 4; signals.push(`Sapan oluşumu başlıyor (%${sapan.strength})`);
  }

  // === DİP-BİP SİSTEMİ (10 Puan) ===
  const dipBip = detectDipBip(closes, volumes, rsi, prevRsi, macd, price, lows);
  if (dipBip.detected) {
    formasyonPuan += 10; signals.push(`🟢 Dip-Bip Sinyali (Güç: %${dipBip.strength})`);
  } else if (dipBip.strength >= 40) {
    formasyonPuan += 3; signals.push(`Dip-Bip oluşumu (%${dipBip.strength})`);
  }

  // === FORMASYON (10 Puan) ===
  const formations = detectFormations(closes, highs, lows);
  if (formations.length > 0) {
    formasyonPuan += Math.min(10, formations.length * 5);
    formations.forEach((f: string) => signals.push(`📊 ${f}`));
  }
  formasyonPuan = Math.min(20, formasyonPuan);

  // === RİSK/ÖDÜL (15 Puan) — DÜZELTİLDİ: gerçek hesaplama ===
  const high20 = Math.max(...closes.slice(-20));
  if (price >= high20 * 0.98) {
    riskOdulPuan += 5; signals.push('20 günlük zirveye yakın');
  }
  if (atr > 0 && price > 0) {
    // Swing R:R: stop = 2*ATR, hedef = 4*ATR → R:R = 2:1
    const swingStop = atr * 2;
    const swingTarget = atr * 4;
    const swingRR = swingStop > 0 ? swingTarget / swingStop : 0;
    if (swingRR >= 2) riskOdulPuan += 10;
    else if (swingRR >= 1.5) riskOdulPuan += 7;
    else riskOdulPuan += 4;
  }
  riskOdulPuan = Math.min(15, riskOdulPuan);

  const score = hacimPuan + trendPuan + momentumPuan + formasyonPuan + riskOdulPuan;

  return {
    score: Math.min(100, Math.max(0, score)),
    signals,
    sapanDetected: sapan.detected,
    dipBipDetected: dipBip.detected,
    formations,
    passesFilter,
    hacimPuan, trendPuan, momentumPuan, formasyonPuan, riskOdulPuan,
  };
}

async function runSwingTradingScan(): Promise<{ data: any[]; marketOpen: boolean }> {
    const results: any[] = [];

    let midasMap = new Map<string, MidasStock>();
    try {
      midasMap = await getMidasStockMap();
      if (midasMap.size > 0) console.log(`[SwingTrade] Midas: ${midasMap.size} hisse`);
    } catch (e) {
      console.warn('[SwingTrade] Midas başarısız, tam Yahoo fallback');
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

        const { ohlcv, price, volume, avgVolume, changePercent } = data;
        const { closes, highs, lows, volumes, candleData } = ohlcv;

        if (closes.length < 50) return null;

        const candlePatterns = detectCandlePatterns(candleData);
        const cpScore = candlePatternScore(candlePatterns);

        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const ema20Arr = calculateEMA(closes, 20);
        const ema50Arr = calculateEMA(closes, 50);
        const ema200Arr = calculateEMA(closes, Math.min(200, closes.length - 1));
        const atr = calculateATR(highs, lows, closes);

        const lastEma20 = ema20Arr[ema20Arr.length - 1] ?? 0;
        const lastEma50 = ema50Arr[ema50Arr.length - 1] ?? 0;
        const lastEma200 = ema200Arr[ema200Arr.length - 1] ?? 0;

        const result = scoreSwingTrade(
          closes, highs, lows, volumes,
          rsi, macd, ema20Arr, ema50Arr,
          price, volume, avgVolume, atr
        );

        // Risk yönetimi
        const stopDistance = atr > 0 ? atr * 2 : price * 0.03;
        const stopLevel = price - stopDistance;
        const target1 = price + (stopDistance * 2);
        const target2 = price + (stopDistance * 3);
        const riskReward = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

        if (riskReward < 1.5) return null;

        if (candlePatterns.length > 0) {
          for (const cp of candlePatterns) {
            result.signals.push(`🕯 ${cp.name}`);
          }
          result.formasyonPuan = Math.min(20, result.formasyonPuan + Math.max(0, cpScore));
          result.score = Math.min(100, result.hacimPuan + result.trendPuan + result.momentumPuan + result.formasyonPuan + result.riskOdulPuan);
        }

        let quality = 'İşlem Yok';
        if (result.score >= 80) quality = 'Elite Kurulum';
        else if (result.score >= 65) quality = 'Güçlü Kurulum';
        else if (result.score >= 50) quality = 'İzleme Listesi';
        else if (result.score >= 35) quality = 'Zayıf';

        let holdingPeriod = '1-2 hafta';
        if (result.score >= 80) holdingPeriod = '2-4 hafta';
        else if (result.score >= 65) holdingPeriod = '1-3 hafta';
        else if (result.score < 50) holdingPeriod = '3-5 gün';

        return {
          symbol: stock.shortName,
          yahooSymbol: stock.symbol,
          name: stock.name,
          price,
          change: changePercent,
          volume,
          avgVolume,
          score: Math.round(result.score),
          quality,
          signals: result.signals,
          candlePatterns: candlePatterns.map(cp => ({ name: cp.name, type: cp.type, strength: cp.strength })),
          passesFilter: result.passesFilter,
          sapanDetected: result.sapanDetected,
          dipBipDetected: result.dipBipDetected,
          formations: result.formations,
          entryZone: {
            low: Math.round((price * 0.99) * 100) / 100,
            high: Math.round((price * 1.005) * 100) / 100,
          },
          stop: Math.round(stopLevel * 100) / 100,
          target1: Math.round(target1 * 100) / 100,
          target2: Math.round(target2 * 100) / 100,
          holdingPeriod,
          riskReward: Math.round(riskReward * 100) / 100,
          rsi: Math.round(rsi * 10) / 10,
          atr: Math.round(atr * 100) / 100,
          ema20: Math.round(lastEma20 * 100) / 100,
          ema50: Math.round(lastEma50 * 100) / 100,
          ema200: Math.round(lastEma200 * 100) / 100,
          macd: {
            macd: Math.round((macd?.macd ?? 0) * 100) / 100,
            signal: Math.round((macd?.signal ?? 0) * 100) / 100,
            histogram: Math.round((macd?.histogram ?? 0) * 100) / 100,
          },
        };
      } catch (e: any) {
        console.error(`[SwingTrade] ${stock?.shortName || stock?.symbol}: ${e?.message}`);
        return null;
      }
    };

    const allResults = await processInBatches(BIST_TOP_STOCKS as any[], SCAN_BATCH_SIZE, processStock);
    for (const r of allResults) {
      if (r) results.push(r);
    }

    results.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));
    const filtered = results.filter((r: any) => r.score >= 35);
    const top10 = filtered.slice(0, 10);
    const marketOpen = isBistMarketHours();
    return { data: top10, marketOpen };
}

export async function GET(request: NextRequest) {
  try {
    const { result, cachedAt, fresh } = await cachedScan('swing-trading', runSwingTradingScan);
    return NextResponse.json({ ...result, cachedAt, fresh });
  } catch (error: any) {
    console.error('Swing trading error:', error);
    return NextResponse.json({ error: 'Swing trading taraması yapılamadı' }, { status: 500 });
  }
}
