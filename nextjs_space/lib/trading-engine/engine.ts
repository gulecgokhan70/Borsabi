import { analyzeMarket } from './analyze';
import { scoreSignal } from './signal-engine';
import { planTrade } from './risk-engine';
import { getTradingProfile } from './config';
import type { AccountRisk, AnalyzeMarketInput, Costs, CryptoContext, EngineDecision, Strategy } from './types';
export function evaluateMarket(input: AnalyzeMarketInput, options: {
  context?: CryptoContext; account?: AccountRisk; costs?: Costs; strategy?: Strategy;
  stopMultiplier?: number; rewardRatio?: number;
} = {}): EngineDecision {
  const analysis = analyzeMarket(input);
  const signal = scoreSignal(input, analysis, options.context, options.strategy);
  const plan = analysis.indicators && options.account && options.costs
    ? planTrade(analysis.indicators.close, analysis.indicators.atr, signal, options.account,
      getTradingProfile(input.marketType, input.timeframe), options.costs, options.stopMultiplier, options.rewardRatio)
    : null;
  return { analysis, signal, plan };
}
