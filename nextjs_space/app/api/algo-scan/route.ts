export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_TOP_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { cachedQuote, cachedChart } from '@/lib/yahoo-finance';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns, candlePatternScore } from '@/lib/candle-patterns';

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v: number, i: number) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const {
      market = 'BIST',
      rsiMin = 0,
      rsiMax = 100,
      macdSignal = 'all', // all, bullish, bearish
      emaFilter = 'all', // all, above, below
      emaPeriod = 20,
      volumeMin = 0, // min volume multiplier vs avg
      priceMin = 0,
      priceMax = 999999,
      changeMin = -100,
      changeMax = 100,
      sortBy = 'score', // score, rsi, change, volume
    } = body;

    const stocks = market === 'CRYPTO' ? CRYPTO_ASSETS : BIST_TOP_STOCKS;
    const results: any[] = [];
    const isBist = market !== 'CRYPTO';

    // Midas'tan BIST verileri
    let midasMap = new Map<string, MidasStock>();
    if (isBist) {
      try {
        midasMap = await getMidasStockMap();
      } catch (e) {
        console.warn('[AlgoScan] Midas başarısız');
      }
    }

    const promises = stocks.map(async (stock: any) => {
      try {
        const cleanSym = stock.symbol.replace('.IS', '').toUpperCase();
        const midasData = isBist ? (midasMap.get(cleanSym) || null) : null;

        const [quote, chart] = await Promise.all([
          midasData ? Promise.resolve(null) : cachedQuote(stock.symbol).catch(() => null),
          cachedChart(stock.symbol, {
            period1: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
            period2: new Date().toISOString().split('T')[0],
            interval: '1d' as any,
          }).catch(() => null),
        ]);

        if (!chart) return null;

        const closes = (chart.quotes || []).map((q: any) => q.close).filter(Boolean) as number[];
        const volumes = (chart.quotes || []).map((q: any) => q.volume).filter(Boolean) as number[];

        // Mum formasyonları
        const candleData = (chart.quotes || [])
          .filter((q: any) => q?.open > 0 && q?.close > 0 && q?.high > 0 && q?.low > 0)
          .map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close }));
        const candlePatterns = detectCandlePatterns(candleData);
        const cpScore = candlePatternScore(candlePatterns);

        if (closes.length < 30) return null;

        const lastClose = closes[closes.length - 1] ?? 0;
        let price = 0, change = 0, volume = 0;

        if (midasData) {
          price = midasData.Last || midasData.Close || lastClose;
          change = midasData.DailyChangePercent ?? 0;
          volume = midasData.TotalVolume || (volumes.length > 0 ? volumes[volumes.length - 1] : 0);
        } else {
          const rawPrice = (quote as any)?.regularMarketPrice || 0;
          price = rawPrice > 0 ? rawPrice : ((quote as any)?.regularMarketPreviousClose || lastClose);
          change = (quote as any)?.regularMarketChangePercent || 0;
          const rawVol = (quote as any)?.regularMarketVolume || 0;
          volume = rawVol > 0 ? rawVol : (volumes.length > 0 ? volumes[volumes.length - 1] : 0);
        }
        if (price <= 0) return null;
        const avgVolume = volumes.length > 20 ? volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : volume;
        const volRatio = avgVolume > 0 ? volume / avgVolume : 1;

        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const ema = calculateEMA(closes, emaPeriod);
        const currentEma = ema[ema.length - 1];

        // Apply filters
        if (rsi < rsiMin || rsi > rsiMax) return null;
        if (price < priceMin || price > priceMax) return null;
        if (change < changeMin || change > changeMax) return null;
        if (volRatio < volumeMin) return null;
        if (macdSignal === 'bullish' && macd.histogram <= 0) return null;
        if (macdSignal === 'bearish' && macd.histogram >= 0) return null;
        if (emaFilter === 'above' && price < currentEma) return null;
        if (emaFilter === 'below' && price > currentEma) return null;

        // Score
        let score = 50;
        if (rsi < 30) score += 15;
        else if (rsi > 70) score -= 10;
        if (macd.histogram > 0) score += 10;
        if (price > currentEma) score += 10;
        if (volRatio > 1.5) score += 10;
        if (change > 0) score += 5;
        score = Math.min(100, Math.max(0, score));

        // Mum formasyonları skoru ekle
        if (cpScore > 0) score = Math.min(100, score + cpScore);

        return {
          symbol: stock.symbol,
          name: stock.name,
          shortName: stock.shortName,
          price,
          change,
          volume,
          volRatio: Math.round(volRatio * 100) / 100,
          rsi: Math.round(rsi * 100) / 100,
          macd: { macd: Math.round(macd.macd * 1000) / 1000, signal: Math.round(macd.signal * 1000) / 1000, histogram: Math.round(macd.histogram * 1000) / 1000 },
          ema: Math.round(currentEma * 100) / 100,
          emaPeriod,
          score,
          candlePatterns: candlePatterns.map(cp => ({ name: cp.name, type: cp.type, strength: cp.strength })),
        };
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(promises);
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }

    // Sort
    const sortFn: Record<string, (a: any, b: any) => number> = {
      score: (a: any, b: any) => b.score - a.score,
      rsi: (a: any, b: any) => a.rsi - b.rsi,
      change: (a: any, b: any) => b.change - a.change,
      volume: (a: any, b: any) => b.volRatio - a.volRatio,
    };
    results.sort(sortFn[sortBy] || sortFn.score);

    return NextResponse.json({ results, total: results.length });
  } catch (err: any) {
    console.error('Algo scan error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
