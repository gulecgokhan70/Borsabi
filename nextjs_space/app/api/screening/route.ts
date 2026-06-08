export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { yf } from '@/lib/yahoo-finance';
import { BIST_STOCKS } from '@/lib/constants';

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
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
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

function scoreStock(rsi: number, macd: any, ema20: number, ema50: number, ema200: number, price: number, volume: number, avgVolume: number): number {
  let score = 50;
  if (rsi >= 30 && rsi <= 70) score += 10;
  if (rsi >= 40 && rsi <= 60) score += 5;
  if (rsi < 30) score += 15;
  if (rsi > 70) score -= 5;
  if ((macd?.histogram ?? 0) > 0) score += 10;
  if ((macd?.macd ?? 0) > (macd?.signal ?? 0)) score += 10;
  if (price > ema20) score += 5;
  if (price > ema50) score += 5;
  if (price > ema200) score += 5;
  if (ema20 > ema50) score += 5;
  if (ema50 > ema200) score += 5;
  if (avgVolume > 0 && volume > avgVolume * 1.2) score += 5;
  return Math.min(100, Math.max(0, score));
}

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    const screenPromises = BIST_STOCKS.slice(0, 15).map(async (stock: any) => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 6);

        const [quote, chart] = await Promise.all([
          yf.quote(stock.symbol).catch(() => null),
          yf.chart(stock.symbol, { period1: startDate, period2: endDate, interval: '1d' as any }).catch(() => null),
        ]);

        if (!quote || !chart) return null;

        const closes = (chart?.quotes ?? []).map((q: any) => q?.close ?? 0).filter((c: number) => c > 0);
        if ((closes?.length ?? 0) < 30) return null;

        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, Math.min(200, (closes?.length ?? 1) - 1));
        const price = quote?.regularMarketPrice ?? 0;
        const volume = quote?.regularMarketVolume ?? 0;
        const avgVolume = quote?.averageDailyVolume3Month ?? 0;

        const score = scoreStock(
          rsi, macd,
          ema20?.[(ema20?.length ?? 1) - 1] ?? 0,
          ema50?.[(ema50?.length ?? 1) - 1] ?? 0,
          ema200?.[(ema200?.length ?? 1) - 1] ?? 0,
          price, volume, avgVolume
        );

        const stopLevel = price * 0.97;
        const targetLevel = price * 1.06;
        const riskReward = ((targetLevel - price) / (price - stopLevel));

        return {
          symbol: stock.shortName,
          yahooSymbol: stock.symbol,
          name: stock.name,
          price,
          change: quote?.regularMarketChangePercent ?? 0,
          volume,
          score: Math.round(score),
          rsi: Math.round(rsi * 10) / 10,
          macd: { macd: Math.round((macd?.macd ?? 0) * 100) / 100, signal: Math.round((macd?.signal ?? 0) * 100) / 100, histogram: Math.round((macd?.histogram ?? 0) * 100) / 100 },
          ema20: Math.round((ema20?.[(ema20?.length ?? 1) - 1] ?? 0) * 100) / 100,
          ema50: Math.round((ema50?.[(ema50?.length ?? 1) - 1] ?? 0) * 100) / 100,
          entry: price,
          stop: Math.round(stopLevel * 100) / 100,
          target: Math.round(targetLevel * 100) / 100,
          riskReward: Math.round(riskReward * 100) / 100,
        };
      } catch (e: any) {
        console.error(`Screening error for ${stock?.symbol}:`, e?.message);
        return null;
      }
    });

    const settled = await Promise.allSettled(screenPromises);
    for (const r of settled) {
      if (r?.status === 'fulfilled' && r?.value) results.push(r.value);
    }

    results.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));
    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error('Screening error:', error);
    return NextResponse.json({ error: 'Tarama yapılamadı' }, { status: 500 });
  }
}
