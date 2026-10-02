import type { CandleData, IndicatorSnapshot, Strategy } from './types';
export interface Setup { strategy: Strategy; confirmed: boolean; quality: number; reason: string }
export function strategySetups(candles: readonly CandleData[], i: IndicatorSnapshot): Setup[] {
  const last = candles[candles.length - 1], prev = candles[candles.length - 2];
  const prior = candles.slice(-21, -1);
  const priorHigh = Math.max(...prior.map(c => c.high));
  const priorLow = Math.min(...prior.map(c => c.low));
  const momentum = last.close / candles[candles.length - 6].close - 1;
  const volume = i.volumeRatio !== null && i.volumeRatio >= 1;
  return [
    { strategy: 'TREND_FOLLOWING', confirmed: i.close > i.ema20 && i.ema20 > i.ema50 && i.ema50 > i.ema200 && i.adx >= 25 && i.macd.histogram > 0 && volume,
      quality: i.close > i.ema20 ? 1 : 0.3, reason: 'EMA dizilimi, ADX, MACD ve hacim teyidi.' },
    { strategy: 'MOMENTUM', confirmed: momentum > 0 && momentum < 0.15 && i.rsi >= 50 && i.rsi <= 75 && i.macd.histogram > i.macd.prevHistogram && volume,
      quality: momentum > 0 && i.rsi <= 75 ? 1 : 0.2, reason: 'Pozitif fiyat ivmesi, kontrollü RSI ve artan MACD.' },
    { strategy: 'MEAN_REVERSION', confirmed: i.adx < 25 && last.close > prev.close && prev.close <= i.bollinger.lower * 1.02 && i.rsi < 50 && i.close < i.bollinger.middle && volume,
      quality: i.close < i.bollinger.middle ? 1 : 0.2, reason: 'Yatay piyasada alt banttan dönüş ve hacim teyidi.' },
    { strategy: 'BREAKOUT', confirmed: last.close > priorHigh && last.close > prev.close && (i.volumeRatio ?? 0) >= 1.5,
      quality: last.close > priorHigh ? 1 : last.close < priorLow ? 0 : 0.3, reason: 'Önceki 20 mumun zirvesinin üzerinde kapanış ve 1.5x hacim.' },
  ];
}
