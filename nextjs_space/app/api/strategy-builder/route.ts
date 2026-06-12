export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_ALL_ASSETS, CRYPTO_ASSETS } from '@/lib/constants';
import { cachedChart } from '@/lib/yahoo-finance';

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsis: number[] = new Array(period).fill(50);
  for (let i = period; i < closes.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const rs = losses === 0 ? 100 : gains / losses;
    rsis.push(100 - (100 / (1 + rs)));
  }
  return rsis;
}

function calculateMACD(closes: number[]): { macd: number[]; signal: number[] } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  return { macd: macdLine, signal: signalLine };
}

function calculateBollingerArray(closes: number[], period = 20, mult = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const upper: number[] = new Array(closes.length).fill(0);
  const middle: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period);
    middle[i] = avg;
    upper[i] = avg + mult * std;
    lower[i] = avg - mult * std;
  }
  return { upper, middle, lower };
}

function calculateStochasticArray(closes: number[], highs: number[], lows: number[], kPeriod = 14, dPeriod = 3): { k: number[]; d: number[] } {
  const kValues: number[] = new Array(closes.length).fill(50);
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const ll = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    kValues[i] = hh !== ll ? ((closes[i] - ll) / (hh - ll)) * 100 : 50;
  }
  const dValues = calculateEMA(kValues, dPeriod);
  return { k: kValues, d: dValues };
}

function calculateADXArray(closes: number[], highs: number[], lows: number[], period = 14): number[] {
  const len = closes.length;
  const adx: number[] = new Array(len).fill(0);
  const tr: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < len; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const smoothTR = calculateEMA(tr, period);
  const smoothPDM = calculateEMA(plusDM, period);
  const smoothMDM = calculateEMA(minusDM, period);
  for (let i = period; i < len; i++) {
    const pDI = smoothTR[i] > 0 ? (smoothPDM[i] / smoothTR[i]) * 100 : 0;
    const mDI = smoothTR[i] > 0 ? (smoothMDM[i] / smoothTR[i]) * 100 : 0;
    adx[i] = (pDI + mDI) > 0 ? (Math.abs(pDI - mDI) / (pDI + mDI)) * 100 : 0;
  }
  return calculateEMA(adx, period);
}

function calculateATRArray(closes: number[], highs: number[], lows: number[], period = 14): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return calculateEMA(tr, period);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name = 'Custom Strategy',
      symbol,
      period = '1y',
      initialCapital = 100000,
      stopLoss = 5,
      takeProfit = 10,
      rules = [],
    } = body;

    if (!symbol || !rules.length) {
      return NextResponse.json({ error: 'Sembol ve en az bir kural gerekli' }, { status: 400 });
    }

    // Fetch data
    const endDate = new Date();
    const startDate = new Date();
    let interval = '1d';
    let minBars = 50;
    switch (period) {
      case '1d': startDate.setDate(endDate.getDate() - 5); interval = '5m'; minBars = 20; break;
      case '1w': startDate.setDate(endDate.getDate() - 10); interval = '15m'; minBars = 20; break;
      case '15d': startDate.setDate(endDate.getDate() - 20); interval = '30m'; minBars = 20; break;
      case '1m': startDate.setMonth(endDate.getMonth() - 1); interval = '1h'; minBars = 20; break;
      case '3m': startDate.setMonth(endDate.getMonth() - 3); interval = '1d'; minBars = 30; break;
      case '6m': startDate.setMonth(endDate.getMonth() - 6); interval = '1d'; break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); interval = '1d'; break;
      case '2y': startDate.setFullYear(endDate.getFullYear() - 2); interval = '1d'; break;
      case '3y': startDate.setFullYear(endDate.getFullYear() - 3); interval = '1d'; break;
      default: startDate.setFullYear(endDate.getFullYear() - 1); interval = '1d'; break;
    }

    let chart: any;
    try {
      chart = await cachedChart(symbol, { period1: startDate, period2: endDate, interval: interval as any });
    } catch {
      return NextResponse.json({ error: 'Veri alınamadı' }, { status: 400 });
    }

    const quotes = (chart?.quotes || []).filter((q: any) => q.close && q.high && q.low && q.open) as any[];
    if (quotes.length < minBars) return NextResponse.json({ error: 'Yeterli veri yok. Daha uzun bir dönem seçin.' }, { status: 400 });

    const closes = quotes.map((q: any) => q.close as number);
    const highs = quotes.map((q: any) => q.high as number);
    const lows = quotes.map((q: any) => q.low as number);
    const volumes = quotes.map((q: any) => (q.volume || 0) as number);

    // Pre-calculate indicators
    const macdData = calculateMACD(closes);
    const bbData = calculateBollingerArray(closes, 20, 2);
    const stochData = calculateStochasticArray(closes, highs, lows);
    const adxArr = calculateADXArray(closes, highs, lows);
    const atrArr = calculateATRArray(closes, highs, lows);
    const indicators: Record<string, number[]> = {
      ema10: calculateEMA(closes, 10),
      ema20: calculateEMA(closes, 20),
      ema50: calculateEMA(closes, 50),
      ema200: calculateEMA(closes, Math.min(200, closes.length - 1)),
      rsi14: calculateRSI(closes, 14),
      macd: macdData.macd,
      macdSignal: macdData.signal,
      bollingerUpper: bbData.upper,
      bollingerMiddle: bbData.middle,
      bollingerLower: bbData.lower,
      stochK: stochData.k,
      stochD: stochData.d,
      adx: adxArr,
      atr: atrArr,
    };

    // Simulate strategy
    let capital = initialCapital;
    let position = 0;
    let entryPrice = 0;
    const trades: any[] = [];
    const equity: number[] = [];
    const lookback = Math.min(50, Math.floor(closes.length * 0.2));
    const startIdx = Math.max(lookback, 10);

    for (let i = startIdx; i < closes.length; i++) {
      const ctx: Record<string, number> = {
        price: closes[i],
        prevPrice: closes[i - 1],
        high: highs[i],
        low: lows[i],
        volume: volumes[i],
        avgVolume: volumes.slice(Math.max(0, i - 20), i).reduce((a: number, b: number) => a + b, 0) / 20,
        ema10: indicators.ema10[i],
        ema20: indicators.ema20[i],
        ema50: indicators.ema50[i],
        ema200: indicators.ema200[i],
        prevEma10: indicators.ema10[i - 1],
        prevEma20: indicators.ema20[i - 1],
        prevEma50: indicators.ema50[i - 1],
        prevEma200: indicators.ema200[i - 1],
        rsi: indicators.rsi14[i],
        prevRsi: indicators.rsi14[i - 1],
        macd: indicators.macd[i],
        macdSignal: indicators.macdSignal[i],
        prevMacd: indicators.macd[i - 1],
        prevMacdSignal: indicators.macdSignal[i - 1],
        bollingerUpper: indicators.bollingerUpper[i],
        bollingerMiddle: indicators.bollingerMiddle[i],
        bollingerLower: indicators.bollingerLower[i],
        prevBollingerUpper: indicators.bollingerUpper[i - 1],
        prevBollingerMiddle: indicators.bollingerMiddle[i - 1],
        prevBollingerLower: indicators.bollingerLower[i - 1],
        stochK: indicators.stochK[i],
        stochD: indicators.stochD[i],
        prevStochK: indicators.stochK[i - 1],
        prevStochD: indicators.stochD[i - 1],
        adx: indicators.adx[i],
        prevAdx: indicators.adx[i - 1],
        atr: indicators.atr[i],
        prevAtr: indicators.atr[i - 1],
      };

      if (position === 0) {
        // Check buy rules
        const shouldBuy = rules.every((rule: any) => evaluateRule(rule, ctx, 'buy'));
        if (shouldBuy) {
          const qty = Math.floor(capital / closes[i]);
          if (qty > 0) {
            position = qty;
            entryPrice = closes[i];
            capital -= qty * closes[i];
          }
        }
      } else {
        // Check sell rules or stop/take
        const pnlPct = ((closes[i] - entryPrice) / entryPrice) * 100;
        const shouldSell = rules.some((rule: any) => evaluateRule(rule, ctx, 'sell'));
        const hitStop = pnlPct <= -stopLoss;
        const hitTarget = pnlPct >= takeProfit;

        if (shouldSell || hitStop || hitTarget) {
          capital += position * closes[i];
          const pnl = (closes[i] - entryPrice) * position;
          trades.push({
            entry: entryPrice,
            exit: closes[i],
            pnl,
            pnlPercent: pnlPct,
            reason: hitStop ? 'Stop Loss' : hitTarget ? 'Take Profit' : 'Sinyal',
            date: quotes[i].date ? new Date(quotes[i].date).toLocaleDateString('tr-TR') : `G${i}`,
          });
          position = 0;
        }
      }

      equity.push(capital + position * closes[i]);
    }

    // Close remaining
    if (position > 0) {
      const lastPrice = closes[closes.length - 1];
      capital += position * lastPrice;
      const pnl = (lastPrice - entryPrice) * position;
      trades.push({ entry: entryPrice, exit: lastPrice, pnl, pnlPercent: ((lastPrice - entryPrice) / entryPrice) * 100, reason: 'Açık Pozisyon', date: 'Son' });
      position = 0;
      equity[equity.length - 1] = capital;
    }

    const winTrades = trades.filter((t: any) => t.pnl > 0);
    const lossTrades = trades.filter((t: any) => t.pnl <= 0);
    const totalReturn = ((capital - initialCapital) / initialCapital) * 100;

    return NextResponse.json({
      name,
      symbol,
      period,
      summary: {
        initialCapital,
        finalCapital: capital,
        totalReturn: Math.round(totalReturn * 100) / 100,
        totalTrades: trades.length,
        winRate: trades.length > 0 ? Math.round((winTrades.length / trades.length) * 100) : 0,
        avgWin: winTrades.length > 0 ? winTrades.reduce((s: number, t: any) => s + t.pnlPercent, 0) / winTrades.length : 0,
        avgLoss: lossTrades.length > 0 ? lossTrades.reduce((s: number, t: any) => s + t.pnlPercent, 0) / lossTrades.length : 0,
        maxDrawdown: calculateMaxDrawdown(equity),
      },
      equity,
      trades,
    });
  } catch (err: any) {
    console.error('Strategy builder error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function evaluateRule(rule: any, ctx: Record<string, number>, direction: string): boolean {
  if (rule.direction !== direction && rule.direction !== 'both') return true;
  const left = ctx[rule.indicator] ?? 0;
  const right = rule.compareWith === 'value' ? rule.value : (ctx[rule.compareIndicator] ?? 0);

  switch (rule.operator) {
    case 'gt': return left > right;
    case 'lt': return left < right;
    case 'cross_above': {
      const prevLeft = ctx[`prev${capitalize(rule.indicator)}`] ?? left;
      const prevRight = rule.compareWith === 'value' ? rule.value : (ctx[`prev${capitalize(rule.compareIndicator)}`] ?? right);
      return prevLeft <= prevRight && left > right;
    }
    case 'cross_below': {
      const prevLeft = ctx[`prev${capitalize(rule.indicator)}`] ?? left;
      const prevRight = rule.compareWith === 'value' ? rule.value : (ctx[`prev${capitalize(rule.compareIndicator)}`] ?? right);
      return prevLeft >= prevRight && left < right;
    }
    default: return true;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function calculateMaxDrawdown(equity: number[]): number {
  let peak = equity[0];
  let maxDD = 0;
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = ((peak - val) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return Math.round(maxDD * 100) / 100;
}
