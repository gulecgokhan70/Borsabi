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
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

function scoreSwingTrade(
  closes: number[],
  rsi: number,
  macd: any,
  ema20: number,
  ema50: number,
  ema200: number,
  price: number,
  volume: number,
  avgVolume: number,
  atr: number
): { score: number; signals: string[] } {
  let score = 35;
  const signals: string[] = [];

  // Haftalık trend (son 20 günlük kapanış trendi)
  const recent20 = closes.slice(-20);
  const first10Avg = recent20.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
  const last10Avg = recent20.slice(-10).reduce((s, v) => s + v, 0) / 10;
  if (last10Avg > first10Avg) {
    score += 10;
    signals.push('Haftalık trend yükseliş');
  } else {
    signals.push('Haftalık trend düşüş');
  }

  // Günlük trend (son 5 gün)
  const recent5 = closes.slice(-5);
  const dayTrend = (recent5?.[recent5.length - 1] ?? 0) > (recent5?.[0] ?? 0);
  if (dayTrend) {
    score += 8;
    signals.push('Günlük trend güçlü');
  }

  // EMA dizilimi (Golden Cross check)
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
    score += 15;
    signals.push('Mükemmel EMA dizilimi');
  } else if (price > ema20 && ema20 > ema50) {
    score += 10;
    signals.push('EMA dizilimi olumlu');
  } else if (price > ema50) {
    score += 5;
    signals.push('EMA50 üzerinde');
  }

  // Hacim artışı
  if (avgVolume > 0 && volume > avgVolume * 1.5) {
    score += 10;
    signals.push('Hacim patlaması');
  } else if (avgVolume > 0 && volume > avgVolume * 1.2) {
    score += 5;
    signals.push('Hacim artışı');
  }

  // RSI
  if (rsi >= 35 && rsi <= 60) {
    score += 10;
    signals.push('Sağlıklı RSI bölgesi');
  } else if (rsi < 35) {
    score += 12;
    signals.push('RSI aşırı satım - dönüş beklentisi');
  } else if (rsi > 70) {
    score -= 5;
    signals.push('RSI aşırı alım dikkat');
  }

  // MACD
  if ((macd?.histogram ?? 0) > 0 && (macd?.macd ?? 0) > (macd?.signal ?? 0)) {
    score += 8;
    signals.push('MACD pozitif');
  }

  // Kırılım yapısı (son 20 günün en yüksek seviyesi)
  const high20 = Math.max(...closes.slice(-20));
  if (price >= high20 * 0.98) {
    score += 7;
    signals.push('20 günlük zirveye yakın - kırılım potansiyeli');
  }

  // Göreceli güç
  const priceChange10 = closes.length >= 10 ? ((price - (closes?.[closes.length - 10] ?? price)) / (closes?.[closes.length - 10] ?? 1)) * 100 : 0;
  if (priceChange10 > 5) {
    score += 5;
    signals.push('10 günlük güçlü performans');
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
        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, Math.min(200, closes.length - 1));
        const atr = calculateATR(highs, lows, closes);
        const price = quote?.regularMarketPrice ?? 0;
        const volume = quote?.regularMarketVolume ?? 0;
        const avgVolume = quote?.averageDailyVolume3Month ?? 0;

        const lastEma20 = ema20?.[(ema20?.length ?? 1) - 1] ?? 0;
        const lastEma50 = ema50?.[(ema50?.length ?? 1) - 1] ?? 0;
        const lastEma200 = ema200?.[(ema200?.length ?? 1) - 1] ?? 0;

        const { score, signals } = scoreSwingTrade(
          closes, rsi, macd, lastEma20, lastEma50, lastEma200,
          price, volume, avgVolume, atr
        );

        const stopLevel = price - (atr * 2);
        const target1 = price + (atr * 3);
        const target2 = price + (atr * 5);
        const riskReward = atr > 0 ? (target1 - price) / (price - stopLevel) : 0;

        let quality = 'İşlem Yok';
        if (score >= 90) quality = 'Elite Kurulum';
        else if (score >= 80) quality = 'Güçlü Kurulum';
        else if (score >= 70) quality = 'İzleme Listesi';
        else if (score >= 60) quality = 'Zayıf';

        let holdingPeriod = '1-2 hafta';
        if (score >= 85) holdingPeriod = '2-4 hafta';
        else if (score >= 75) holdingPeriod = '1-3 hafta';
        else if (score < 65) holdingPeriod = '3-5 gün';

        return {
          symbol: stock.shortName,
          yahooSymbol: stock.symbol,
          name: stock.name,
          price,
          change: quote?.regularMarketChangePercent ?? 0,
          volume,
          avgVolume,
          score: Math.round(score),
          quality,
          signals,
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

    results.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error('Swing trading error:', error);
    return NextResponse.json({ error: 'Swing trading taraması yapılamadı' }, { status: 500 });
  }
}
