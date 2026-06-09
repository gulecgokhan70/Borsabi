export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { yf } from '@/lib/yahoo-finance';
import { BIST_TOP_STOCKS } from '@/lib/constants';

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

function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = ((highs?.[i] ?? 0) + (lows?.[i] ?? 0) + (closes?.[i] ?? 0)) / 3;
    cumulativeTPV += tp * (volumes?.[i] ?? 0);
    cumulativeVolume += (volumes?.[i] ?? 0);
  }
  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if ((closes?.length ?? 0) < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v: number, i: number) => v - (ema26?.[i] ?? 0));
  const signalLine = calculateEMA(macdLine, 9);
  const lastIdx = (macdLine?.length ?? 1) - 1;
  return {
    macd: macdLine?.[lastIdx] ?? 0,
    signal: signalLine?.[lastIdx] ?? 0,
    histogram: (macdLine?.[lastIdx] ?? 0) - (signalLine?.[lastIdx] ?? 0),
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

// ===== MASTER TRADER DAY TRADE PUANLAMA SİSTEMİ =====
// Hacim Gücü: 20P | Trend Gücü: 20P | Momentum: 20P | Teknik Formasyon: 20P | Risk/Ödül: 20P

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
  // Borsa kapalıyken regularMarketPrice sıfır döner, fallback kullan
  const rawPrice = quote?.regularMarketPrice ?? 0;
  const price = rawPrice > 0 ? rawPrice : (quote?.regularMarketPreviousClose ?? 0);
  const open = quote?.regularMarketOpen ?? price;
  const prevClose = quote?.regularMarketPreviousClose ?? price;
  const rawVol = quote?.regularMarketVolume ?? 0;
  const volume = rawVol > 0 ? rawVol : (quote?.averageDailyVolume3Month ?? 0);
  const avgVolume = quote?.averageDailyVolume3Month ?? 0;
  const dayChange = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

  // ===== FİLTRE KRİTERLERİ =====
  // Günlük hacim > Son 20 gün ortalama | VWAP üzerinde | EMA9 > EMA21 | RSI(5) > 55
  // MACD pozitif | Günlük değişim > %1
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

  // İlk 30dk hacim artışı (son mumların hacmine bak)
  const last5Vol = volumes.slice(-5);
  const prev5Vol = volumes.slice(-10, -5);
  const avgLast5 = last5Vol.reduce((s: number, v: number) => s + v, 0) / (last5Vol.length || 1);
  const avgPrev5 = prev5Vol.reduce((s: number, v: number) => s + v, 0) / (prev5Vol.length || 1);
  if (avgPrev5 > 0 && avgLast5 > avgPrev5 * 1.3) {
    hacimPuan = Math.min(20, hacimPuan + 3);
    signals.push('Yakın dönem hacim ivmesi');
  }

  // Güçlü alıcı baskısı
  if (price > open && price > (highs[highs.length - 1] ?? 0) * 0.98) {
    hacimPuan = Math.min(20, hacimPuan + 2);
    signals.push('Güçlü alıcı baskısı');
  }

  // ===== 2. TREND GÜCÜ (20 Puan) =====
  let trendPuan = 0;
  if (ema9 > ema21) { trendPuan += 8; signals.push('EMA9 > EMA21 ✓'); }
  if (price > ema9) { trendPuan += 4; signals.push('Fiyat > EMA9'); }
  if (vwapOk) { trendPuan += 5; signals.push('VWAP üzerinde ✓'); }

  // Gap analizi
  const gapPercent = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
  if (gapPercent > 1.5) { trendPuan += 3; signals.push(`Gap Up %${gapPercent.toFixed(1)}`); }
  else if (gapPercent > 0.5) { trendPuan += 1; }
  if (gapPercent < -1) { signals.push(`⚠️ Gap Down %${Math.abs(gapPercent).toFixed(1)}`); }

  trendPuan = Math.min(20, trendPuan);

  // ===== 3. MOMENTUM (20 Puan) =====
  let momentumPuan = 0;
  // RSI(5)
  if (rsi5 >= 60 && rsi5 <= 75) { momentumPuan += 8; signals.push(`RSI(5): ${rsi5.toFixed(0)} - Güçlü momentum`); }
  else if (rsi5 >= 55 && rsi5 < 60) { momentumPuan += 5; signals.push(`RSI(5): ${rsi5.toFixed(0)} - Pozitif momentum`); }
  else if (rsi5 > 75) { momentumPuan += 3; signals.push(`⚠️ RSI(5): ${rsi5.toFixed(0)} - Aşırı alım dikkat`); }

  // MACD
  if ((macd?.histogram ?? 0) > 0 && (macd?.macd ?? 0) > (macd?.signal ?? 0)) {
    momentumPuan += 7;
    signals.push('MACD alış sinyali ✓');
  } else if ((macd?.histogram ?? 0) > 0) {
    momentumPuan += 4;
    signals.push('MACD pozitif');
  }

  // Gün içi trend gücü
  if (dayChange > 3) { momentumPuan += 5; signals.push(`Günlük %${dayChange.toFixed(1)} güçlü yükseliş`); }
  else if (dayChange > 1) { momentumPuan += 3; signals.push(`Günlük %${dayChange.toFixed(1)} yükseliş ✓`); }

  momentumPuan = Math.min(20, momentumPuan);

  // ===== 4. TEKNİK FORMASYON (20 Puan) =====
  let formasyonPuan = 0;

  // Son 3 mum: yükselen yapı
  const last3 = closes.slice(-3);
  if (last3.length === 3 && last3[2] > last3[1] && last3[1] > last3[0]) {
    formasyonPuan += 6;
    signals.push('3 ardışık yükselen mum');
  }

  // Boğa yutan mum (son mum öncekini kapsar)
  const lastClose = closes[closes.length - 1] ?? 0;
  const lastOpen = lows[lows.length - 1] ?? 0; // approx
  const prevCloseCandle = closes[closes.length - 2] ?? 0;
  if (lastClose > prevCloseCandle && (lastClose - open) > Math.abs(prevCloseCandle - (closes[closes.length - 3] ?? prevCloseCandle)) * 1.2) {
    formasyonPuan += 5;
    signals.push('Boğa yutan formasyon');
  }

  // 20 günlük zirve kırılımı
  const high20 = Math.max(...closes.slice(-20));
  if (price >= high20 * 0.99) {
    formasyonPuan += 5;
    signals.push('20 günlük zirve kırılımı');
  }

  // Destek bölgesinden sekme (EMA9 yakınında)
  const lowToday = quote?.regularMarketDayLow ?? 0;
  if (ema9 > 0 && lowToday > 0 && lowToday <= ema9 * 1.005 && price > ema9) {
    formasyonPuan += 4;
    signals.push('EMA9 desteğinden sekme');
  }

  formasyonPuan = Math.min(20, formasyonPuan);

  // ===== 5. RİSK/ÖDÜL ORANI (20 Puan) =====
  let riskOdulPuan = 0;
  const stopDistance = atr > 0 ? atr * 1.5 : price * 0.015;
  const stopLevel = price - stopDistance;
  const target1 = price + (stopDistance * 2);
  const target2 = price + (stopDistance * 3);
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

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    // Tüm BIST hisselerini tara
    const promises = BIST_TOP_STOCKS.map(async (stock: any) => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);

        const [quote, chart] = await Promise.all([
          yf.quote(stock.symbol).catch(() => null),
          yf.chart(stock.symbol, { period1: startDate, period2: endDate, interval: '1d' as any }).catch(() => null),
        ]);

        if (!chart) return null;

        const quotes = chart?.quotes ?? [];
        const closes = quotes.map((q: any) => q?.close ?? 0).filter((c: number) => c > 0);
        const highs = quotes.map((q: any) => q?.high ?? 0);
        const lows = quotes.map((q: any) => q?.low ?? 0);
        const volumes = quotes.map((q: any) => q?.volume ?? 0);

        if (closes.length < 26) return null;

        const rsi5 = calculateRSI(closes, 5);
        const rsi14 = calculateRSI(closes, 14);
        const macd = calculateMACD(closes);
        const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
        const ema9 = calculateEMA(closes, 9);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(highs, lows, closes);
        // Borsa kapalıyken regularMarketPrice sıfır döner, fallback kullan
        const lastClose = closes[closes.length - 1] ?? 0;
        const rawPrice = quote?.regularMarketPrice ?? 0;
        const price = rawPrice > 0 ? rawPrice : (quote?.regularMarketPreviousClose ?? lastClose);
        if (price <= 0) return null;
        // quote fallback'leri
        if (!quote) {
          (quote as any) = { regularMarketPrice: price, regularMarketPreviousClose: closes[closes.length - 2] ?? price, regularMarketOpen: lastClose, regularMarketVolume: volumes[volumes.length - 1] ?? 0, averageDailyVolume3Month: volumes.length > 20 ? volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : 0, regularMarketChangePercent: 0 };
        } else if (rawPrice <= 0) {
          (quote as any).regularMarketPrice = price;
          if (!quote.regularMarketOpen || quote.regularMarketOpen <= 0) (quote as any).regularMarketOpen = lastClose;
          if (!quote.regularMarketVolume || quote.regularMarketVolume <= 0) (quote as any).regularMarketVolume = volumes[volumes.length - 1] ?? 0;
        }

        const lastEma9 = ema9?.[(ema9?.length ?? 1) - 1] ?? 0;
        const lastEma21 = ema21?.[(ema21?.length ?? 1) - 1] ?? 0;

        const result = scoreDayTrade(
          quote, closes, highs, lows, volumes,
          rsi5, rsi14, macd, vwap, lastEma9, lastEma21, atr
        );

        // Minimum R:R 1:2 altındaki hisseleri ele (prompttaki kural)
        const stopDistance = atr > 0 ? atr * 1.5 : price * 0.015;
        const stopLevel = price - stopDistance;
        const target1 = price + (stopDistance * 2);
        const target2 = price + (stopDistance * 3);
        const riskReward = stopDistance > 0 ? (target1 - price) / stopDistance : 0;

        if (riskReward < 1.5) return null;

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
          change: quote?.regularMarketChangePercent ?? 0,
          volume: quote?.regularMarketVolume ?? 0,
          avgVolume: quote?.averageDailyVolume3Month ?? 0,
          open: quote?.regularMarketOpen ?? 0,
          high: quote?.regularMarketDayHigh ?? 0,
          low: quote?.regularMarketDayLow ?? 0,
          score: Math.round(result.score),
          quality,
          signals: result.signals,
          passesFilter: result.passesFilter,
          hacimPuan: result.hacimPuan,
          trendPuan: result.trendPuan,
          momentumPuan: result.momentumPuan,
          formasyonPuan: result.formasyonPuan,
          riskOdulPuan: result.riskOdulPuan,
          entry: price,
          stop: Math.round(stopLevel * 100) / 100,
          target1: Math.round(target1 * 100) / 100,
          target2: Math.round(target2 * 100) / 100,
          riskReward: Math.round(riskReward * 100) / 100,
          rsi: Math.round(rsi5 * 10) / 10,
          rsi14: Math.round(rsi14 * 10) / 10,
          vwap: Math.round(vwap * 100) / 100,
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

    // En yüksek puanlı 10 hisseyi göster, zayıfları listeleme
    results.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));
    const filtered = results.filter((r: any) => r.score >= 40);
    const top10 = filtered.slice(0, 10);
    const isBistOpen = top10.length > 0 && top10.some((r: any) => {
      const rp = r.price ?? 0;
      const pc = r.prevClose ?? 0;
      return rp !== pc && rp > 0;
    });
    return NextResponse.json({ data: top10, marketOpen: isBistOpen });
  } catch (error: any) {
    console.error('Day trading error:', error);
    return NextResponse.json({ error: 'Day trading taraması yapılamadı' }, { status: 500 });
  }
}
