export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cachedQuote, cachedChart } from '@/lib/yahoo-finance';
import { BIST_ALL_ASSETS, CRYPTO_ASSETS } from '@/lib/constants';
import { getMidasStock } from '@/lib/midas-api';
import { quoteTimestamp, quoteMarketOpen } from '@/lib/quote-metadata';
import { assetCurrency } from '@/lib/asset-display';
import { previousSessionClose } from '@/lib/chart-performance';
import { enrichCandles, chartHistoryStart, fourHourCandles } from '@/lib/chart-indicators';

/* ── Destek / Direnç Seviyeleri ── */
function calculateSupportResistance(ohlc: { high: number; low: number; close: number }[]): { supports: { price: number; strength: number }[]; resistances: { price: number; strength: number }[] } {
  if (ohlc.length < 10) return { supports: [], resistances: [] };

  const currentPrice = ohlc[ohlc.length - 1].close;

  // Pivot Points (Classic)
  const last = ohlc[ohlc.length - 1];
  const pivotHigh = last.high;
  const pivotLow = last.low;
  const pivotClose = last.close;
  const pp = (pivotHigh + pivotLow + pivotClose) / 3;
  const s1 = 2 * pp - pivotHigh;
  const r1 = 2 * pp - pivotLow;
  const s2 = pp - (pivotHigh - pivotLow);
  const r2 = pp + (pivotHigh - pivotLow);
  const s3 = pivotLow - 2 * (pivotHigh - pp);
  const r3 = pivotHigh + 2 * (pp - pivotLow);

  // Swing highs / lows (son 60 bar)
  const lookback = Math.min(ohlc.length, 60);
  const recent = ohlc.slice(-lookback);
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high &&
        recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high) {
      swingHighs.push(recent[i].high);
    }
    if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low &&
        recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low) {
      swingLows.push(recent[i].low);
    }
  }

  // Fibonacci Retracement (son yükseliş dalgası)
  const highs = recent.map(r => r.high);
  const lows = recent.map(r => r.low);
  const swingHigh = Math.max(...highs);
  const swingLow = Math.min(...lows);
  const diff = swingHigh - swingLow;
  const fib236 = swingHigh - diff * 0.236;
  const fib382 = swingHigh - diff * 0.382;
  const fib500 = swingHigh - diff * 0.5;
  const fib618 = swingHigh - diff * 0.618;
  const fib786 = swingHigh - diff * 0.786;

  // Tüm seviyeleri topla ve cluster yap
  const allSupports: number[] = [s1, s2, s3, ...swingLows, fib382, fib500, fib618, fib786].filter(p => p > 0 && p < currentPrice);
  const allResistances: number[] = [r1, r2, r3, ...swingHighs, fib236, fib382, fib500].filter(p => p > currentPrice);

  // Cluster: yakın seviyeleri birleştir (%1 tolerans)
  function clusterLevels(levels: number[]): { price: number; strength: number }[] {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: { prices: number[]; total: number }[] = [];
    let current = { prices: [sorted[0]], total: sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const avg = current.total / current.prices.length;
      if (Math.abs(sorted[i] - avg) / avg < 0.01) {
        current.prices.push(sorted[i]);
        current.total += sorted[i];
      } else {
        clusters.push(current);
        current = { prices: [sorted[i]], total: sorted[i] };
      }
    }
    clusters.push(current);

    return clusters
      .map(c => ({ price: Math.round((c.total / c.prices.length) * 100) / 100, strength: Math.min(c.prices.length, 5) }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4);
  }

  const supports = clusterLevels(allSupports).sort((a, b) => b.price - a.price);
  const resistances = clusterLevels(allResistances).sort((a, b) => a.price - b.price);

  return { supports, resistances };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    let symbol = decodeURIComponent((await params).symbol);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? '1mo';
    const interval = searchParams.get('interval') ?? '1d';

    // Find stock info
    const allAssets = [...BIST_ALL_ASSETS, ...CRYPTO_ASSETS];
    let assetInfo = allAssets.find((a: any) => a.symbol === symbol);

    // Sembol normalizasyonu: .IS veya -USD eki yoksa BIST_ALL_ASSETS'ten ara
    if (!assetInfo && !symbol.endsWith('.IS') && !symbol.endsWith('-USD')) {
      const bistMatch = BIST_ALL_ASSETS.find((a: any) => a.symbol === `${symbol}.IS`);
      if (bistMatch) {
        symbol = bistMatch.symbol; // AGESA -> AGESA.IS
        assetInfo = bistMatch;
        console.log(`[StockDetail] Sembol normalize edildi: ${(await params).symbol} -> ${symbol}`);
      }
    }

    // Midas primary (BIST only), Yahoo fallback
    const isBist = symbol.endsWith('.IS');
    let midasData: any = null;
    let quote: any = null;

    if (isBist) {
      try {
        midasData = await getMidasStock(symbol);
        if (midasData) {
          console.log(`[StockDetail] Midas OK: ${symbol}, Last=${midasData.Last}, Close=${midasData.Close}`);
        } else {
          console.warn(`[StockDetail] Midas: ${symbol} bulunamadı`);
        }
      } catch (e) {
        console.warn('[StockDetail] Midas başarısız:', symbol);
      }
    }

    // Always fetch Yahoo quote for 52-week data and extras
    try {
      quote = await cachedQuote(symbol);
    } catch (e: any) {
      console.warn(`[StockDetail] Yahoo Quote başarısız: ${symbol}`, e?.message);
    }

    // Fetch chart data (try/catch — chart hatası sayfayı kırmasın)
    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
      case '1d': startDate.setDate(endDate.getDate() - 2); break; // 2 gün geri al, sonra filtrele
      case '2d': startDate.setDate(endDate.getDate() - 3); break;
      case '5d': startDate.setDate(endDate.getDate() - 7); break; // 7 gün al, hafta sonu filtrele
      case '1w': startDate.setDate(endDate.getDate() - 7); break;
      case '1mo': startDate.setMonth(endDate.getMonth() - 1); break;
      case '3mo': startDate.setMonth(endDate.getMonth() - 3); break;
      case '6mo': startDate.setMonth(endDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
      case '5y': startDate.setFullYear(endDate.getFullYear() - 5); break;
      default: startDate.setMonth(endDate.getMonth() - 1);
    }

    let ohlc: any[] = [];
    try {
      const chartResult: any = await cachedChart(symbol, {
        period1: chartHistoryStart(startDate, endDate, interval),
        period2: endDate,
        interval: (interval === '4h' ? '1h' : interval) as any,
      });

      ohlc = (chartResult?.quotes ?? []).map((q: any) => ({
        time: q?.date ? Math.floor(new Date(q.date).getTime() / 1000) : 0,
        date: q?.date?.toISOString?.() ?? '',
        open: q?.open ?? 0,
        high: q?.high ?? 0,
        low: q?.low ?? 0,
        close: q?.close ?? 0,
        volume: q?.volume ?? 0,
      })).filter((q: any) => [q.open, q.high, q.low, q.close].every(n => Number.isFinite(n) && n > 0) && q.time > 0 && q.time <= endDate.getTime() / 1000);
      ohlc = [...new Map(ohlc.map(q => [q.time, q])).values()].sort((a, b) => a.time - b.time);
      if (interval === '4h') ohlc = fourHourCandles(ohlc);
      ohlc = enrichCandles(ohlc);
    } catch (chartErr: any) {
      console.warn('[StockDetail] Chart verisi alınamadı:', chartErr?.message);
      // ohlc boş kalır, sayfa yine de fiyat/temel verileri gösterir
    }

    const fullHistory = ohlc;
    // Günlük grafik: sadece bugünün borsa seansını göster (09:30 İstanbul)
    if (period === '1d' && isBist && ohlc.length > 0) {
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

    if (period !== '1d' || !isBist) {
      const cutoff = period === '1d' ? endDate.getTime() / 1000 - 86400 : startDate.getTime() / 1000;
      ohlc = ohlc.filter(q => q.time >= cutoff);
    }
    const closes = ohlc.map((q: any) => q.close);
    const last = ohlc[ohlc.length - 1];
    const rsi = last?.rsi ?? null;
    const lastEma20 = last?.ema20 ?? null, lastEma50 = last?.ema50 ?? null, lastEma200 = last?.ema200 ?? null;
    const lastMacd = last?.macd ?? null, lastSignal = last?.macdSignal ?? null, lastHistogram = last?.macdHistogram ?? null;
    const lastBBUpper = last?.bbUpper ?? null, lastBBMiddle = last?.bbMiddle ?? null, lastBBLower = last?.bbLower ?? null;
    const avgVolume = ohlc.length ? Math.round(ohlc.reduce((sum, q) => sum + q.volume, 0) / ohlc.length) : 0;

    // Destek / Direnç (her zaman 6 aylık günlük veriyle hesapla)
    let srOhlc = ohlc;
    try {
      const srStart = new Date();
      srStart.setMonth(srStart.getMonth() - 6);
      const srChart: any = await cachedChart(symbol, {
        period1: srStart,
        period2: new Date(),
        interval: '1d' as any,
      });
      const srData = (srChart?.quotes ?? []).map((q: any) => ({
        high: q?.high ?? 0,
        low: q?.low ?? 0,
        close: q?.close ?? 0,
      })).filter((q: any) => q.close > 0);
      if (srData.length >= 10) srOhlc = srData;
    } catch (e) {
      console.warn('[StockDetail] S/R için 6 aylık veri alınamadı, mevcut veriyle hesaplanıyor');
    }
    const supportResistance = calculateSupportResistance(srOhlc);

    const enrichedOhlc = ohlc;

    // Midas verisinden veya Yahoo'dan response oluştur
    const m = midasData;
    // Fiyat fallback zinciri: Midas Last > Midas Close > Midas PreviousClose > Yahoo > OHLC son close > 0
    const midasPrice = m ? (m.Last || m.Close || m.PreviousClose || 0) : 0;
    const yahooPrice = quote?.regularMarketPrice ?? 0;
    const ohlcPrice = closes.length > 0 ? closes[closes.length - 1] : 0;
    const finalPrice = midasPrice || yahooPrice || ohlcPrice;

    return NextResponse.json({
      symbol,
      name: assetInfo?.name ?? quote?.shortName ?? symbol,
      shortName: assetInfo?.shortName ?? symbol.replace('.IS', '').replace('-USD', ''),
      price: finalPrice,
      priceSource: midasPrice ? 'Midas' : yahooPrice ? 'Yahoo Finance' : ohlcPrice ? 'Geçmiş grafik verisi' : null,
      priceAsOf: midasPrice ? (m?.Last === midasPrice ? quoteTimestamp(m.DateTime) : null) : yahooPrice ? quoteTimestamp(quote?.regularMarketTime) : ohlcPrice ? quoteTimestamp(ohlc[ohlc.length - 1]?.time) : null,
      priceTimeKind: !midasPrice && !yahooPrice && ohlcPrice ? 'candle' : 'quote',
      checkedAt: new Date().toISOString(),
      marketOpen: midasPrice ? null : quoteMarketOpen(quote?.marketState),
      change: Number(m ? (m.DailyChange ?? 0) : (quote?.regularMarketChange ?? 0)) || 0,
      changePercent: Number(m ? (m.DailyChangePercent ?? 0) : (quote?.regularMarketChangePercent ?? 0)) || 0,
      high: m ? (m.High || m.PreviousClose || 0) : (quote?.regularMarketDayHigh ?? 0),
      low: m ? (m.Low || m.PreviousClose || 0) : (quote?.regularMarketDayLow ?? 0),
      open: m ? (m.Open || m.PreviousClose || 0) : (quote?.regularMarketOpen ?? 0),
      prevClose: m ? (m.PreviousClose || 0) : (quote?.regularMarketPreviousClose ?? 0),
      volume: m ? (m.TotalVolume ?? 0) : (quote?.regularMarketVolume ?? 0),
      marketCap: m ? (m.MarketValue ?? 0) : (quote?.marketCap ?? 0),
      fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? 0,
      currency: assetCurrency(symbol, quote?.currency),
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
      chartPreviousClose: period === '1d' && isBist ? previousSessionClose(fullHistory, ohlc[0]?.time) : null,
      chartSource: 'Yahoo Finance',
      ohlc: enrichedOhlc,
      supportResistance,
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
    // Son çare: en azından sembol bilgisiyle dön, 500 yerine kısmi veri ver
    const symbol = decodeURIComponent((await params).symbol);
    const allAssets = [...BIST_ALL_ASSETS, ...CRYPTO_ASSETS];
    const assetInfo = allAssets.find((a: any) => a.symbol === symbol);
    return NextResponse.json({
      symbol,
      name: assetInfo?.name ?? symbol,
      shortName: assetInfo?.shortName ?? symbol.replace('.IS', '').replace('-USD', ''),
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      prevClose: 0,
      volume: 0,
      marketCap: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      currency: assetCurrency(symbol),
      indicators: { rsi: null, ema20: null, ema50: null, ema200: null, avgVolume: 0, macd: null, macdSignal: null, macdHistogram: null, bbUpper: null, bbMiddle: null, bbLower: null },
      ohlc: [],
      _partialError: 'Hisse verisi kısmen alınamadı',
    });
  }
}
