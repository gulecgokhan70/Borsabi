export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { yf } from '@/lib/yahoo-finance';

function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push((data[i] * k) + (ema[i - 1] * (1 - k)));
  }
  return ema;
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsiValues: number[] = new Array(closes.length).fill(50);
  for (let j = period + 1; j < closes.length; j++) {
    let gains = 0, losses = 0;
    for (let i = j - period; i < j; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    rsiValues[j] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  }
  return rsiValues;
}

function calculateMACD(closes: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

interface Trade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  type: 'LONG';
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  exitReason: string;
}

function runBacktest(
  closes: number[],
  dates: string[],
  strategy: string,
  stopLossPercent: number,
  takeProfitPercent: number
): { trades: Trade[]; equity: number[] } {
  const trades: Trade[] = [];
  const equity: number[] = [100000];
  let capital = 100000;
  let inTrade = false;
  let entryPrice = 0;
  let entryIdx = 0;
  const commissionRate = 0.002;

  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, Math.min(200, closes.length - 1));
  const rsiValues = calculateRSI(closes);
  const macd = calculateMACD(closes);

  const startIdx = Math.max(50, 26);

  for (let i = startIdx; i < closes.length; i++) {
    const price = closes[i];

    if (!inTrade) {
      let enterSignal = false;

      switch (strategy) {
        case 'ema-crossover':
          enterSignal = ema20[i] > ema50[i] && ema20[i - 1] <= ema50[i - 1] && price > ema200[i];
          break;
        case 'rsi-reversal':
          enterSignal = rsiValues[i] > 30 && rsiValues[i - 1] <= 30;
          break;
        case 'macd-crossover':
          enterSignal = macd.macd[i] > macd.signal[i] && macd.macd[i - 1] <= macd.signal[i - 1];
          break;
        case 'trend-following':
          enterSignal = price > ema20[i] && ema20[i] > ema50[i] && ema50[i] > ema200[i] && rsiValues[i] > 40 && rsiValues[i] < 70;
          break;
        case 'breakout':
          const high20 = Math.max(...closes.slice(Math.max(0, i - 20), i));
          enterSignal = price > high20 && rsiValues[i] < 75;
          break;
        default:
          enterSignal = ema20[i] > ema50[i] && ema20[i - 1] <= ema50[i - 1];
      }

      if (enterSignal) {
        inTrade = true;
        entryPrice = price;
        entryIdx = i;
      }
    } else {
      const changePercent = ((price - entryPrice) / entryPrice) * 100;
      let exitReason = '';

      if (changePercent <= -stopLossPercent) {
        exitReason = 'Stop Loss';
      } else if (changePercent >= takeProfitPercent) {
        exitReason = 'Take Profit';
      } else {
        switch (strategy) {
          case 'ema-crossover':
            if (ema20[i] < ema50[i] && ema20[i - 1] >= ema50[i - 1]) exitReason = 'EMA Kesişim Satış';
            break;
          case 'rsi-reversal':
            if (rsiValues[i] > 70) exitReason = 'RSI Aşırı Alım';
            break;
          case 'macd-crossover':
            if (macd.macd[i] < macd.signal[i] && macd.macd[i - 1] >= macd.signal[i - 1]) exitReason = 'MACD Satış';
            break;
          case 'trend-following':
            if (price < ema50[i]) exitReason = 'Trend Kırılımı';
            break;
          case 'breakout':
            if (price < ema20[i]) exitReason = 'EMA20 Altına Düşüş';
            break;
        }
      }

      if (exitReason) {
        const commission = entryPrice * commissionRate + price * commissionRate;
        const qty = Math.floor((capital * 0.95) / entryPrice);
        const pnl = (price - entryPrice) * qty - commission * qty;
        const pnlPercent = ((price - entryPrice) / entryPrice) * 100;
        const holdingDays = i - entryIdx;

        trades.push({
          entryDate: dates[entryIdx],
          exitDate: dates[i],
          entryPrice: Math.round(entryPrice * 100) / 100,
          exitPrice: Math.round(price * 100) / 100,
          type: 'LONG',
          pnl: Math.round(pnl * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 100) / 100,
          holdingDays,
          exitReason,
        });

        capital += pnl;
        inTrade = false;
      }
    }
    equity.push(Math.round(capital * 100) / 100);
  }

  return { trades, equity };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, strategy, period, stopLoss, takeProfit } = body;

    if (!symbol || !strategy) {
      return NextResponse.json({ error: 'Sembol ve strateji gerekli' }, { status: 400 });
    }

    const endDate = new Date();
    const startDate = new Date();
    switch (period || '1y') {
      case '6m': startDate.setMonth(endDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
      case '2y': startDate.setFullYear(endDate.getFullYear() - 2); break;
      case '3y': startDate.setFullYear(endDate.getFullYear() - 3); break;
      default: startDate.setFullYear(endDate.getFullYear() - 1);
    }

    const chart = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d' as any,
    });

    if (!chart || !chart.quotes || chart.quotes.length < 50) {
      return NextResponse.json({ error: 'Yeterli veri bulunamadı' }, { status: 400 });
    }

    const validQuotes = chart.quotes.filter((q: any) => q?.close > 0 && q?.date);
    const closes = validQuotes.map((q: any) => q.close);
    const dates = validQuotes.map((q: any) => new Date(q.date).toISOString().split('T')[0]);

    const { trades, equity } = runBacktest(
      closes, dates, strategy,
      stopLoss || 3, takeProfit || 6
    );

    const winningTrades = trades.filter((t: Trade) => t.pnl > 0);
    const losingTrades = trades.filter((t: Trade) => t.pnl <= 0);
    const totalPnL = trades.reduce((s: number, t: Trade) => s + t.pnl, 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s: number, t: Trade) => s + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s: number, t: Trade) => s + t.pnl, 0) / losingTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    const maxDrawdown = calculateMaxDrawdown(equity);
    const avgHoldingDays = trades.length > 0 ? Math.round(trades.reduce((s: number, t: Trade) => s + t.holdingDays, 0) / trades.length) : 0;
    const totalReturn = ((equity[equity.length - 1] - 100000) / 100000) * 100;

    const equitySampled = equity.length > 100
      ? equity.filter((_: number, i: number) => i % Math.ceil(equity.length / 100) === 0 || i === equity.length - 1)
      : equity;

    return NextResponse.json({
      summary: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: Math.round(winRate * 100) / 100,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        avgHoldingDays,
        finalCapital: equity[equity.length - 1],
      },
      trades: trades.slice(-20),
      equity: equitySampled,
    });
  } catch (error: any) {
    console.error('Backtest error:', error);
    return NextResponse.json({ error: 'Backtest yapılamadı' }, { status: 500 });
  }
}

function calculateMaxDrawdown(equity: number[]): number {
  let maxDD = 0;
  let peak = equity[0];
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = ((peak - val) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}
