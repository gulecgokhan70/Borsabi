export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { yf } from '@/lib/yahoo-finance';
import { BIST_STOCKS } from '@/lib/constants';

// ===== TEKNİK İNDİKATÖR HESAPLAMALARI =====

function calculateRSI(closes: number[], period = 14): number {
  if ((closes?.length ?? 0) < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = (closes?.length ?? 0) - period; i < (closes?.length ?? 0); i++) {
    const diff = (closes?.[i] ?? 0) - (closes?.[i - 1] ?? 0);
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateEMA(data: number[], period: number): number[] {
  if ((data?.length ?? 0) === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data?.[0] ?? 0];
  for (let i = 1; i < (data?.length ?? 0); i++) {
    ema.push(((data?.[i] ?? 0) * k) + ((ema?.[i - 1] ?? 0) * (1 - k)));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number; prevHistogram: number } {
  if ((closes?.length ?? 0) < 26) return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v: number, i: number) => v - (ema26?.[i] ?? 0));
  const signalLine = calculateEMA(macdLine, 9);
  const lastIdx = (macdLine?.length ?? 1) - 1;
  return {
    macd: macdLine?.[lastIdx] ?? 0,
    signal: signalLine?.[lastIdx] ?? 0,
    histogram: (macdLine?.[lastIdx] ?? 0) - (signalLine?.[lastIdx] ?? 0),
    prevHistogram: lastIdx > 0 ? (macdLine?.[lastIdx - 1] ?? 0) - (signalLine?.[lastIdx - 1] ?? 0) : 0,
  };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 0;
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      (highs?.[i] ?? 0) - (lows?.[i] ?? 0),
      Math.abs((highs?.[i] ?? 0) - (closes?.[i - 1] ?? 0)),
      Math.abs((lows?.[i] ?? 0) - (closes?.[i - 1] ?? 0))
    );
    trueRanges.push(tr);
  }
  const recent = trueRanges.slice(-period);
  return recent.reduce((s: number, v: number) => s + v, 0) / recent.length;
}

// ===== SAPAN SİSTEMİ =====
// EMA20 üzerinde | EMA20 > EMA50 | Fiyat EMA20'ye geri çekilmiş
// Düşüş sırasında hacim azalmış | Son mum yeşil kapanmış | RSI 45-60

function detectSapan(
  closes: number[], volumes: number[], ema20: number[], ema50: number[],
  rsi: number, price: number
): { detected: boolean; strength: number } {
  const len = closes.length;
  if (len < 25) return { detected: false, strength: 0 };

  const lastEma20 = ema20[ema20.length - 1] ?? 0;
  const lastEma50 = ema50[ema50.length - 1] ?? 0;
  const prevClose = closes[len - 2] ?? 0;

  // Fiyat EMA20 üzerinde veya çok yakınında
  const aboveEma20 = price >= lastEma20 * 0.995;
  const ema20AboveEma50 = lastEma20 > lastEma50;

  // Fiyat EMA20'ye geri çekilmiş (son 5 mumdan biri EMA20'ye dokunmuş)
  const recentLows = closes.slice(-5);
  const pullbackToEma20 = recentLows.some((c: number) => c <= lastEma20 * 1.01 && c >= lastEma20 * 0.98);

  // Düşüş sırasında hacim azalmış
  const vol3 = volumes.slice(-3).reduce((s: number, v: number) => s + v, 0) / 3;
  const vol10 = volumes.slice(-10, -3).reduce((s: number, v: number) => s + v, 0) / 7;
  const volumeDecreased = vol10 > 0 && vol3 < vol10 * 0.85;

  // Son mum yeşil
  const greenCandle = price > prevClose;

  // RSI 45-60
  const rsiOk = rsi >= 45 && rsi <= 60;

  const conditions = [aboveEma20, ema20AboveEma50, pullbackToEma20, volumeDecreased, greenCandle, rsiOk];
  const metCount = conditions.filter(Boolean).length;

  return {
    detected: metCount >= 5,
    strength: Math.round((metCount / 6) * 100),
  };
}

// ===== DİP-BİP SİSTEMİ =====
// RSI 30 altından yukarı dönüyor | MACD negatiften pozitife | Hacim artıyor
// Son mum güçlü yeşil | Destek bölgesinde tutunuyor

function detectDipBip(
  closes: number[], volumes: number[], rsi: number, prevRsi: number,
  macd: any, price: number, lows: number[]
): { detected: boolean; strength: number } {
  const len = closes.length;
  if (len < 20) return { detected: false, strength: 0 };

  // RSI 30 altından yukarı dönüyor
  const rsiTurning = prevRsi < 35 && rsi > prevRsi;

  // MACD negatiften pozitife
  const macdTurning = (macd?.prevHistogram ?? 0) < 0 && (macd?.histogram ?? 0) > (macd?.prevHistogram ?? 0);

  // Hacim artıyor
  const lastVol = volumes[volumes.length - 1] ?? 0;
  const prevAvgVol = volumes.slice(-10, -1).reduce((s: number, v: number) => s + v, 0) / 9;
  const volumeUp = prevAvgVol > 0 && lastVol > prevAvgVol * 1.1;

  // Son mum güçlü yeşil
  const prevClose = closes[len - 2] ?? 0;
  const strongGreen = price > prevClose && ((price - prevClose) / prevClose) * 100 > 0.5;

  // Destek bölgesinde (son 20 gün en düşük yakınında)
  const low20 = Math.min(...lows.slice(-20).filter((l: number) => l > 0));
  const nearSupport = low20 > 0 && price <= low20 * 1.05;

  const conditions = [rsiTurning, macdTurning, volumeUp, strongGreen, nearSupport];
  const metCount = conditions.filter(Boolean).length;

  return {
    detected: metCount >= 3,
    strength: Math.round((metCount / 5) * 100),
  };
}

// ===== FORMASYON TESPİTİ =====

function detectFormations(
  closes: number[], highs: number[], lows: number[], volumes: number[]
): string[] {
  const formations: string[] = [];
  const len = closes.length;
  if (len < 30) return formations;

  // Çanak formasyonu: U şeklinde dip, fiyat toparlanma sürecinde
  const mid = Math.floor(len / 2);
  const firstHalf = closes.slice(-30, -15);
  const secondHalf = closes.slice(-15);
  const firstAvg = firstHalf.reduce((s: number, v: number) => s + v, 0) / firstHalf.length;
  const midMin = Math.min(...closes.slice(-25, -5));
  const secondAvg = secondHalf.reduce((s: number, v: number) => s + v, 0) / secondHalf.length;
  if (firstAvg > midMin * 1.02 && secondAvg > midMin * 1.02 && secondAvg >= firstAvg * 0.97) {
    formations.push('Çanak Formasyonu');
  }

  // Yükselen üçgen: Yükselen dipler + yatay zirveler
  const recent15Lows = lows.slice(-15);
  const recent15Highs = highs.slice(-15);
  const firstThirdLow = Math.min(...recent15Lows.slice(0, 5).filter((l: number) => l > 0));
  const lastThirdLow = Math.min(...recent15Lows.slice(-5).filter((l: number) => l > 0));
  const firstThirdHigh = Math.max(...recent15Highs.slice(0, 5));
  const lastThirdHigh = Math.max(...recent15Highs.slice(-5));
  if (lastThirdLow > firstThirdLow * 1.01 && Math.abs(lastThirdHigh - firstThirdHigh) / firstThirdHigh < 0.02) {
    formations.push('Yükselen Üçgen');
  }

  // Çift dip
  const minIdx1 = closes.slice(-30, -15).indexOf(Math.min(...closes.slice(-30, -15).filter((c: number) => c > 0)));
  const minIdx2 = closes.slice(-15).indexOf(Math.min(...closes.slice(-15).filter((c: number) => c > 0)));
  const min1 = closes.slice(-30, -15)[minIdx1] ?? 0;
  const min2 = closes.slice(-15)[minIdx2] ?? 0;
  if (min1 > 0 && min2 > 0 && Math.abs(min1 - min2) / min1 < 0.03 && closes[len - 1] > Math.max(min1, min2) * 1.03) {
    formations.push('Çift Dip');
  }

  return formations;
}

// ===== MASTER TRADER SWING TRADE PUANLAMA =====

interface SwingTradeScore {
  score: number;
  signals: string[];
  sapanDetected: boolean;
  dipBipDetected: boolean;
  formations: string[];
  passesFilter: boolean;
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

  // ===== FİLTRE KRİTERLERİ =====
  const aboveEma20 = price > lastEma20;
  const ema20AboveEma50 = lastEma20 > lastEma50;
  const rsiOk = rsi >= 50 && rsi <= 70;
  const macdPositive = (macd?.macd ?? 0) > 0;
  const volumeAboveAvg = avgVolume > 0 && volume > avgVolume;

  const passesFilter = aboveEma20 && ema20AboveEma50 && rsiOk && macdPositive && volumeAboveAvg;

  let score = 0;

  // === TREND (25 Puan) ===
  if (aboveEma20) { score += 8; signals.push('EMA20 üzerinde ✓'); }
  if (ema20AboveEma50) { score += 8; signals.push('EMA20 > EMA50 ✓'); }

  // EMA200 kontrolü
  const ema200Arr = calculateEMA(closes, Math.min(200, len - 1));
  const lastEma200 = ema200Arr[ema200Arr.length - 1] ?? 0;
  if (price > lastEma200) { score += 5; signals.push('EMA200 üzerinde'); }

  // Son 20 günü trend
  const recent20 = closes.slice(-20);
  const first10Avg = recent20.slice(0, 10).reduce((s: number, v: number) => s + v, 0) / 10;
  const last10Avg = recent20.slice(-10).reduce((s: number, v: number) => s + v, 0) / 10;
  if (last10Avg > first10Avg) { score += 4; signals.push('Yükselen trend'); }

  // === MOMENTUM (20 Puan) ===
  if (rsiOk) { score += 8; signals.push(`RSI(14): ${rsi.toFixed(0)} - Trend bölgesi ✓`); }
  else if (rsi > 70) { signals.push(`⚠️ RSI(14): ${rsi.toFixed(0)} - Aşırı alım`); }
  else if (rsi < 50 && rsi > 30) { score += 3; signals.push(`RSI(14): ${rsi.toFixed(0)}`); }

  if (macdPositive) { score += 6; signals.push('MACD pozitif ✓'); }
  if ((macd?.histogram ?? 0) > 0 && (macd?.macd ?? 0) > (macd?.signal ?? 0)) {
    score += 6; signals.push('MACD alış sinyali');
  }

  // === HACİM (15 Puan) ===
  if (volumeAboveAvg) {
    const vRatio = avgVolume > 0 ? volume / avgVolume : 0;
    if (vRatio >= 2) { score += 15; signals.push('Güçlü hacim patlaması (2x+)'); }
    else if (vRatio >= 1.5) { score += 10; signals.push('Hacim artışı (1.5x)'); }
    else { score += 6; signals.push('Ortalama üstü hacim ✓'); }
  }

  // === SAPAN SİSTEMİ (10 Puan) ===
  const prevRsiCloses = closes.slice(0, -1);
  const prevRsi = prevRsiCloses.length > 14 ? calculateRSI(prevRsiCloses) : rsi;
  const sapan = detectSapan(closes, volumes, ema20Arr, ema50Arr, rsi, price);
  if (sapan.detected) {
    score += 10;
    signals.push(`🎯 Sapan Sinyali (Güç: %${sapan.strength})`);
  } else if (sapan.strength >= 50) {
    score += 4;
    signals.push(`Sapan oluşumu başlıyor (%${sapan.strength})`);
  }

  // === DİP-BİP SİSTEMİ (10 Puan) ===
  const dipBip = detectDipBip(closes, volumes, rsi, prevRsi, macd, price, lows);
  if (dipBip.detected) {
    score += 10;
    signals.push(`🟢 Dip-Bip Sinyali (Güç: %${dipBip.strength})`);
  } else if (dipBip.strength >= 40) {
    score += 3;
    signals.push(`Dip-Bip oluşumu (%${dipBip.strength})`);
  }

  // === FORMASYON (10 Puan) ===
  const formations = detectFormations(closes, highs, lows, volumes);
  if (formations.length > 0) {
    score += Math.min(10, formations.length * 5);
    formations.forEach((f: string) => signals.push(`📊 ${f}`));
  }

  // 20 günlük zirve kırılımı
  const high20 = Math.max(...closes.slice(-20));
  if (price >= high20 * 0.98) {
    score += 3;
    signals.push('20 günlük zirveye yakın');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    signals,
    sapanDetected: sapan.detected,
    dipBipDetected: dipBip.detected,
    formations,
    passesFilter,
  };
}

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    // Tüm BIST hisselerini tara
    const promises = BIST_STOCKS.map(async (stock: any) => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);

        const [quote, chart] = await Promise.all([
          yf.quote(stock.symbol).catch(() => null),
          yf.chart(stock.symbol, { period1: startDate, period2: endDate, interval: '1d' as any }).catch(() => null),
        ]);

        if (!quote || !chart) return null;

        const quotes = chart?.quotes ?? [];
        const closes = quotes.map((q: any) => q?.close ?? 0).filter((c: number) => c > 0);
        const highs = quotes.map((q: any) => q?.high ?? 0);
        const lows = quotes.map((q: any) => q?.low ?? 0);
        const volumes = quotes.map((q: any) => q?.volume ?? 0);

        if (closes.length < 50) return null;

        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const ema20Arr = calculateEMA(closes, 20);
        const ema50Arr = calculateEMA(closes, 50);
        const ema200Arr = calculateEMA(closes, Math.min(200, closes.length - 1));
        const atr = calculateATR(highs, lows, closes);
        const price = quote?.regularMarketPrice ?? 0;
        const volume = quote?.regularMarketVolume ?? 0;
        const avgVolume = quote?.averageDailyVolume3Month ?? 0;

        const lastEma20 = ema20Arr[(ema20Arr.length ?? 1) - 1] ?? 0;
        const lastEma50 = ema50Arr[(ema50Arr.length ?? 1) - 1] ?? 0;
        const lastEma200 = ema200Arr[(ema200Arr.length ?? 1) - 1] ?? 0;

        const result = scoreSwingTrade(
          closes, highs, lows, volumes,
          rsi, macd, ema20Arr, ema50Arr,
          price, volume, avgVolume, atr
        );

        // Risk yönetimi hesaplamaları
        const stopDistance = atr > 0 ? atr * 2 : price * 0.03;
        const stopLevel = price - stopDistance;
        const target1 = price + (stopDistance * 2);
        const target2 = price + (stopDistance * 3);
        const riskReward = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

        // Minimum R:R 1:2 altındaki hisseleri ele
        if (riskReward < 1.5) return null;

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
          change: quote?.regularMarketChangePercent ?? 0,
          volume,
          avgVolume,
          score: Math.round(result.score),
          quality,
          signals: result.signals,
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
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(promises);
    for (const r of settled) {
      if (r?.status === 'fulfilled' && r?.value) results.push(r.value);
    }

    // En yüksek puanlı 10 hisse, zayıfları listeleme
    results.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));
    const filtered = results.filter((r: any) => r.score >= 35);
    return NextResponse.json({ data: filtered.slice(0, 10) });
  } catch (error: any) {
    console.error('Swing trading error:', error);
    return NextResponse.json({ error: 'Swing trading taraması yapılamadı' }, { status: 500 });
  }
}
