import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTradingProfile } from '../config';
import { planTrade } from '../risk-engine';
import { exitOnBar, ratchetTrailing } from '../execution';
import { sessionOpen, providerCandles } from '../adapter';
import { runEngineBacktest } from '../backtest-engine';
import { walkForward } from '../walk-forward';
import type { AccountRisk, CandleData, SignalResult, SimPosition } from '../types';
const costs = { commission: 0.001, spread: 0.001, slippage: 0.001 };
const signal: SignalResult = { score: 85, confidence: 0.8, direction: 'LONG', strategy: 'TREND_FOLLOWING',
  regime: 'TREND_UP', reasons: ['test'], warnings: [], components: { trend: 25, momentum: 20, volume: 15, volatility: 10, structure: 15, candle: 0, regime: 5 } };
const account: AccountRisk = { equity: 100000, cash: 100000, exposure: 0, dailyLoss: 0,
  dayStartEquity: 100000, consecutiveLosses: 0, correlatedExposure: 0, allocationLimit: 60000, orderLimit: 25000 };
const position: SimPosition = { side: 'LONG', quantity: 10, entry: 100, entryFee: 1, openedAt: 1,
  stopLoss: 95, takeProfit: 110, extreme: 100, trailingPercent: 0, strategy: 'TREND_FOLLOWING', regime: 'TREND_UP', score: 85, entryReason: 'test' };
const bar: CandleData = { timestamp: 1, closedAt: 2, open: 100, high: 115, low: 90, close: 105, volume: 100 };
test('position size includes costs and remains within risk, cash and allocation caps', () => {
  for (const market of ['BIST', 'CRYPTO'] as const) {
    const profile = getTradingProfile(market);
    const plan = planTrade(100, 3, signal, account, profile, costs, 2, 3);
    assert.ok(plan.allowed);
    assert.ok(plan.riskAmount <= account.equity * profile.risk.maxRiskPerTrade + 1e-8);
    assert.ok(plan.cost <= account.orderLimit && plan.cost <= account.cash);
    assert.ok(plan.riskReward >= 1.5);
    if (market === 'BIST') assert.equal(plan.quantity, Math.floor(plan.quantity));
  }
});
test('daily loss, consecutive losses, correlated exposure and cash each block new entry', () => {
  for (const changes of [{ dailyLoss: 10000 }, { consecutiveLosses: 3 }, { correlatedExposure: 30000 }, { cash: 0 }, { allocationLimit: 0 }]) {
    assert.equal(planTrade(100, 3, signal, { ...account, ...changes }, getTradingProfile('BIST'), costs).allowed, false);
  }
});
test('NaN signals and invalid costs cannot bypass risk gate', () => {
  for (const changes of [{ score: NaN }, { confidence: NaN }, { confidence: 2 }, { score: Infinity }])
    assert.equal(planTrade(100, 3, { ...signal, ...changes }, account, getTradingProfile('BIST'), costs).allowed, false);
  assert.equal(planTrade(100, 3, signal, account, getTradingProfile('BIST'), { ...costs, slippage: -1 }).allowed, false);
});
test('shorts remain disabled and higher volatility lowers risk budget', () => {
  const profile = getTradingProfile('BIST');
  assert.equal(planTrade(100, 3, { ...signal, direction: 'SHORT' }, account, profile, costs).allowed, false);
  const normal = planTrade(100, 3, signal, account, profile, costs, 2, 3);
  const volatile = planTrade(100, 3, { ...signal, regime: 'HIGH_VOLATILITY' }, account, profile, costs, 2, 3);
  assert.ok(volatile.allowed && volatile.riskAmount < normal.riskAmount);
});
test('ambiguous long and short OHLC use stop first; gaps use actual opening price', () => {
  assert.deepEqual(exitOnBar(position, bar), { price: 95, reason: 'STOP_LOSS' });
  assert.deepEqual(exitOnBar(position, { ...bar, open: 92 }), { price: 92, reason: 'STOP_GAP' });
  const short: SimPosition = { ...position, side: 'SHORT', stopLoss: 105, takeProfit: 90 };
  assert.deepEqual(exitOnBar(short, bar), { price: 105, reason: 'STOP_LOSS' });
  assert.deepEqual(exitOnBar(short, { ...bar, open: 108 }), { price: 108, reason: 'STOP_GAP' });
});
test('trailing extreme updates only after current bar exit checks', () => {
  const held = { ...position, stopLoss: 80, takeProfit: 200, trailingPercent: 0.05 };
  const candle = { ...bar, low: 96, high: 120 };
  assert.equal(exitOnBar(held, candle), null);
  const next = ratchetTrailing(held, candle.high, candle.low);
  assert.equal(next.extreme, 120);
  assert.equal(held.extreme, 100);
  assert.equal(exitOnBar(next, { ...candle, open: 118, low: 110 })?.reason, 'TRAILING_STOP');
});
test('BIST session gates weekends, holidays and out-of-session fills', () => {
  assert.ok(sessionOpen(Date.UTC(2026, 9, 2, 7), 'BIST'));
  assert.equal(sessionOpen(Date.UTC(2026, 9, 2, 15), 'BIST'), false);
  assert.equal(sessionOpen(Date.UTC(2026, 9, 3, 8), 'BIST'), false);
  assert.equal(sessionOpen(Date.UTC(2026, 9, 2, 8), 'BIST', ['2026-10-02']), false);
  assert.ok(sessionOpen(Date.UTC(2026, 9, 3, 8), 'CRYPTO'));
});
test('provider daily candle cannot be used before its conservative close', () => {
  const [candle] = providerCandles([{ date: new Date('2026-10-02T07:00:00Z'), open: 100, high: 110, low: 90, close: 105, volume: 100 }], 'BIST', '1d');
  assert.equal(candle.timestamp, Date.parse('2026-10-01T21:00:00Z'));
  assert.equal(candle.closedAt, Date.parse('2026-10-02T21:00:00Z'));
});
function history(count: number): CandleData[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: count }, (_, n) => { const price = 100 + n * 0.1 + Math.sin(n / 8);
    return { timestamp: start + n * 86400000, closedAt: start + (n + 1) * 86400000, open: price, close: price + 0.1, high: price + 2, low: price - 2, volume: 100 }; });
}
test('backtest costs reconcile to net profit and forced liquidation', () => {
  const result = runEngineBacktest({ candles: history(260), market: 'CRYPTO', timeframe: '1d', initialCapital: 100000, costs,
    customSignal: () => signal, stopMultiplier: 2, rewardRatio: 3 });
  assert.ok(result.trades.length > 0);
  assert.ok(Math.abs(result.trades.reduce((sum, trade) => sum + trade.pnl, 0) - (result.summary.finalCapital - 100000)) < 1e-7);
  assert.ok(result.trades.every(t => t.exitTime >= t.entryTime && t.fees > 0 && t.slippageCost > 0));
});
test('walk-forward first selected parameters do not depend on later prices', () => {
  const candles = history(340);
  const options = { candles, market: 'CRYPTO' as const, timeframe: '1d' as const, initialCapital: 100000, costs, customSignal: () => signal };
  const a = walkForward(options, 220, 20);
  const changed = candles.map((c, n) => n < 240 ? c : { ...c, open: c.open * 2, high: c.high * 2, low: c.low * 2, close: c.close * 2 });
  const b = walkForward({ ...options, candles: changed }, 220, 20);
  assert.deepEqual(a.windows[0], b.windows[0]);
});
