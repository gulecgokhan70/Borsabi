export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_TOP_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { cachedQuote, cachedChart } from '@/lib/yahoo-finance';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns, candlePatternScore } from '@/lib/candle-patterns';
import { calculateRSI, calculateEMA, calculateMACD, calculateBollingerBands, calculateStochastic, calculateADX } from '@/lib/technical-indicators';
import { processInBatches, withTimeout, SCAN_BATCH_SIZE } from '@/lib/scan-utils';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const {
      market = 'BIST',
      rsiMin = 0,
      rsiMax = 100,
      macdSignal = 'all',
      emaFilter = 'all',
      emaPeriod = 20,
      volumeMin = 0,
      priceMin = 0,
      priceMax = 999999,
      changeMin = -100,
      changeMax = 100,
      sortBy = 'score',
      bollingerPos = 'all',
      stochSignal = 'all',
      adxMin = 0,
    } = body;

    const stocks = market === 'CRYPTO' ? CRYPTO_ASSETS : BIST_TOP_STOCKS;
    const results: any[] = [];
    const isBist = market !== 'CRYPTO';

    let midasMap = new Map<string, MidasStock>();
    if (isBist) {
      try {
        midasMap = await getMidasStockMap();
      } catch (e) {
        console.warn('[AlgoScan] Midas başarısız');
      }
    }

    const processStock = async (stock: any) => {
      try {
        const cleanSym = stock.symbol.replace('.IS', '').toUpperCase();
        const midasData = isBist ? (midasMap.get(cleanSym) || null) : null;

        const [quote, chart] = await Promise.all([
          midasData ? Promise.resolve(null) : withTimeout(
            cachedQuote(stock.symbol).catch(() => null),
            5000, `quote:${cleanSym}`
          ).catch(() => null),
          withTimeout(
            cachedChart(stock.symbol, {
              period1: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
              period2: new Date().toISOString().split('T')[0],
              interval: '1d' as any,
            }).catch(() => null),
            8000, `chart:${cleanSym}`
          ).catch(() => null),
        ]);

        if (!chart) return null;

        // Aligned veri çıkarma: tüm alanları geçerli mumlardan al
        const validQuotes = (chart.quotes || []).filter((q: any) => q && q.close > 0 && q.high > 0 && q.low > 0);
        const closes = validQuotes.map((q: any) => q.close) as number[];
        const volumes = validQuotes.map((q: any) => q.volume ?? 0) as number[];

        // Mum formasyonları
        const candleData = validQuotes
          .filter((q: any) => q.open > 0)
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

        const highs = validQuotes.map((q: any) => q.high) as number[];
        const lows = validQuotes.map((q: any) => q.low) as number[];

        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const ema = calculateEMA(closes, emaPeriod);
        const currentEma = ema[ema.length - 1];
        const bb = calculateBollingerBands(closes);
        const stoch = calculateStochastic(closes, highs, lows);
        const adx = calculateADX(closes, highs, lows);

        // Filtre uygula
        if (rsi < rsiMin || rsi > rsiMax) return null;
        if (price < priceMin || price > priceMax) return null;
        if (change < changeMin || change > changeMax) return null;
        if (volRatio < volumeMin) return null;
        if (macdSignal === 'bullish' && macd.histogram <= 0) return null;
        if (macdSignal === 'bearish' && macd.histogram >= 0) return null;
        if (emaFilter === 'above' && price < currentEma) return null;
        if (emaFilter === 'below' && price > currentEma) return null;

        // Bollinger filtre
        if (bb) {
          if (bollingerPos === 'upper' && price < bb.middle) return null;
          if (bollingerPos === 'lower' && price > bb.middle) return null;
          if (bollingerPos === 'squeeze' && bb.bandwidth > 4) return null;
        }
        // Stochastic filtre
        if (stochSignal === 'oversold' && stoch.k > 20) return null;
        if (stochSignal === 'overbought' && stoch.k < 80) return null;
        // ADX filtre
        if (adx.adx < adxMin) return null;

        // Skor
        let score = 50;
        if (rsi < 30) score += 15;
        else if (rsi > 70) score -= 10;
        if (macd.histogram > 0) score += 10;
        if (price > currentEma) score += 10;
        if (volRatio > 1.5) score += 10;
        if (change > 0) score += 5;
        if (adx.adx > 25) score += 5;
        if (stoch.k < 20) score += 5;
        if (bb && price <= bb.lower) score += 5;
        score = Math.min(100, Math.max(0, score));

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
          bollinger: bb ? { upper: Math.round(bb.upper * 100) / 100, lower: Math.round(bb.lower * 100) / 100, bandwidth: Math.round(bb.bandwidth * 100) / 100 } : null,
          stochastic: stoch,
          adx,
          score,
          candlePatterns: candlePatterns.map(cp => ({ name: cp.name, type: cp.type, strength: cp.strength })),
        };
      } catch (e: any) {
        console.error(`[AlgoScan] ${stock?.shortName || stock?.symbol}: ${e?.message}`);
        return null;
      }
    };

    const allResults = await processInBatches(stocks as any[], SCAN_BATCH_SIZE, processStock);
    for (const r of allResults) {
      if (r) results.push(r);
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
