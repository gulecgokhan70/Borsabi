export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_TOP_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { cachedQuote } from '@/lib/yahoo-finance';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { detectCandlePatterns } from '@/lib/candle-patterns';
import { calculateEMA, calculateStochastic } from '@/lib/technical-indicators';
import { processInBatches, withTimeout, SCAN_BATCH_SIZE } from '@/lib/scan-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { takeRequestSlot } from '@/lib/request-limit';
import { engineHistory, cryptoContextAt } from '@/lib/trading-engine/service';
import { evaluateMarket } from '@/lib/trading-engine/engine';
import type { CandleData } from '@/lib/trading-engine/types';

const schema = z.object({
  market: z.enum(['BIST', 'CRYPTO']).default('BIST'),
  rsiMin: z.number().finite().min(0).max(100).default(0), rsiMax: z.number().finite().min(0).max(100).default(100),
  macdSignal: z.enum(['all', 'bullish', 'bearish']).default('all'),
  emaFilter: z.enum(['all', 'above', 'below']).default('all'), emaPeriod: z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(200)]).default(20),
  volumeMin: z.number().finite().min(0).max(1000).default(0),
  priceMin: z.number().finite().min(0).max(1e9).default(0), priceMax: z.number().finite().min(0).max(1e9).default(999999),
  changeMin: z.number().finite().min(-100).max(1e6).default(-100), changeMax: z.number().finite().min(-100).max(1e6).default(100),
  sortBy: z.enum(['score', 'rsi', 'change', 'volume']).default('score'),
  bollingerPos: z.enum(['all', 'upper', 'lower', 'squeeze']).default('all'),
  stochSignal: z.enum(['all', 'oversold', 'overbought']).default('all'), adxMin: z.number().finite().min(0).max(100).default(0),
}).strict().refine(v => v.rsiMin <= v.rsiMax && v.priceMin <= v.priceMax && v.changeMin <= v.changeMax);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status,
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return reply({ error: 'Oturum gerekli.' }, 401);
    const parsed = schema.safeParse(await readMutationJson(req));
    if (!parsed.success) return reply({ error: 'Tarama filtreleri geçersiz.' }, 400);
    if (!takeRequestSlot('algo-scan:' + session.user.id, 3, 60000).allowed) return reply({ error: 'Bir dakika sonra yeniden deneyin.' }, 429);
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
    } = parsed.data;

    const stocks = market === 'CRYPTO' ? CRYPTO_ASSETS : BIST_TOP_STOCKS;
    const results: any[] = [];
    const isBist = market !== 'CRYPTO';
    const asOf = Date.now();
    let unavailable = 0;
    let btc: CandleData[] = [], eth: CandleData[] = [];
    if (!isBist) {
      [btc, eth] = await Promise.all(['BTC-USD', 'ETH-USD'].map(symbol =>
        withTimeout(engineHistory(symbol, market, '1d', asOf), 8000, symbol).catch(() => [])));
    }

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

        const [quote, candles] = await Promise.all([
          midasData ? Promise.resolve(null) : withTimeout(
            cachedQuote(stock.symbol).catch(() => null),
            5000, `quote:${cleanSym}`
          ).catch(() => null),
          withTimeout(
            stock.symbol === 'BTC-USD' ? Promise.resolve(btc) : stock.symbol === 'ETH-USD' ? Promise.resolve(eth) : engineHistory(stock.symbol, market, '1d', asOf),
            8000, `chart:${cleanSym}`
          ).catch(() => null),
        ]);

        if (!candles) { unavailable++; return null; }
        const context = isBist ? undefined : cryptoContextAt(candles, btc, eth, '1d', asOf);
        const decision = evaluateMarket({ candles, marketType: market, timeframe: '1d', asOf }, { context });
        const indicators = decision.analysis.indicators;
        if (decision.analysis.status !== 'READY' || !indicators) { unavailable++; return null; }

        // Aligned veri çıkarma: tüm alanları geçerli mumlardan al
        const validQuotes = candles;
        const closes = validQuotes.map((q: any) => q.close) as number[];
        const volumes = validQuotes.map((q: any) => q.volume ?? 0) as number[];

        // Mum formasyonları
        const candleData = validQuotes
          .filter((q: any) => q.open > 0)
          .map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close }));
        const candlePatterns = detectCandlePatterns(candleData);

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
        const volRatio = indicators.volumeRatio ?? 0;

        const highs = validQuotes.map((q: any) => q.high) as number[];
        const lows = validQuotes.map((q: any) => q.low) as number[];

        const rsi = indicators.rsi;
        const macd = indicators.macd;
        const ema = calculateEMA(closes, emaPeriod);
        const currentEma = ema[ema.length - 1];
        const bb = indicators.bollinger;
        const stoch = calculateStochastic(closes, highs, lows);
        const adx = { adx: indicators.adx, plusDI: indicators.plusDI, minusDI: indicators.minusDI };

        // Filtre uygula
        if (rsi < rsiMin || rsi > rsiMax) return null;
        if (price < priceMin || price > priceMax) return null;
        if (change < changeMin || change > changeMax) return null;
        if (volRatio < volumeMin) return null;
        if (macdSignal === 'bullish' && macd.histogram <= 0) return null;
        if (macdSignal === 'bearish' && macd.histogram >= 0) return null;
        if (emaFilter === 'above' && indicators.close < currentEma) return null;
        if (emaFilter === 'below' && indicators.close > currentEma) return null;

        // Bollinger filtre
        if (bb) {
          if (bollingerPos === 'upper' && indicators.close < bb.middle) return null;
          if (bollingerPos === 'lower' && indicators.close > bb.middle) return null;
          if (bollingerPos === 'squeeze' && bb.bandwidth > 4) return null;
        }
        // Stochastic filtre
        if (stochSignal === 'oversold' && stoch.k > 20) return null;
        if (stochSignal === 'overbought' && stoch.k < 80) return null;
        // ADX filtre
        if (adx.adx < adxMin) return null;

        const score = decision.signal.score;

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
          engine: 'v2', currency: isBist ? 'TRY' : 'USD',
          direction: decision.signal.direction, regime: decision.signal.regime,
          confidence: decision.signal.confidence, reasons: decision.signal.reasons, warnings: decision.signal.warnings,
          lastClosedAt: decision.analysis.lastClosedAt,
          candlePatterns: candlePatterns.map(cp => ({ name: cp.name, type: cp.type, strength: cp.strength })),
        };
      } catch (e: any) {
        unavailable++;
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

    if (unavailable === stocks.length) return reply({ error: 'Yeterli ve geçerli kapanmış veri alınamadı. Yeniden deneyin.' }, 503);
    return reply({ results, total: results.length, unavailable, scanned: stocks.length, engine: 'v2', asOf,
      note: 'V2 puanı ve göstergeler kapanmış günlük mumlara dayanır. Fiyat/değişim güncel kotasyondur; güven değeri kazanma olasılığı değildir. Yatırım tavsiyesi değildir.' });
  } catch (err: any) {
    if (err instanceof RequestError) return reply({ error: err.message }, err.status);
    console.error('Algo scan error:', err);
    return reply({ error: 'Tarama tamamlanamadı.' }, 503);
  }
}
