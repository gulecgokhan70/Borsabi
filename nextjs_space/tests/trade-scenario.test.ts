import { expect, it } from 'vitest';
import { tradeScenario } from '../lib/trade-scenario';
it('includes both commissions even when the price stays unchanged', () => {
  const s = tradeScenario(10, 100, .002, 2000, 0)!;
  expect(s.netResult).toBe(-4);
  expect(s.allocationPercent).toBeCloseTo(1000 / 1998 * 100);
  expect(tradeScenario(10, 100, 0, 2000, 0)!.netResult).toBe(0);
});
it('models a fall in native crypto price at fixed FX and recalculates the sale fee', () => {
  const s = tradeScenario(.1, 100 * 30, .002, 1000, -5)!;
  expect(s.scenarioValue).toBe(285);
  expect(s.buyFee).toBeCloseTo(.6); expect(s.sellFee).toBeCloseTo(.57);
  expect(s.netResult).toBeCloseTo(-16.17);
});
it('rejects invalid amounts and never invents missing portfolio equity', () => {
  for (const qty of [0, -1, NaN, Infinity]) expect(tradeScenario(qty, 100, .002, 1000, -5)).toBeNull();
  expect(tradeScenario(1, 0, .002, 1000, -5)).toBeNull();
  expect(tradeScenario(1, 100, .002, null, -5)!.allocationPercent).toBeNull();
  expect(tradeScenario(1e308, 1e308, .002, 1000, -5)).toBeNull();
});
