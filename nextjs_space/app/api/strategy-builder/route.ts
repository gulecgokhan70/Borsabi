export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BIST_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { yf } from '@/lib/yahoo-finance';

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
    const periodMap: Record<string, number> = { '6m': 180, '1y': 365, '2y': 730, '3y': 1095 };
    const days = periodMap[period] || 365;
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    let chart: any;
    try {
      chart = await yf.chart(symbol, { period1: startDate, period2: endDate, interval: '1d' as any });
    } catch {
      return NextResponse.json({ error: 'Veri alınamadı' }, { status: 400 });
    }

    const quotes = (chart?.quotes || []).filter((q: any) => q.close && q.high && q.low && q.open) as any[];
    if (quotes.length < 50) return NextResponse.json({ error: 'Yeterli veri yok' }, { status: 400 });

    const closes = quotes.map((q: any) => q.close as number);
    const highs = quotes.map((q: any) => q.high as number);
    const lows = quotes.map((q: any) => q.low as number);
    const volumes = quotes.map((q: any) => (q.volume || 0) as number);

    // Pre-calculate indicators
    const indicators: Record<string, number[]> = {
      ema10: calculateEMA(closes, 10),
      ema20: calculateEMA(closes, 20),
      ema50: calculateEMA(closes, 50),
      rsi14: calculateRSI(closes, 14),
    };

    // Simulate strategy
    let capital = initialCapital;
    let position = 0;
    let entryPrice = 0;
    const trades: any[] = [];
    const equity: number[] = [];

    for (let i = 50; i < closes.length; i++) {
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
        prevEma10: indicators.ema10[i - 1],
        prevEma20: indicators.ema20[i - 1],
        prevEma50: indicators.ema50[i - 1],
        rsi: indicators.rsi14[i],
        prevRsi: indicators.rsi14[i - 1],
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
