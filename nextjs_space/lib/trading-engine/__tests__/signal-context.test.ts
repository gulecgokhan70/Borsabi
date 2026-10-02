import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeMarket } from '../analyze';
import { scoreSignal } from '../signal-engine';
import type { CandleData } from '../types';
const start = Date.UTC(2024, 0, 1), day = 86400000;
const candles: CandleData[] = Array.from({ length: 240 }, (_, n) => ({ timestamp: start + n * day, closedAt: start + (n + 1) * day,
  open: 100 + n * 0.2, high: 101 + n * 0.2, low: 99 + n * 0.2, close: 100 + n * 0.2, volume: 100 }));
const input = { marketType: 'CRYPTO' as const, timeframe: '1d' as const, candles, asOf: start + 240 * day };
const analysis = analyzeMarket(input);
test('fresh aligned BTC and ETH context permits confirmed long, missing context blocks', () => {
  assert.equal(scoreSignal(input).direction, 'NONE');
  assert.equal(scoreSignal(input, analysis, { btc: analysis, eth: analysis, relativeStrength: 0 }).direction, 'LONG');
});
test('stale, future, mismatched or bearish BTC context cannot authorize crypto long', () => {
  for (const btc of [{ ...analysis, lastClosedAt: input.asOf - 2 * day }, { ...analysis, asOf: input.asOf + 1 },
    { ...analysis, timeframe: '1h' as const }, { ...analysis, regime: { ...analysis.regime, trend: 'DOWN' as const } }])
    assert.equal(scoreSignal(input, analysis, { btc, eth: analysis, relativeStrength: 0 }).direction, 'NONE');
});
test('stale asset candles block new signal even when supplied context is current', () => {
  const later = { ...input, asOf: input.asOf + 3 * day };
  const context = { ...analysis, asOf: later.asOf, lastClosedAt: later.asOf };
  const result = scoreSignal(later, analyzeMarket(later), { btc: context, eth: context, relativeStrength: 0 });
  assert.equal(result.direction, 'NONE');
  assert.ok(result.warnings.some(w => w.includes('güncel değil')));
});
