export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cachedQuote, cachedChart } from '@/lib/yahoo-finance';
import { BIST_ALL_ASSETS, CRYPTO_ASSETS } from '@/lib/constants';
import { getMidasStock } from '@/lib/midas-api';

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
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
  const ema: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  if (closes.length < 26) return { macd: [], signal: [], histogram: [] };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine.slice(25), 9);
  // Align signal with macd
  const startIdx = 25 + 8; // 26-1 + 9-1
  const histogram: number[] = [];
  const macdOut: number[] = [];
  const signalOut: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    const mIdx = startIdx - 8 + i;
    macdOut.push(macdLine[mIdx]);
    signalOut.push(signalLine[i]);
    histogram.push(macdLine[mIdx] - signalLine[i]);
  }
  return { macd: macdOut, signal: signalOut, histogram };
}

function calculateBollingerBands(closes: number[], period = 20, stdDev = 2) {
  if (closes.length < period) return { upper: [], middle: [], lower: [] };
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / period;
    const std = Math.sqrt(variance);
    middle.push(avg);
    upper.push(avg + stdDev * std);
    lower.push(avg - stdDev * std);
  }
  return { upper, middle, lower };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = decodeURIComponent(params.symbol);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? '1mo';
    const interval = searchParams.get('interval') ?? '1d';

    // Find stock info
    const allAssets = [...BIST_ALL_ASSETS, ...CRYPTO_ASSETS];
    const assetInfo = allAssets.find((a: any) => a.symbol === symbol);

    // Midas primary (BIST only), Yahoo fallback
    const isBist = symbol.endsWith('.IS');
    let midasData: any = null;
    let quote: any = null;

    if (isBist) {
      try {
        midasData = await getMidasStock(symbol);
      } catch (e) {
        console.warn('[StockDetail] Midas başarısız');
      }
    }

    // Always fetch Yahoo quote for 52-week data and extras
    try {
      quote = await cachedQuote(symbol);
    } catch (e: any) {
      console.error('Quote fetch error:', e?.message);
    }

    // Fetch chart data
    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
      case '1d': startDate.setDate(endDate.getDate() - 2); break; // 2 gün geri al, sonra filtrele
      case '5d': startDate.setDate(endDate.getDate() - 5); break;
      case '1w': startDate.setDate(endDate.getDate() - 7); break;
      case '1mo': startDate.setMonth(endDate.getMonth() - 1); break;
      case '3mo': startDate.setMonth(endDate.getMonth() - 3); break;
      case '6mo': startDate.setMonth(endDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
      default: startDate.setMonth(endDate.getMonth() - 1);
    }

    const chartResult: any = await cachedChart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: interval as any,
    });

    let ohlc = (chartResult?.quotes ?? []).map((q: any) => ({
      time: q?.date ? Math.floor(new Date(q.date).getTime() / 1000) : 0,
      date: q?.date?.toISOString?.() ?? '',
      open: q?.open ?? 0,
      high: q?.high ?? 0,
      low: q?.low ?? 0,
      close: q?.close ?? 0,
      volume: q?.volume ?? 0,
    })).filter((q: any) => q.close > 0 && q.time > 0);

    // Günlük grafik: sadece bugünün borsa seansını göster (09:30 İstanbul)
    if (period === '1d' && ohlc.length > 0) {
      // Bugünün tarihini İstanbul saatine göre bul
      const now = new Date();
      // İstanbul UTC+3
      const istanbulOffset = 3 * 60 * 60 * 1000;
      const nowIstanbul = new Date(now.getTime() + istanbulOffset);
      const todayStr = nowIstanbul.toISOString().slice(0, 10); // YYYY-MM-DD
      
      // Bugünün 09:30 İstanbul = 06:30 UTC
      const marketOpenUTC = new Date(todayStr + 'T06:30:00.000Z');
      const marketOpenTs = Math.floor(marketOpenUTC.getTime() / 1000);
      
      // Sadece bugünün seans verilerini al
      const todayData = ohlc.filter((q: any) => q.time >= marketOpenTs);
      
      // Eğer bugün veri varsa sadece bugünü göster, yoksa son işlem gününü göster
      if (todayData.length > 0) {
        ohlc = todayData;
      } else {
        // Borsa kapalıysa son işlem gününün verilerini göster
        const lastDate = new Date(ohlc[ohlc.length - 1].date).toISOString().slice(0, 10);
        ohlc = ohlc.filter((q: any) => new Date(q.date).toISOString().slice(0, 10) === lastDate);
      }
    }

    // Calculate indicators
    const closes = ohlc.map((q: any) => q.close);
    const rsi = closes.length > 14 ? calculateRSI(closes) : null;
    const ema20 = closes.length > 20 ? calculateEMA(closes, 20) : [];
    const ema50 = closes.length > 50 ? calculateEMA(closes, 50) : [];
    const lastEma20 = ema20.length > 0 ? ema20[ema20.length - 1] : null;
    const lastEma50 = ema50.length > 0 ? ema50[ema50.length - 1] : null;

    const totalVolume = ohlc.reduce((s: number, q: any) => s + (q.volume || 0), 0);
    const avgVolume = ohlc.length > 0 ? Math.round(totalVolume / ohlc.length) : 0;

    // MACD
    const macdData = closes.length > 33 ? calculateMACD(closes) : { macd: [], signal: [], histogram: [] };
    const lastMacd = macdData.macd.length > 0 ? macdData.macd[macdData.macd.length - 1] : null;
    const lastSignal = macdData.signal.length > 0 ? macdData.signal[macdData.signal.length - 1] : null;
    const lastHistogram = macdData.histogram.length > 0 ? macdData.histogram[macdData.histogram.length - 1] : null;

    // Bollinger Bands
    const bb = calculateBollingerBands(closes);
    const lastBBUpper = bb.upper.length > 0 ? bb.upper[bb.upper.length - 1] : null;
    const lastBBMiddle = bb.middle.length > 0 ? bb.middle[bb.middle.length - 1] : null;
    const lastBBLower = bb.lower.length > 0 ? bb.lower[bb.lower.length - 1] : null;

    // EMA200
    const ema200 = closes.length > 200 ? calculateEMA(closes, 200) : [];
    const lastEma200 = ema200.length > 0 ? ema200[ema200.length - 1] : null;

    // Attach MACD, BB series to OHLC for chart overlay
    const macdLen = macdData.macd.length;
    const bbLen = bb.upper.length;
    const ema20Arr = ema20;
    const ema50Arr = ema50;
    const enrichedOhlc = ohlc.map((item: any, i: number) => {
      const ohlcLen = ohlc.length;
      const macdIdx = i - (ohlcLen - macdLen);
      const bbIdx = i - (ohlcLen - bbLen);
      const e20 = ema20Arr.length > 0 ? ema20Arr[i] : undefined;
      const e50 = ema50Arr.length > 0 ? ema50Arr[i] : undefined;
      const e200Val = ema200.length > 0 ? ema200[i] : undefined;
      return {
        ...item,
        ema20: e20 && i >= 19 ? Math.round(e20 * 100) / 100 : undefined,
        ema50: e50 && i >= 49 ? Math.round(e50 * 100) / 100 : undefined,
        ema200: e200Val && i >= 199 ? Math.round(e200Val * 100) / 100 : undefined,
        macd: macdIdx >= 0 ? Math.round(macdData.macd[macdIdx] * 1000) / 1000 : undefined,
        macdSignal: macdIdx >= 0 ? Math.round(macdData.signal[macdIdx] * 1000) / 1000 : undefined,
        macdHistogram: macdIdx >= 0 ? Math.round(macdData.histogram[macdIdx] * 1000) / 1000 : undefined,
        bbUpper: bbIdx >= 0 ? Math.round(bb.upper[bbIdx] * 100) / 100 : undefined,
        bbMiddle: bbIdx >= 0 ? Math.round(bb.middle[bbIdx] * 100) / 100 : undefined,
        bbLower: bbIdx >= 0 ? Math.round(bb.lower[bbIdx] * 100) / 100 : undefined,
      };
    });

    // Midas verisinden veya Yahoo'dan response oluştur
    const m = midasData;
    return NextResponse.json({
      symbol,
      name: assetInfo?.name ?? quote?.shortName ?? symbol,
      shortName: assetInfo?.shortName ?? symbol.replace('.IS', '').replace('-USD', ''),
      price: m ? (m.Last || m.Close) : (quote?.regularMarketPrice ?? (closes.length > 0 ? closes[closes.length - 1] : 0)),
      change: m ? m.DailyChange : (quote?.regularMarketChange ?? 0),
      changePercent: m ? m.DailyChangePercent : (quote?.regularMarketChangePercent ?? 0),
      high: m ? m.High : (quote?.regularMarketDayHigh ?? 0),
      low: m ? m.Low : (quote?.regularMarketDayLow ?? 0),
      open: m ? m.Open : (quote?.regularMarketOpen ?? 0),
      prevClose: m ? m.PreviousClose : (quote?.regularMarketPreviousClose ?? 0),
      volume: m ? m.TotalVolume : (quote?.regularMarketVolume ?? 0),
      marketCap: m ? m.MarketValue : (quote?.marketCap ?? 0),
      fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? 0,
      currency: quote?.currency ?? 'TRY',
      indicators: {
        rsi,
        ema20: lastEma20,
        ema50: lastEma50,
        ema200: lastEma200,
        avgVolume,
        macd: lastMacd,
        macdSignal: lastSignal,
        macdHistogram: lastHistogram,
        bbUpper: lastBBUpper,
        bbMiddle: lastBBMiddle,
        bbLower: lastBBLower,
      },
      ohlc: enrichedOhlc,
      // Midas ekstra verileri
      ...(m ? {
        vwap: m.VWAP,
        tavan: m.UpperLimit,
        taban: m.LowerLimit,
        fk: m.PriceEarning,
        pddd: m.PriceBookValue,
        freeFloat: m.FreeFloatRate,
        volatility: m.Volatility,
      } : {}),
    });
  } catch (error: any) {
    console.error('Stock detail API error:', error);
    return NextResponse.json({ error: 'Hisse verisi alınamadı' }, { status: 500 });
  }
}
