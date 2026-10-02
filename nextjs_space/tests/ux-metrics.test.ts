import { describe, expect, it } from 'vitest';
import { percentagePoints, profitFactorOf, tradeQuantityError } from '@/lib/ux-metrics';

describe('reported UX data and quantity regressions', () => {
  it('preserves percentage points, including legitimate zero and sub-one percentages', () => {
    expect(percentagePoints(50.28)).toBe(50.28);
    expect(percentagePoints(0.5)).toBe(0.5);
    expect(percentagePoints(0)).toBe(0);
    for (const bad of [undefined, null, NaN, Infinity, -1, 5028, '50.28']) expect(percentagePoints(bad)).toBeNull();
  });
  it('uses total gains/total losses, not average win/average loss', () => {
    expect(profitFactorOf([100, 100, -50])).toEqual({ profitFactor: 4, profitFactorStatus: 'finite' });
    expect(profitFactorOf([-50])).toEqual({ profitFactor: 0, profitFactorStatus: 'finite' });
    expect(profitFactorOf([100])).toEqual({ profitFactor: null, profitFactorStatus: 'no-losses' });
    for (const values of [[], [0, 0]]) expect(profitFactorOf(values)).toEqual({ profitFactor: null, profitFactorStatus: 'no-results' });
  });
  it('blocks negative, nonfinite, fractional stocks, oversells and insufficient cash including fees', () => {
    for (const qty of [-1, 0, NaN, Infinity, 1.5]) expect(tradeQuantityError(qty, 'BUY', 0, 300, 1000, false)).not.toBeNull();
    expect(tradeQuantityError(2, 'SELL', 1, 600, 1000, false)).toContain('En fazla 1');
    expect(tradeQuantityError(0.001, 'SELL', 0, 10, 1000, true)).not.toBeNull();
    expect(tradeQuantityError(1, 'BUY', 0, 300.6, 300.5, false)).not.toBeNull();
    expect(tradeQuantityError(1, 'BUY', 0, 300.6, 300.6, false)).toBeNull();
    expect(tradeQuantityError(1, 'SELL', 1, 299.4, 0, false)).toBeNull();
    expect(tradeQuantityError(0.001, 'SELL', 0.001, 10, 0, true)).toBeNull();
  });
});
