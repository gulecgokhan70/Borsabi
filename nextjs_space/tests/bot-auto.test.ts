import { test } from 'vitest';
import assert from 'node:assert/strict';
import { autoInitial, autoStep, AutoConfig, AutoState, controlAuto, INTERVAL, Observation, rankObservation } from '../lib/bot-lab/auto-engine';
import { createAutoBot } from '../lib/bot-lab/validation';
const now = Date.parse('2026-09-24T12:00:00Z');
const config: AutoConfig = { mode: 'auto-v2', market: 'CRYPTO', symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'LTC-USD'], commission: 0.001, friction: 0.001, orderFraction: 0.05, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04, maxPositions: 3 };
function obs(symbol = 'BTC-USD', time = now, price = 103, jump = 3): Observation {
  return { symbol, tick: { time, price, open: true }, bars: Array.from({ length: 70 }, (_, i) => ({ time: now - (69 - i) * INTERVAL, close: i === 69 ? 100 + jump : 100, volume: i === 69 ? 2000 : 1000 })) };
}
function ready(): AutoState {
  const state = autoInitial(); state.paused = false;
  for (const s of config.symbols) state.lastBars[s] = now - INTERVAL;
  return state;
}
function buy(symbol = 'BTC-USD') {
  const signal = autoStep(ready(), config, [obs(symbol)], now);
  assert.equal(signal.events.length, 0);
  assert.equal(signal.state.pending[symbol].side, 'BUY');
  return autoStep(signal.state, config, [obs(symbol, now + 60000)], now + 60000);
}
test('ranking requires crossover, volume, closed/fresh bars and explains rejection', () => {
  assert.equal(rankObservation(obs(), 'CRYPTO', now).eligible, true);
  assert.equal(rankObservation(obs(), 'CRYPTO', now + 6 * 60000).eligible, false);
  const o = obs(); o.bars.at(-1)!.volume = 1;
  assert.equal(rankObservation(o, 'CRYPTO', now).eligible, false);
  o.bars.at(-1)!.volume = NaN;
  assert.match(rankObservation(o, 'CRYPTO', now).reason, /geçersiz/);
  const future = obs(); future.bars.at(-1)!.time = now + INTERVAL;
  assert.equal(rankObservation(future, 'CRYPTO', now).eligible, false);
  const gap = obs(); gap.bars[68].time -= INTERVAL / 2;
  assert.equal(rankObservation(gap, 'CRYPTO', now).eligible, false);
});
test('first scan does not execute historical entry; later observation cannot fill at signal time', () => {
  const cold = autoInitial(); cold.paused = false;
  assert.deepEqual(autoStep(cold, config, [obs()], now).state.pending, {});
  const signaled = autoStep(ready(), config, [obs()], now);
  const duplicate = autoStep(signaled.state, config, [obs()], now + 1000);
  assert.equal(duplicate.state.cash, 100000);
  assert.equal(buy().events[0].action, 'BUY');
});
test('entry uses fee-inclusive five percent budget; repeated tick cannot duplicate buy', () => {
  const r = buy(), h = r.state.holdings['BTC-USD'];
  assert.ok(r.state.cash >= 95000 && r.state.cash < 95000.00001);
  assert.ok(h.quantity % 1 !== 0);
  assert.ok(Math.abs(r.state.equity - (100000 - r.state.fees - r.state.frictionCost)) < 1e-7);
  const again = autoStep(r.state, config, [obs('BTC-USD', now + 60000)], now + 60000);
  assert.equal(again.events.filter(e => e.action === 'BUY').length, 0);
});
test('BIST rounds to whole shares and retains zero user commission', () => {
  const c: AutoConfig = { ...config, market: 'BIST', symbols: ['THYAO.IS'], commission: 0 };
  const s = ready(); s.lastBars['THYAO.IS'] = now - INTERVAL;
  const a = autoStep(s, c, [obs('THYAO.IS')], now);
  const b = autoStep(a.state, c, [obs('THYAO.IS', now + 60000)], now + 60000);
  assert.equal(b.state.holdings['THYAO.IS'].quantity, 48);
  assert.equal(b.state.fees, 0);
});
test('highest ranking candidates reserve slots; same group and max positions enforced', () => {
  const observations = config.symbols.map((s, i) => obs(s, now, 103 + i, 3 + i));
  const r = autoStep(ready(), config, observations, now);
  const keys = Object.keys(r.state.pending);
  assert.equal(keys.length, 3);
  assert.ok(keys.includes('SOL-USD'));
  assert.ok(!keys.includes('ETH-USD'));
  const filled = autoStep(r.state, config, observations.map(o => ({ ...o, tick: { ...o.tick, time: now + 60000 } })), now + 60000);
  assert.equal(Object.keys(filled.state.holdings).length, 3);
});
test('pause cancels buys but protective sale still works, including gap and both commissions', () => {
  const r = buy(); const h = r.state.holdings['BTC-USD'];
  const paused = controlAuto(r.state, 'stop', now + 61000);
  const sale = autoStep(paused, config, [obs('BTC-USD', now + 120000, 95)], now + 120000);
  assert.equal(sale.events[0].action, 'SELL');
  assert.equal(sale.events[0].price, 95 * 0.999);
  assert.equal(Object.keys(sale.state.holdings).length, 0);
  const expected = (95 * 0.999 - h.entry) * h.quantity - h.entryFee - sale.events[0].fee!;
  assert.ok(Math.abs(sale.state.realized - expected) < 1e-7);
  assert.ok(Math.abs(sale.state.equity - 100000 - expected) < 1e-7);
});
test('daily loss lock blocks entry and preserves protective exits; restart cannot clear it', () => {
  const r = buy();
  r.state.pending['LTC-USD'] = { side: 'BUY', after: now, expires: now + 2 * INTERVAL, reason: 'test' };
  const result = autoStep(r.state, config, [obs('BTC-USD', now + 120000, 40), obs('LTC-USD', now + 120000)], now + 120000);
  assert.ok(result.state.haltedDay);
  assert.ok(result.events.some(e => e.action === 'SELL'));
  assert.ok(!result.events.some(e => e.action === 'BUY'));
  assert.equal(controlAuto(result.state, 'start').haltedDay, result.state.haltedDay);
});
test('stale held price blocks new entries without inventing valuation', () => {
  const r = buy();
  r.state.pending['LTC-USD'] = { side: 'BUY', after: now, expires: now + 2 * INTERVAL, reason: 'test' };
  const result = autoStep(r.state, config, [obs('LTC-USD', now + 120000)], now + 120000);
  assert.ok(!result.state.holdings['LTC-USD']);
  assert.match(result.message, /güncel değil/);
  assert.equal(result.state.holdings['BTC-USD'].mark, 103);
});
test('close all waits for post-request quote, remains paused; pending close cannot restart', () => {
  const r = buy();
  const closing = controlAuto(r.state, 'close', now + 120000);
  assert.throws(() => controlAuto(closing, 'start'));
  const old = autoStep(closing, config, [obs('BTC-USD', now + 90000)], now + 120000);
  assert.ok(old.state.holdings['BTC-USD']);
  const next = autoStep(old.state, config, [obs('BTC-USD', now + 180000)], now + 180000);
  assert.equal(Object.keys(next.state.holdings).length, 0);
  assert.equal(next.state.closeRequested, false);
  assert.equal(next.state.paused, true);
});
test('expired entry does not fill after outage and pure engine does not mutate prior state', () => {
  const initial = ready(), copy = structuredClone(initial);
  const r = autoStep(initial, config, [obs()], now);
  assert.deepEqual(initial, copy);
  const late = autoStep(r.state, config, [obs('BTC-USD', now + 3 * INTERVAL)], now + 3 * INTERVAL);
  assert.equal(Object.keys(late.state.holdings).length, 0);
});
test('server configuration rejects duplicates, unsupported assets and risk bypass', () => {
  assert.equal(createAutoBot.safeParse(config).success, true);
  assert.equal(createAutoBot.safeParse({ ...config, symbols: ['BTC-USD', 'BTC-USD'] }).success, false);
  assert.equal(createAutoBot.safeParse({ ...config, symbols: ['FAKE'] }).success, false);
  assert.equal(createAutoBot.safeParse({ ...config, maxPositions: 4 }).success, false);
  assert.equal(createAutoBot.safeParse({ ...config, orderFraction: 1 }).success, false);
  assert.equal(createAutoBot.safeParse({ ...config, realTrading: true }).success, false);
});
