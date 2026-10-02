import type { SimTrade } from './types';
export function performance(initial: number, equity: readonly number[], trades: readonly SimTrade[], barsPerYear: number) {
  const final = equity[equity.length - 1] ?? initial;
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0), grossLoss = -losses.reduce((s, t) => s + t.pnl, 0);
  let peak = initial, maxDrawdown = 0;
  for (const value of equity) { peak = Math.max(peak, value); maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - value) / peak * 100 : 0); }
  const returns = equity.map((v, n) => v / (n ? equity[n - 1] : initial) - 1);
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length ? returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length : 0;
  const downside = returns.length ? returns.reduce((s, v) => s + Math.min(0, v) ** 2, 0) / returns.length : 0;
  const avgWin = wins.length ? grossProfit / wins.length : 0, avgLoss = losses.length ? grossLoss / losses.length : 0;
  const netProfit = final - initial;
  return { initialCapital: initial, finalCapital: final, totalReturn: netProfit / initial * 100,
    netProfit, totalPnL: netProfit, grossProfit, grossLoss, totalTrades: trades.length,
    winningTrades: wins.length, losingTrades: losses.length, winRate: trades.length ? wins.length / trades.length * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null, avgWin, avgLoss,
    averageTrade: trades.length ? netProfit / trades.length : 0,
    expectancy: trades.length ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0,
    maxDrawdown, sharpeRatio: variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(barsPerYear) : null,
    sortinoRatio: downside > 0 ? mean / Math.sqrt(downside) * Math.sqrt(barsPerYear) : null,
    fees: trades.reduce((s, t) => s + t.fees, 0), totalCommission: trades.reduce((s, t) => s + t.fees, 0),
    slippageCost: trades.reduce((s, t) => s + t.slippageCost, 0),
    avgHoldingDays: trades.length ? trades.reduce((s, t) => s + (t.exitTime - t.entryTime) / 86400000, 0) / trades.length : 0 };
}
