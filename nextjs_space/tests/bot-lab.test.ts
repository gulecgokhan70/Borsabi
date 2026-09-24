import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Config, HOUR, initialState, step, crossover } from '../lib/bot-lab/engine';
import { replay } from '../lib/bot-lab/replay';
import { createBot, controlBot } from '../lib/bot-lab/validation';
const config: Config = { market: 'BIST', symbol: 'THYAO.IS', commission: 0.002, friction: 0.001, maxOrder: 10000, dailyLoss: 0.02 };
const now = Date.UTC(2026, 8, 24, 10);
const bars = Array.from({ length: 21 }, (_, i) => ({ time: now - (20 - i) * HOUR, close: i === 20 ? 110 : 100 }));
const tick = { price: 110, time: now, open: true };
test('closed-bar crossover only; no startup replay and no same-observation fill', () => {
  assert.equal(crossover(bars), 'BUY');
  assert.equal(step(initialState(), config, bars, tick, now).state.pending, null);
  const s = { ...initialState(), lastBar: now - HOUR };
  const signal = step(s, config, [...bars, { time: now + HOUR, close: 1 }], tick, now);
  assert.equal(signal.state.quantity, 0); assert.equal(signal.state.pending?.side, 'BUY');
  const duplicate = step(signal.state, config, bars, tick, now + 1000);
  assert.deepEqual(duplicate.state, signal.state);
  const buy = step(signal.state, config, bars, { ...tick, time: now + 60000 }, now + 60000);
  assert.equal(buy.decision.action, 'BUY'); assert.equal(buy.state.quantity, 90);
  assert.ok(100000 - buy.state.cash <= 10000); assert.ok(buy.state.fees > 0);
  assert.ok(buy.state.equity < 100000); assert.ok(buy.state.frictionCost > 0);
});
test('stale, future, missing timestamps and closed market do not change balances', () => {
  for (const t of [{ ...tick, time: now - HOUR }, { ...tick, time: now + 1 }, { ...tick, time: NaN }, { ...tick, open: false }, { ...tick, price: NaN }]) {
    const s = initialState(); assert.deepEqual(step(s, config, bars, t, now).state, s);
  }
});
test('loss cap includes open position and blocks for the rest of day even on recovery', () => {
  const s = { ...initialState(), cash: 0, quantity: 1000, dayEquity: 100000, equity: 100000, pending: { side: 'BUY' as const, after: now - 1000, expires: now + HOUR } };
  const halted = step(s, config, bars, { ...tick, price: 95 }, now);
  assert.equal(halted.decision.action, 'HALT'); assert.equal(halted.state.pending, null);
  assert.equal(halted.state.quantity, 1000);
  const recovery = step(halted.state, config, bars, { ...tick, time: now + 1000, price: 110 }, now + 1000);
  assert.equal(recovery.decision.action, 'HALT');
  const next = step(recovery.state, config, bars, { ...tick, time: now + 24 * HOUR, price: 110 }, now + 24 * HOUR);
  assert.notEqual(next.decision.action, 'HALT');
});
test('sell subtracts commission and adverse friction, duplicate quote cannot resell', () => {
  const s = { ...initialState(), cash: 90000, quantity: 100, pending: { side: 'SELL' as const, after: now - 1000, expires: now + HOUR } };
  const sold = step(s, config, bars, tick, now);
  assert.equal(sold.decision.action, 'SELL'); assert.equal(sold.state.quantity, 0);
  assert.ok(Math.abs(sold.state.cash - (90000 + 100 * 110 * 0.999 * 0.998)) < 1e-7);
  assert.deepEqual(step(sold.state, config, bars, tick, now).state, sold.state);
});
test('expired pending signals cannot execute', () => {
  const s = { ...initialState(), pending: { side: 'BUY' as const, after: now - 3 * HOUR, expires: now - 1 } };
  assert.equal(step(s, config, bars, tick, now).state.quantity, 0);
});
test('crypto permits fractions and respects budget including all fees', () => {
  const s = { ...initialState(), pending: { side: 'BUY' as const, after: now - 1, expires: now + HOUR } };
  const r = step(s, { ...config, market: 'CRYPTO', symbol: 'BTC-USD' }, bars, { ...tick, price: 3000000 }, now);
  assert.ok(r.state.quantity > 0 && r.state.quantity < 1); assert.ok(r.state.cash >= 90000);
});
test('malformed configuration and controls rejected', () => {
  for (const patch of [{ maxOrder: -1 }, { dailyLoss: NaN }, { commission: 2 }, { market: 'OTHER' }, { symbol: 'BTC-USD' }, { friction: Infinity }]) assert.equal(createBot.safeParse({ ...config, ...patch }).success, false);
  assert.equal(controlBot.safeParse({ id: 'a', action: 'withdraw' }).success, false);
});
test('historical replay is causal: changing future bars cannot alter past output', () => {
  const history = Array.from({ length: 70 }, (_, i) => ({ time: now + i * HOUR, open: 100 + Math.sin(i) * 10, close: 100 + Math.sin(i) * 10 }));
  const a = replay(config, history);
  const b = replay(config, history.map((bar, i) => i > 50 ? { ...bar, open: 1000, close: 1000 } : bar));
  assert.deepEqual(a.equity.filter(e => e.time <= history[50].time), b.equity.filter(e => e.time <= history[50].time));
});
test('crypto historical replay refuses missing FX rather than treating USD as TRY', () => {
  const history = Array.from({ length: 30 }, (_, i) => ({ time: now + i * HOUR, open: 100, close: 100 }));
  const result = replay({ ...config, market: 'CRYPTO', symbol: 'BTC-USD' }, history);
  assert.equal(result.equity.length, 0); assert.equal(result.state.equity, 100000); assert.equal(result.skipped, 9);
});
