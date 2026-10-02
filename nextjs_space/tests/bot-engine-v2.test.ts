import { expect, it } from 'vitest';
import { analyzeMarket } from '../lib/trading-engine/analyze';
import { autoInitial, autoStep, controlAuto, INTERVAL, rankObservation, type AutoConfig, type Observation } from '../lib/bot-lab/auto-engine';
const now = Date.parse('2026-10-02T11:00:00Z');
const config: AutoConfig = { mode: 'auto-v2', tradingEngine: 'v2', market: 'CRYPTO', symbols: ['BTC-USD'], commission: 0.001,
  friction: 0.0001, orderFraction: 0.05, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04, maxPositions: 3 };
function observation(time = now, fxRate = 40): Observation {
  const candles = Array.from({ length: 240 }, (_, n) => { const price = 100 + n * 0.2;
    return { timestamp: now - (240 - n) * INTERVAL, closedAt: now - (239 - n) * INTERVAL,
      open: price, high: price + 0.25, low: price - 0.25, close: price, volume: 100 }; });
  const context = analyzeMarket({ candles, marketType: 'CRYPTO', timeframe: '15m', asOf: time });
  return { symbol: 'BTC-USD', candles, bars: candles.map(c => ({ time: c.closedAt, close: c.close, volume: c.volume })),
    context: { btc: context, eth: context, relativeStrength: 0 }, fxRate, tick: { time, price: candles[239].close * fxRate, open: true } };
}
function ready() {
  const state = autoInitial(); state.paused = false; state.lastBars['BTC-USD'] = now - INTERVAL; return state;
}
function signal() { return autoStep(ready(), config, [observation()], now).state; }
it('uses shared V2 score, requires 200 OHLC candles and crypto context, never legacy crossover fallback', () => {
  expect(rankObservation(observation(), 'CRYPTO', now, true).eligible).toBe(true);
  expect(rankObservation({ ...observation(), candles: [] }, 'CRYPTO', now, true).eligible).toBe(false);
  expect(rankObservation({ ...observation(), context: undefined }, 'CRYPTO', now, true).eligible).toBe(false);
});
it('does not retroactively fill first scan or signal quote; fills subsequent quote exactly once', () => {
  const first = ready(); first.lastBars = {};
  expect(autoStep(first, config, [observation()], now).state.pending).toEqual({});
  const pending = signal(); expect(pending.pending['BTC-USD'].side).toBe('BUY');
  expect(autoStep(pending, config, [observation()], now + 1000).events).toEqual([]);
  const filled = autoStep(pending, config, [observation(now + 60000)], now + 60000);
  const holding = filled.state.holdings['BTC-USD'];
  expect(holding).toBeDefined(); expect(holding.stopLossTry).toBeLessThan(holding.entry); expect(holding.takeProfitTry).toBeGreaterThan(holding.entry);
  expect(holding.entryFee + holding.quantity * holding.entry).toBeLessThanOrEqual(5000);
  expect(filled.events.filter(e => e.action === 'BUY')).toHaveLength(1);
  expect(autoStep(filled.state, config, [observation(now + 60000)], now + 60000).events).toEqual([]);
});
it('ATR distances are converted from native USD to TRY with actual observed FX', () => {
  const a = autoStep(signal(), config, [observation(now + 60000, 40)], now + 60000).state.holdings['BTC-USD'];
  const b = autoStep(signal(), config, [observation(now + 60000, 80)], now + 60000).state.holdings['BTC-USD'];
  expect(b.entry - b.stopLossTry!).toBeCloseTo(2 * (a.entry - a.stopLossTry!), 8);
  expect(b.entry).toBeCloseTo(a.entry * 2, 8);
});
it('missing FX or lost context on fill rejects a pending buy without changing cash', () => {
  for (const override of [{ fxRate: undefined }, { fxRate: NaN }, { context: undefined }]) {
    const result = autoStep(signal(), config, [{ ...observation(now + 60000), ...override }], now + 60000);
    expect(result.state.cash).toBe(100000); expect(result.state.holdings).toEqual({});
  }
});
it('three consecutive losses block entry but protective ATR exits continue while paused', () => {
  const pending = signal(); pending.consecutiveLosses = 3;
  const blocked = autoStep(pending, config, [observation(now + 60000)], now + 60000);
  expect(blocked.state.holdings).toEqual({}); expect(blocked.events.some(e => e.reason.includes('Ardışık'))).toBe(true);
  const bought = autoStep(signal(), config, [observation(now + 60000)], now + 60000).state;
  const h = bought.holdings['BTC-USD'];
  const paused = controlAuto(bought, 'stop', now + 70000);
  const row = observation(now + 120000); row.tick.price = h.stopLossTry! - 10;
  const sold = autoStep(paused, config, [row], now + 120000);
  expect(sold.events.some(e => e.action === 'SELL')).toBe(true); expect(sold.state.holdings).toEqual({});
  expect(sold.state.consecutiveLosses).toBe(1);
  expect(controlAuto({ ...sold.state, consecutiveLosses: 3 }, 'start').consecutiveLosses).toBe(0);
});
it('upgraded legacy holding retains its original percentage stop', () => {
  const state = ready(); state.paused = true;
  state.holdings['BTC-USD'] = { quantity: 1, entry: 6000, entryFee: 6, mark: 6000, quoteTime: now - 1000, openedAt: now - 1000 };
  const row = observation(); row.tick.price = 5870;
  const result = autoStep(state, config, [row], now);
  expect(result.events.some(e => e.action === 'SELL')).toBe(true);
});
