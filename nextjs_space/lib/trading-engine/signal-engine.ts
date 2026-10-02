import { analyzeMarket } from './analyze';
import { detectCandlePatterns } from '../candle-patterns';
import { SIGNAL_THRESHOLD, MIN_CONFIDENCE } from './config';
import { strategySetups } from './strategies';
import { intervalMs } from './adapter';
import type { AnalyzeMarketInput, CryptoContext, MarketAnalysis, SignalResult, Strategy } from './types';

export function scoreSignal(input: AnalyzeMarketInput, analysis = analyzeMarket(input), context?: CryptoContext, requested?: Strategy): SignalResult {
  const components = { trend: 0, momentum: 0, volume: 0, volatility: 0, structure: 0, candle: 0, regime: 0 };
  const result: SignalResult = { score: 0, confidence: 0, direction: 'NONE', strategy: null,
    regime: analysis.regime.regime, reasons: [...analysis.regime.reasons], warnings: [...analysis.warnings], components };
  if (!analysis.indicators || analysis.status !== 'READY') return result;
  const maxAge = input.marketType === 'BIST' && input.timeframe === '1d' ? 4 * intervalMs('1d') : intervalMs(input.timeframe);
  if (analysis.lastClosedAt === null || input.asOf - analysis.lastClosedAt > maxAge) {
    result.warnings.push('Son kapanmış mum güncel değil; yeni sinyal engellendi.');
    return result;
  }
  const candles = input.candles.filter(c => c.closedAt <= input.asOf);
  const i = analysis.indicators, r = analysis.regime;
  const volume = i.volumeRatio ?? 0;
  const setups = strategySetups(candles, i);
  const allowed = setups.filter(s => analysis.selection.strategies.includes(s.strategy) && (!requested || requested === s.strategy));
  const setup = allowed.find(s => s.confirmed) ?? allowed[0];
  if (!setup || analysis.selection.mode === 'BLOCKED' || analysis.selection.mode === 'RISK_REDUCTION') return result;
  const meanReversion = setup.strategy === 'MEAN_REVERSION';
  components.trend = meanReversion ? (i.adx < 25 ? 25 : 0) : (i.ema20 > i.ema50 ? 10 : 0) + (i.ema50 > i.ema200 ? 10 : 0) + (i.close > i.ema20 ? 5 : 0);
  components.momentum = (i.macd.histogram > 0 || meanReversion && i.close > candles[candles.length - 2].close ? 10 : 0) + (i.rsi >= 40 && i.rsi <= 75 ? 10 : meanReversion && i.rsi < 40 ? 8 : 0);
  components.volume = Math.min(15, Math.max(0, volume * 7.5));
  components.volatility = r.regime === 'HIGH_VOLATILITY' ? 2 : r.regime === 'LOW_VOLATILITY' ? 4 : 10;
  components.structure = Math.round(setup.quality * 15);
  const patterns = detectCandlePatterns(candles.slice(-6));
  components.candle = Math.min(10, patterns.filter(p => p.type === 'bullish').reduce((sum, p) => sum + p.strength * 3, 0));
  components.regime = r.regime === 'UNCERTAIN' ? 0 : 5;
  result.score = Math.round(Object.values(components).reduce((a, b) => a + b, 0));
  result.strategy = setup.strategy;
  result.confidence = Math.min(0.95, (r.confidence + (setup.confirmed ? 0.85 : 0.3) + (volume > 0 ? 0.8 : 0.1)) / 3);
  result.reasons.push(setup.reason, `Hacim oranı: ${volume.toFixed(2)}.`, ...patterns.map(p => p.name));
  let cryptoConfirmed = true;
  if (input.marketType === 'CRYPTO') {
    const usable = (a: MarketAnalysis) => a.status === 'READY' && a.marketType === 'CRYPTO'
      && a.timeframe === input.timeframe && a.asOf <= input.asOf && a.lastClosedAt !== null
      && a.lastClosedAt <= input.asOf && input.asOf - a.lastClosedAt <= intervalMs(input.timeframe);
    cryptoConfirmed = !!context && usable(context.btc) && usable(context.eth) && context.relativeStrength !== null && Number.isFinite(context.relativeStrength);
    if (!cryptoConfirmed) {
      result.warnings.push('BTC/ETH bağlamı eksik veya geçersiz; yeni kripto sinyali engellendi.');
      result.confidence = Math.min(result.confidence, 0.4);
    } else if (context) {
      result.warnings = result.warnings.filter(w => !w.includes('bu aşamada'));
      result.reasons.push(`BTC: ${context.btc.regime.regime}; ETH: ${context.eth.regime.regime}; göreli güç: %${context.relativeStrength!.toFixed(2)}.`);
      if (context.btc.regime.trend === 'DOWN' || context.btc.regime.regime === 'HIGH_VOLATILITY') {
        result.warnings.push('BTC düşüşte veya yüksek oynaklıkta; yeni long işlemi engellendi.');
        result.score = Math.max(0, result.score - 20); cryptoConfirmed = false;
      } else if (context.eth.regime.trend === 'DOWN' || context.relativeStrength! < -5) {
        result.score = Math.max(0, result.score - 10); result.confidence *= 0.8;
      }
    }
  }
  if (setup.confirmed && cryptoConfirmed && result.score >= SIGNAL_THRESHOLD && result.confidence >= MIN_CONFIDENCE
    && r.regime !== 'LOW_VOLATILITY' && r.trend !== 'DOWN') result.direction = 'LONG';
  return result;
}
