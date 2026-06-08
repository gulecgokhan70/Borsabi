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
  const macdLine = ema12.map((v, i) => v - (ema26?.[i] ?? 0));
  const signalLine = calculateEMA(macdLine, 9);
  const lastIdx = (macdLine?.length ?? 1) - 1;
  return {
    macd: macdLine?.[lastIdx] ?? 0,
    signal: signalLine?.[lastIdx] ?? 0,
    histogram: (macdLine?.[lastIdx] ?? 0) - (signalLine?.[lastIdx] ?? 0),
  };
}

function scoreDayTrade(
  quote: any,
  rsi: number,
  macd: any,
  vwap: number,
  ema9: number,
  ema20: number
): { score: number; signals: string[] } {
  let score = 40;
  const signals: string[] = [];
  const price = quote?.regularMarketPrice ?? 0;
  const open = quote?.regularMarketOpen ?? 0;
  const prevClose = quote?.regularMarketPreviousClose ?? 0;
  const volume = quote?.regularMarketVolume ?? 0;
  const avgVolume = quote?.averageDailyVolume3Month ?? 0;

  // Açılış gücü
  if (open > prevClose) {
    score += 8;
    signals.push('Güçlü açılış');
  }
  // Gap analizi
  const gapPercent = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
  if (gapPercent > 1) {
    score += 7;
    signals.push(`Gap Up %${gapPercent.toFixed(1)}`);
  } else if (gapPercent < -1) {
    score -= 5;
    signals.push(`Gap Down %${Math.abs(gapPercent).toFixed(1)}`);
  }
  // Hacim patlaması
  if (avgVolume > 0 && volume > avgVolume * 1.5) {
    score += 10;
    signals.push('Hacim patlaması');
  } else if (avgVolume > 0 && volume > avgVolume * 1.2) {
    score += 5;
    signals.push('Hacim artışı');
  }
  // VWAP
  if (vwap > 0 && price > vwap) {
    score += 8;
    signals.push('VWAP üzerinde');
  }
  // Momentum (RSI)
  if (rsi >= 40 && rsi <= 65) {
    score += 8;
    signals.push('Sağlıklı momentum');
  } else if (rsi < 30) {
    score += 10;
    signals.push('Aşırı satım - dönüş potansiyeli');
  } else if (rsi > 75) {
    score -= 5;
    signals.push('Aşırı alım riski');
  }
  // EMA dizilimi
  if (price > ema9 && ema9 > ema20) {
    score += 10;
    signals.push('EMA dizilimi güçlü');
  }
  // MACD
  if ((macd?.histogram ?? 0) > 0 && (macd?.macd ?? 0) > (macd?.signal ?? 0)) {
    score += 7;
    signals.push('MACD alış sinyali');
  }
  // Gün içi trend
  if (price > open) {
    score += 5;
    signals.push('Gün içi yükseliş trendi');
  }

  return { score: Math.min(100, Math.max(0, score)), signals };
}

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    const promises = BIST_STOCKS.slice(0, 15).map(async (stock) => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 2);

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

        if (closes.length < 20) return null;

        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const vwap = calculateVWAP(highs.slice(-5), lows.slice(-5), closes.slice(-5), volumes.slice(-5));
        const ema9 = calculateEMA(closes, 9);
        const ema20 = calculateEMA(closes, 20);
        const price = quote?.regularMarketPrice ?? 0;

        const { score, signals } = scoreDayTrade(
          quote, rsi, macd, vwap,
          ema9?.[(ema9?.length ?? 1) - 1] ?? 0,
          ema20?.[(ema20?.length ?? 1) - 1] ?? 0
        );

        const stopLevel = price * 0.985;
        const target1 = price * 1.02;
        const target2 = price * 1.04;
        const riskReward = (target1 - price) / (price - stopLevel);

        let quality = 'İşlem Yok';
        if (score >= 90) quality = 'Elite Kurulum';
        else if (score >= 80) quality = 'Güçlü Fırsat';
        else if (score >= 70) quality = 'İzlenebilir';
        else if (score >= 60) quality = 'Zayıf';

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
          score: Math.round(score),
          quality,
          signals,
          entry: price,
          stop: Math.round(stopLevel * 100) / 100,
          target1: Math.round(target1 * 100) / 100,
          target2: Math.round(target2 * 100) / 100,
          riskReward: Math.round(riskReward * 100) / 100,
          rsi: Math.round(rsi * 10) / 10,
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

    results.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error('Day trading error:', error);
    return NextResponse.json({ error: 'Day trading taraması yapılamadı' }, { status: 500 });
  }
}
