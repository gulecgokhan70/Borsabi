import { evaluateMarket } from './engine';
import { planTrade } from './risk-engine';
import { getTradingProfile } from './config';
import { prepareClosedCandles } from './market-data';
import { exitOnBar, fillPrice, ratchetTrailing } from './execution';
import { sessionOpen, intervalMs } from './adapter';
import { performance } from './performance';
import type { AccountRisk, CandleData, Costs, CryptoContext, EngineDecision, MarketType, SignalResult, SimPosition, SimTrade, Strategy, Timeframe } from './types';
export interface BacktestOptions {
  candles: readonly CandleData[]; market: MarketType; timeframe: Timeframe; initialCapital: number; costs: Costs;
  strategy?: Strategy; stopMultiplier?: number; rewardRatio?: number; trailingPercent?: number;
  stopPercent?: number; takeProfitPercent?: number;
  tradeStart?: number; tradeEnd?: number; holidays?: readonly string[];
  contextAt?: (time: number, candles: readonly CandleData[]) => CryptoContext | undefined;
  customSignal?: (past: readonly CandleData[], decision: EngineDecision) => SignalResult;
}
export function runEngineBacktest(options: BacktestOptions) {
  const { market, timeframe, costs } = options;
  const candles = options.candles;
  const checked = prepareClosedCandles(candles, Number.MAX_SAFE_INTEGER);
  if (!checked.ok || !candles.length || !Number.isFinite(options.initialCapital) || options.initialCapital <= 0
    || Object.values(costs).some(v => !Number.isFinite(v) || v < 0 || v > 0.05)
    || (options.trailingPercent !== undefined && (!Number.isFinite(options.trailingPercent) || options.trailingPercent < 0 || options.trailingPercent > 0.2))
    || ((options.stopPercent !== undefined || options.takeProfitPercent !== undefined)
      && (![options.stopPercent, options.takeProfitPercent].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 0.5))))
    throw new RangeError('Backtest verisi veya maliyet girdileri geçersiz.');
  const profile = getTradingProfile(market, timeframe);
  let cash = options.initialCapital, position: SimPosition | null = null, benchmarkQty = 0, benchmarkCash = options.initialCapital;
  let day = '', dayStartEquity = cash, previousEquity = cash, consecutiveLosses = 0, entryFriction = 0;
  const trades: SimTrade[] = [], equity: number[] = [], timeline: { time: number; value: number; benchmark: number }[] = [];
  const mark = (price: number) => cash + (position ? position.quantity * price : 0);
  const close = (raw: number, time: number, reason: string) => {
    if (!position) return;
    const exit = fillPrice(raw, 'SELL', costs), fee = position.quantity * exit * costs.commission;
    const pnl = (exit - position.entry) * position.quantity - position.entryFee - fee;
    trades.push({ side: 'LONG', quantity: position.quantity, entry: position.entry, exit,
      entryTime: position.openedAt, exitTime: time, pnl, pnlPercent: pnl / (position.entry * position.quantity) * 100,
      fees: position.entryFee + fee, slippageCost: entryFriction + (raw - exit) * position.quantity,
      strategy: position.strategy, regime: position.regime, score: position.score, entryReason: position.entryReason, exitReason: reason });
    cash += exit * position.quantity - fee; consecutiveLosses = pnl < 0 ? consecutiveLosses + 1 : 0; position = null;
  };
  for (let n = profile.minimumCandles; n < candles.length; n++) {
    const bar = candles[n];
    const openTime = bar.timestamp + (timeframe === '1d' && market === 'BIST' ? 10 * 3600000 : 0);
    if (options.tradeStart !== undefined && openTime < options.tradeStart) continue;
    if (options.tradeEnd !== undefined && openTime >= options.tradeEnd) break;
    if (!sessionOpen(openTime, market, options.holidays)) continue;
    // Signal only from bars closed at or before this OPEN. No next-bar OHLC enters it.
    const past = candles.slice(0, n).filter(c => c.closedAt <= openTime);
    if (past.length < profile.minimumCandles) continue;
    const key = new Date(openTime + (market === 'BIST' ? 3 * 3600000 : 0)).toISOString().slice(0, 10);
    // Previous close is the baseline: an overnight gap must count toward daily loss.
    if (key !== day) { day = key; dayStartEquity = previousEquity; }
    if (!benchmarkQty) {
      const price = fillPrice(bar.open, 'BUY', costs);
      const raw = options.initialCapital / (price * (1 + costs.commission));
      benchmarkQty = market === 'BIST' ? Math.floor(raw) : Math.floor(raw * 1e8) / 1e8;
      benchmarkCash = options.initialCapital - benchmarkQty * price * (1 + costs.commission);
    }
    const decision = evaluateMarket({ marketType: market, timeframe, candles: past, asOf: openTime },
      { context: options.contextAt?.(openTime, past), strategy: options.strategy });
    const signal = options.customSignal?.(past, decision) ?? decision.signal;
    const wasHolding = !!position;
    if (position) {
      // A decision known at OPEN executes before any later intrabar stop/target.
      if (decision.analysis.regime.trend === 'DOWN' || signal.direction === 'SHORT') close(bar.open, openTime, 'REGIME_EXIT');
      else {
        const exit = exitOnBar(position, bar);
        if (exit) close(exit.price, exit.reason === 'STOP_GAP' || bar.open >= position!.takeProfit ? openTime : bar.closedAt, exit.reason);
      }
    }
    if (!position && !wasHolding && decision.analysis.indicators) {
      const account: AccountRisk = { equity: cash, cash, exposure: 0, dailyLoss: Math.max(0, dayStartEquity - cash),
        dayStartEquity, consecutiveLosses, correlatedExposure: 0, allocationLimit: cash * 0.6, orderLimit: cash * 0.25 };
      const atr = decision.analysis.indicators.atr;
      const stopMultiplier = options.stopPercent === undefined ? options.stopMultiplier
        : fillPrice(bar.open, 'BUY', costs) * options.stopPercent / atr;
      const rewardRatio = options.stopPercent === undefined ? options.rewardRatio : options.takeProfitPercent! / options.stopPercent;
      const plan = planTrade(bar.open, atr, signal, account, profile, costs, stopMultiplier, rewardRatio);
      if (plan.allowed && plan.direction === 'LONG') {
        const entryFee = plan.entry * plan.quantity * costs.commission;
        position = { side: 'LONG', quantity: plan.quantity, entry: plan.entry, entryFee, openedAt: openTime,
          stopLoss: plan.stopLoss, takeProfit: plan.takeProfit, extreme: plan.entry,
          trailingPercent: options.trailingPercent ?? 0, strategy: signal.strategy, regime: signal.regime,
          score: signal.score, entryReason: signal.reasons.join(' ') };
        cash -= plan.cost; entryFriction = (plan.entry - bar.open) * plan.quantity;
        const exit = exitOnBar(position, bar);
        if (exit) close(exit.price, exit.reason === 'STOP_GAP' ? openTime : bar.closedAt, exit.reason);
      }
    }
    if (position) position = ratchetTrailing(position, bar.high, bar.low);
    const value = mark(bar.close);
    previousEquity = value;
    equity.push(value); timeline.push({ time: bar.closedAt, value, benchmark: benchmarkCash + benchmarkQty * bar.close });
  }
  if (position && timeline.length) {
    const last = candles.find(c => c.closedAt === timeline[timeline.length - 1].time)!;
    close(last.close, last.closedAt, 'TEST_END');
    equity[equity.length - 1] = cash; timeline[timeline.length - 1].value = cash;
  }
  if (timeline.length) {
    const last = candles.find(c => c.closedAt === timeline[timeline.length - 1].time)!;
    timeline[timeline.length - 1].benchmark = benchmarkCash + benchmarkQty * fillPrice(last.close, 'SELL', costs) * (1 - costs.commission);
  }
  const annual = (market === 'BIST' ? 252 : 365) * (timeframe === '1d' ? 1 : (market === 'BIST' ? 8 : 24) * 3600000 / intervalMs(timeframe));
  const summary = performance(options.initialCapital, equity, trades, annual);
  const benchmarkFinal = timeline[timeline.length - 1]?.benchmark ?? options.initialCapital;
  return { summary: { ...summary, benchmarkReturn: (benchmarkFinal / options.initialCapital - 1) * 100 },
    equity, timeline, trades, assumptions: ['Sonraki mum açılışında gerçekleşme.', 'İki çıkış seviyesi aynı mumda görülürse stop öncelikli.',
      options.stopPercent === undefined ? 'ATR tabanlı stop/hedef.' : 'Gerçekleşen giriş fiyatına göre yüzde stop/hedef; V2 risk bütçesi korunur.',
      'Komisyon, tahmini spread ve fiyat kayması dahil; likidite ve sıra önceliği modellenmedi.',
      'BIST tatilleri/yarım günleri sağlayıcı verisi ve isteğe bağlı tatil listesine dayanır.',
      'Güven puanı kazanma olasılığı değildir.'], currency: market === 'BIST' ? 'TRY' : 'USD' };
}
