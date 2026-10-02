import {
  calculateADX, calculateATR, calculateBollingerBands, calculateMACD,
  calculateRSI, lastEMA,
} from '../technical-indicators';
import type { CandleData, IndicatorSnapshot } from './types';

/** Input must already be validated, closed, chronological and >= 200 bars. */
export function buildIndicatorSnapshot(candles: readonly CandleData[]): IndicatorSnapshot | null {
  if (candles.length < 200) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const close = closes[closes.length - 1];
  const bollinger = calculateBollingerBands(closes);
  if (!bollinger) return null;
  const adx = calculateADX(closes, highs, lows);
  const atr = calculateATR(highs, lows, closes);
  // Compare the last closed bar with the preceding 20 bars, not itself.
  const baseline = candles.slice(-21, -1).reduce((sum, c) => sum + c.volume / 20, 0);
  const snapshot: IndicatorSnapshot = {
    close,
    ema20: lastEMA(closes, 20), ema50: lastEMA(closes, 50), ema200: lastEMA(closes, 200),
    ...adx,
    atr, atrPercent: atr / close * 100,
    // Shared RSI returns 100 for a flat window; expose neutral 50 in this adapter.
    rsi: closes.slice(-15).every(value => value === close) ? 50 : calculateRSI(closes),
    macd: calculateMACD(closes),
    bollinger,
    volumeRatio: baseline > 0 ? candles[candles.length - 1].volume / baseline : null,
  };
  const numbers = [snapshot.close, snapshot.ema20, snapshot.ema50, snapshot.ema200,
    snapshot.adx, snapshot.plusDI, snapshot.minusDI, snapshot.atr, snapshot.atrPercent,
    snapshot.rsi, ...Object.values(snapshot.macd), ...Object.values(snapshot.bollinger)];
  if (snapshot.volumeRatio !== null) numbers.push(snapshot.volumeRatio);
  return numbers.every(Number.isFinite) ? snapshot : null;
}
