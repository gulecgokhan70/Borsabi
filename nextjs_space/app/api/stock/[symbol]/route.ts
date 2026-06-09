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

    if (!midasData) {
      try {
        quote = await cachedQuote(symbol);
      } catch (e: any) {
        console.error('Quote fetch error:', e?.message);
      }
    }

    // Fetch chart data
    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
      case '1d': startDate.setDate(endDate.getDate() - 1); break;
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

    const ohlc = (chartResult?.quotes ?? []).map((q: any) => ({
      time: q?.date ? Math.floor(new Date(q.date).getTime() / 1000) : 0,
      date: q?.date?.toISOString?.() ?? '',
      open: q?.open ?? 0,
      high: q?.high ?? 0,
      low: q?.low ?? 0,
      close: q?.close ?? 0,
      volume: q?.volume ?? 0,
    })).filter((q: any) => q.close > 0 && q.time > 0);

    // Calculate indicators
    const closes = ohlc.map((q: any) => q.close);
    const rsi = closes.length > 14 ? calculateRSI(closes) : null;
    const ema20 = closes.length > 20 ? calculateEMA(closes, 20) : [];
    const ema50 = closes.length > 50 ? calculateEMA(closes, 50) : [];
    const lastEma20 = ema20.length > 0 ? ema20[ema20.length - 1] : null;
    const lastEma50 = ema50.length > 0 ? ema50[ema50.length - 1] : null;

    const totalVolume = ohlc.reduce((s: number, q: any) => s + (q.volume || 0), 0);
    const avgVolume = ohlc.length > 0 ? Math.round(totalVolume / ohlc.length) : 0;

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
      indicators: { rsi, ema20: lastEma20, ema50: lastEma50, avgVolume },
      ohlc,
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
