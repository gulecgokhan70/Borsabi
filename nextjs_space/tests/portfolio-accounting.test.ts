import { expect, it } from 'vitest';
import { buildEquityCurve, summarizeSales } from '../lib/portfolio-accounting';
it('equity includes both commissions and removes proportional cost on each sale', () => {
  const common = { symbol: 'THYAO.IS', createdAt: new Date('2026-06-01T10:00:00Z') };
  const entries = [
    { ...common, type: 'BUY', quantity: 10, total: 1000, commission: 2, pnl: null },
    { ...common, type: 'SELL', quantity: 5, total: 550, commission: 1.1, pnl: 47.9 },
    { ...common, type: 'SELL', quantity: 5, total: 600, commission: 1.2, pnl: 97.8 },
  ];
  expect(buildEquityCurve(100000, entries).map(p => p.balance)).toEqual([100000, 99998, 100046.9, 100145.7]);
  expect(summarizeSales(entries).realizedPnl).toBeCloseTo(145.7);
  expect(summarizeSales(entries).totalTrades).toBe(2);
});
it('counts partial sales even with an open position and more than 50 sales', () => {
  const sales = Array.from({ length: 60 }, () => ({ type: 'SELL', pnl: 10 }));
  expect(summarizeSales(sales)).toEqual({ realizedPnl: 600, winRate: 100, totalTrades: 60 });
});
it('empty history has a finite zero win rate', () => {
  expect(summarizeSales([])).toEqual({ realizedPnl: 0, winRate: 0, totalTrades: 0 });
});
