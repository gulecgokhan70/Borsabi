import { expect, it } from 'vitest';
import { explainPortfolio } from '../lib/portfolio-explanation';
const buy = (quantity = 1) => ({ type: 'BUY', symbol: 'THYAO.IS', commission: .6 * quantity, pnl: null, pricePnlTry: null, fxPnlTry: null });
const sell = { type: 'SELL', symbol: 'THYAO.IS', commission: .6, pnl: -1.2, pricePnlTry: 0, fxPnlTry: 0 };
it('explains unchanged-price round trip as exactly two commissions, not four', () => {
  const result = explainPortfolio(100000, 99998.8, [], [buy(), sell]);
  expect(result.netChange).toBeCloseTo(-1.2);
  expect(result.commissions).toBeCloseTo(1.2);
  expect(result.realizedNet).toBeCloseTo(-1.2);
  expect(result.unexplained).toBeCloseTo(0);
  expect(result.contributors[0].net).toBeCloseTo(-1.2);
});
it('adds price and FX effects for remaining holdings and partial sales without reallocating fees twice', () => {
  const result = explainPortfolio(1000, 668.14, [{ symbol: 'THYAO.IS', totalValue: 360, pnl: 19.4, breakdown: { pricePnlTry: 20, fxPnlTry: 0 } }],
    [buy(2), { ...sell, commission: .66, pnl: 8.74, pricePnlTry: 10, fxPnlTry: 0 }]);
  expect(result.netChange).toBeCloseTo(28.14);
  expect(result.commissions).toBeCloseTo(1.86);
  expect(result.priceEffect).toBe(30);
  expect(result.unexplained).toBeCloseTo(0);
  expect(result.realizedNet + result.openNet).toBeCloseTo(result.netChange);
});
it('attributes crypto price and FX separately in TRY, including zero commission', () => {
  const result = explainPortfolio(1000, 600, [{ symbol: 'BTC-USD', totalValue: 462, pnl: 62, priceStale: true, breakdown: { pricePnlTry: 40, fxPnlTry: 22 } }],
    [{ ...buy(), symbol: 'BTC-USD', commission: 0 }]);
  expect(result.priceEffect).toBe(40); expect(result.fxEffect).toBe(22);
  expect(result.netChange).toBe(62); expect(result.unexplained).toBe(0);
  expect(result.hasStalePrices).toBe(true);
});
it('does not invent a price/FX attribution for legacy sales or balance discrepancies', () => {
  const result = explainPortfolio(1000, 1010, [], [{ ...sell, pnl: 10, pricePnlTry: null, fxPnlTry: null }]);
  expect(result.missingBreakdowns).toBe(1);
  expect(result.contributors[0].incomplete).toBe(true);
  expect(result.unexplained).toBeCloseTo(10.6);
  expect(result.netChange).toBe(10);
});
it('shows a truly empty account without fabricated gains', () => {
  const result = explainPortfolio(1000, 1000, [], []);
  expect(result.netChange).toBe(0); expect(result.commissions).toBe(0); expect(result.contributors).toEqual([]);
});
