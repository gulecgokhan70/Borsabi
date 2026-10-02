import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeMarket, getTradingProfile, TRADING_PROFILES } from '../index';
import { detectMarketRegime } from '../market-regime';
import { selectStrategies } from '../strategy-engine';
import { calculateADX, calculateATR, calculateMACD, lastEMA } from '../../technical-indicators';
import { DAILY_LOSS_LIMIT, MAX_RISK_PER_TRADE } from '../../constants';
import type { CandleData, IndicatorSnapshot, MarketRegime, RegimeResult } from '../types';

const DAY = 86_400_000;
const START = Date.UTC(2024, 0, 1);
function series(count = 240, slope = 0.2): CandleData[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + slope * index;
    return { timestamp: START + index * DAY, closedAt: START + (index + 1) * DAY,
      open: close, high: close + 1, low: close - 1, close, volume: 100 };
  });
}
function run(candles: readonly CandleData[], marketType: 'BIST' | 'CRYPTO' = 'BIST', asOf = START + 240 * DAY) {
  return analyzeMarket({ candles, marketType, timeframe: '1d', asOf });
}
const snapshot: IndicatorSnapshot = {
  close: 110, ema20: 108, ema50: 105, ema200: 100,
  adx: 30, plusDI: 35, minusDI: 10,
  atr: 2, atrPercent: 2, rsi: 60,
  macd: { macd: 1, signal: 0.5, histogram: 0.5, prevHistogram: 0.4 },
  bollinger: { upper: 115, middle: 110, lower: 105, bandwidth: 9 }, volumeRatio: 1,
};

test('trending OHLCV produces ready analysis without mutating input', () => {
  const candles = series().map(c => Object.freeze(c));
  const result = run(Object.freeze(candles));
  assert.equal(result.status, 'READY');
  assert.equal(result.regime.regime, 'TREND_UP');
  assert.equal(result.selection.mode, 'ACTIVE');
  assert.equal(result.selection.direction, 'LONG');
  assert.deepEqual(result.selection.strategies, ['TREND_FOLLOWING', 'MOMENTUM']);
  assert.ok(result.regime.confidence >= 0 && result.regime.confidence <= 1);
  assert.deepEqual(result, run(candles));
});

test('falling series blocks new longs for both markets', () => {
  for (const market of ['BIST', 'CRYPTO'] as const) {
    const result = run(series(240, -0.1), market);
    assert.equal(result.regime.regime, 'TREND_DOWN');
    assert.equal(result.selection.mode, 'RISK_REDUCTION');
    assert.equal(result.selection.direction, 'NONE');
    assert.equal(result.selection.riskMultiplier, 0);
  }
});

test('insufficient history never uses shortened EMA200', () => {
  for (const count of [0, 30, 90, 199]) {
    const result = run(series(count));
    assert.equal(result.status, 'INSUFFICIENT_DATA');
    assert.equal(result.indicators, null);
    assert.equal(result.regime.regime, 'UNCERTAIN');
    assert.equal(result.selection.mode, 'BLOCKED');
  }
  assert.equal(run(series(200)).status, 'READY');
});

test('future candles cannot change a historical analysis at any tested cutoff', () => {
  const candles = series(280);
  for (const count of [199, 200, 215, 240, 260]) {
    const asOf = START + count * DAY;
    const futureChanged = candles.map((c, index) => index < count ? c : {
      ...c, open: 1e8, close: 1e8, high: 2e8, low: 1, volume: 1e20,
    });
    assert.deepEqual(run(futureChanged, 'BIST', asOf), run(candles.slice(0, count), 'BIST', asOf));
  }
});

test('bar is unavailable until its precise closing time', () => {
  const candles = series(200);
  const closingTime = candles[199].closedAt;
  assert.equal(run(candles, 'BIST', closingTime - 1).status, 'INSUFFICIENT_DATA');
  assert.equal(run(candles, 'BIST', closingTime).status, 'READY');
});

test('invalid prices and volume block analysis instead of dropping history', () => {
  const invalid: Partial<CandleData>[] = [
    { close: NaN }, { high: Infinity }, { low: 0 }, { open: -1 },
    { high: 1 }, { low: 1000 }, { close: 2000 }, { volume: -1 }, { volume: NaN },
    { closedAt: START }, { timestamp: 0 }, { closedAt: NaN },
  ];
  for (const changes of invalid) {
    const candles = series();
    candles[100] = { ...candles[100], ...changes };
    const result = run(candles);
    assert.equal(result.status, 'INVALID_DATA');
    assert.equal(result.selection.mode, 'BLOCKED');
    assert.equal(result.indicators, null);
  }
});

test('duplicates, reversed bars and overlapping bars are rejected', () => {
  const candles = series();
  assert.equal(run([...candles.slice(0, 100), candles[99], ...candles.slice(100)]).status, 'INVALID_DATA');
  assert.equal(run([...candles].reverse()).status, 'INVALID_DATA');
  const overlap = candles.map((c, index) => index === 100 ? { ...c, timestamp: c.timestamp - 1 } : c);
  assert.equal(run(overlap).status, 'INVALID_DATA');
});

test('invalid clock and unsupported timeframe are blocked', () => {
  for (const asOf of [NaN, Infinity, 0, -1]) assert.equal(run(series(), 'BIST', asOf).status, 'INVALID_DATA');
  const result = analyzeMarket({ candles: series(), marketType: 'BIST',
    timeframe: '1h' as '1d', asOf: START + 240 * DAY });
  assert.equal(result.status, 'INVALID_DATA');
  assert.throws(() => getTradingProfile('OTHER' as 'BIST'), RangeError);
});

test('flat and zero-volume data remains finite and has no false volume confirmation', () => {
  const candles = series(240, 0).map(c => ({ ...c, high: c.close, low: c.close, volume: 0 }));
  const result = run(candles);
  assert.equal(result.status, 'READY');
  assert.equal(result.regime.regime, 'LOW_VOLATILITY');
  assert.equal(result.indicators?.rsi, 50);
  assert.equal(result.indicators?.volumeRatio, null);
  assert.equal(result.selection.mode, 'WATCH_ONLY');
  assert.ok(result.warnings.some(w => w.includes('Hacim')));
});

test('volume baseline excludes the current candle', () => {
  const candles = series();
  candles[239] = { ...candles[239], volume: 300 };
  assert.equal(run(candles).indicators?.volumeRatio, 3);
});

test('shared technical calculations are reused without formula drift', () => {
  const candles = series();
  const i = run(candles).indicators;
  assert.ok(i);
  const closes = candles.map(c => c.close), highs = candles.map(c => c.high), lows = candles.map(c => c.low);
  assert.equal(i.ema200, lastEMA(closes, 200));
  assert.equal(i.atr, calculateATR(highs, lows, closes));
  assert.equal(i.adx, calculateADX(closes, highs, lows).adx);
  assert.deepEqual(i.macd, calculateMACD(closes));
});

test('all six regimes have explicit criteria', () => {
  const cases: [Partial<IndicatorSnapshot>, MarketRegime][] = [
    [{}, 'TREND_UP'],
    [{ ema20: 90, ema50: 95, ema200: 100, plusDI: 10, minusDI: 35 }, 'TREND_DOWN'],
    [{ adx: 10 }, 'RANGE'],
    [{ atrPercent: 5 }, 'HIGH_VOLATILITY'],
    [{ atrPercent: 0.5, bollinger: { upper: 111, middle: 110, lower: 109, bandwidth: 2 } }, 'LOW_VOLATILITY'],
    [{ ema20: 105, ema50: 108, ema200: 100, adx: 22 }, 'UNCERTAIN'],
  ];
  for (const [overrides, expected] of cases) {
    const result = detectMarketRegime({ ...snapshot, ...overrides }, TRADING_PROFILES.BIST);
    assert.equal(result.regime, expected);
    assert.ok(result.reasons.length > 0);
  }
});

test('strong ADX alone cannot authorize an unconfirmed trend', () => {
  const result = detectMarketRegime({ ...snapshot, plusDI: 5, minusDI: 40 }, TRADING_PROFILES.BIST);
  assert.equal(result.regime, 'UNCERTAIN');
  assert.equal(selectStrategies(result, TRADING_PROFILES.BIST).mode, 'BLOCKED');
});

test('profile differences affect volatility classification and keep existing risk ceilings', () => {
  const i = { ...snapshot, atrPercent: 6 };
  assert.equal(detectMarketRegime(i, TRADING_PROFILES.BIST).regime, 'HIGH_VOLATILITY');
  assert.equal(detectMarketRegime(i, TRADING_PROFILES.CRYPTO).regime, 'TREND_UP');
  for (const profile of Object.values(TRADING_PROFILES)) {
    assert.ok(profile.risk.maxRiskPerTrade <= MAX_RISK_PER_TRADE);
    assert.equal(profile.risk.dailyLossLimit, DAILY_LOSS_LIMIT);
    assert.equal(profile.allowShort, false);
    assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.regime) && Object.isFrozen(profile.risk));
  }
  assert.ok(TRADING_PROFILES.CRYPTO.risk.maxRiskPerTrade < TRADING_PROFILES.BIST.risk.maxRiskPerTrade);
  assert.ok(TRADING_PROFILES.CRYPTO.risk.atrStopMultiplier > TRADING_PROFILES.BIST.risk.atrStopMultiplier);
});

test('volatility priority preserves downtrend risk reduction', () => {
  const regime = detectMarketRegime({ ...snapshot, atrPercent: 10, ema20: 90, ema50: 95 }, TRADING_PROFILES.CRYPTO);
  assert.equal(regime.regime, 'HIGH_VOLATILITY');
  assert.equal(regime.trend, 'DOWN');
  assert.equal(selectStrategies(regime, TRADING_PROFILES.CRYPTO).mode, 'RISK_REDUCTION');
});

test('volatility selects monitoring only and uncertain regimes have no candidates', () => {
  for (const regime of ['HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNCERTAIN'] as const) {
    const result: RegimeResult = { regime, trend: 'MIXED', confidence: 0.5, reasons: [] };
    const selection = selectStrategies(result, TRADING_PROFILES.CRYPTO);
    assert.equal(selection.direction, 'NONE');
    assert.equal(selection.mode, regime === 'UNCERTAIN' ? 'BLOCKED' : 'WATCH_ONLY');
  }
});

test('short strategy selection requires an explicit profile capability', () => {
  const regime: RegimeResult = { regime: 'TREND_DOWN', trend: 'DOWN', confidence: 0.8, reasons: [] };
  const selection = selectStrategies(regime, { ...TRADING_PROFILES.CRYPTO, allowShort: true });
  assert.equal(selection.direction, 'SHORT');
  assert.equal(selection.mode, 'ACTIVE');
});

test('range activates mean reversion and missing crypto context is visible', () => {
  const regime: RegimeResult = { regime: 'RANGE', trend: 'MIXED', confidence: 0.7, reasons: [] };
  assert.deepEqual(selectStrategies(regime, TRADING_PROFILES.BIST).strategies, ['MEAN_REVERSION']);
  assert.ok(run(series(), 'CRYPTO').warnings.some(w => w.includes('BTC/ETH')));
});

test('overflow in derived indicators blocks the result', () => {
  const candles = series().map(c => ({ ...c, open: 1e308, close: 1e308, high: 1e308, low: 1e308 }));
  assert.equal(run(candles).status, 'INVALID_DATA');
});
