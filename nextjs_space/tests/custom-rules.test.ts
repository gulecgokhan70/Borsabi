import { expect, it } from 'vitest';
import { matchesRule, customRuleSignal, type CustomRule } from '../lib/trading-engine/custom-rules';
import { evaluateMarket } from '../lib/trading-engine/engine';
import type { EngineDecision } from '../lib/trading-engine/types';
const buy: CustomRule = { id: 1, direction: 'buy', indicator: 'price', operator: 'gt', compareWith: 'value', compareIndicator: 'ema20', value: 0 };
const start = Date.UTC(2024, 0, 1);
const candles = Array.from({ length: 220 }, (_, n) => ({ timestamp: start + n * 86400000, closedAt: start + (n + 1) * 86400000,
  open: 100 + n, close: 101 + n, high: 102 + n, low: 99 + n, volume: n === 219 ? 300 : 100 }));
const original = () => evaluateMarket({ candles, marketType: 'BIST', timeframe: '1d', asOf: candles[219].closedAt });
it('crossings require both previous values and finite comparisons', () => {
  const rule = { ...buy, operator: 'cross_above' } as CustomRule;
  expect(matchesRule(rule, { price: 2 }, { price: -1 })).toBe(true);
  expect(matchesRule(rule, { price: 2 }, {})).toBe(false);
  expect(matchesRule(rule, { price: Infinity }, { price: -1 })).toBe(false);
  expect(matchesRule({ ...rule, compareWith: 'indicator' }, { price: 2, ema20: 1 }, { price: 0 })).toBe(false);
});
it('does not treat unrelated buy rules as automatic sells', () => {
  const decision = original(); decision.signal.direction = 'LONG';
  const signal = customRuleSignal([buy, { ...buy, id: 2, direction: 'sell', value: 1e9 }], candles, decision);
  expect(signal.direction).toBe('LONG');
  expect(customRuleSignal([{ ...buy, direction: 'sell', value: 1e9 }], candles, decision).direction).toBe('NONE');
});
it('requires all buys but any sell requests an exit, with sell precedence', () => {
  const decision = original(); decision.signal.direction = 'LONG';
  expect(customRuleSignal([buy, { ...buy, id: 2, value: 1e9 }], candles, decision).direction).toBe('NONE');
  expect(customRuleSignal([buy, { ...buy, id: 2, direction: 'sell' }], candles, decision).direction).toBe('SHORT');
});
it('custom rules never manufacture a long when the V2 context or freshness gate blocks it', () => {
  const decision = evaluateMarket({ candles, marketType: 'CRYPTO', timeframe: '1d', asOf: candles[219].closedAt });
  expect(decision.signal.direction).toBe('NONE');
  expect(customRuleSignal([buy], candles, decision).direction).toBe('NONE');
});
it('volume crossings use previous volume and a baseline excluding the current bar', () => {
  const decision = original(); decision.signal.direction = 'LONG';
  const rule: CustomRule = { ...buy, indicator: 'volume', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'avgVolume' };
  expect(customRuleSignal([rule], candles, decision).direction).toBe('LONG');
});
it('insufficient indicator history cannot satisfy custom rules', () => {
  const decision = { ...original(), analysis: { ...original().analysis, status: 'INSUFFICIENT_DATA' } } as EngineDecision;
  expect(customRuleSignal([buy], candles.slice(0, 50), decision).direction).toBe('NONE');
});
