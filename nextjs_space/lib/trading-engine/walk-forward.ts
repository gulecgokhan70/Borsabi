import { runEngineBacktest, type BacktestOptions } from './backtest-engine';
/** Parameters are selected on past training only, then frozen for the next test slice. */
export function walkForward(options: BacktestOptions, trainBars = 300, testBars = 60) {
  if (!Number.isInteger(trainBars) || trainBars < 220 || !Number.isInteger(testBars) || testBars < 20) throw new RangeError('Geçersiz walk-forward penceresi.');
  const windows: { trainEnd: number; testStart: number; testEnd: number; stopMultiplier: number;
    rewardRatio: number; trainTrades: number; test: ReturnType<typeof runEngineBacktest> }[] = [];
  let capital = options.initialCapital;
  for (let start = trainBars; start + testBars <= options.candles.length; start += testBars) {
    const train = options.candles.slice(start - trainBars, start);
    const candidates = [1.5, 2, 3].flatMap(stopMultiplier => [2, 3].map(rewardRatio => {
      const result = runEngineBacktest({ ...options, candles: train, tradeStart: undefined, tradeEnd: undefined, stopMultiplier, rewardRatio });
      return { stopMultiplier, rewardRatio, result, score: result.summary.totalTrades >= 3 ? result.summary.totalReturn - result.summary.maxDrawdown : -Infinity };
    }));
    candidates.sort((a, b) => b.score - a.score);
    const best = Number.isFinite(candidates[0].score) ? candidates[0] : {
      stopMultiplier: options.stopMultiplier ?? (options.market === 'BIST' ? 2 : 3), rewardRatio: options.rewardRatio ?? 2,
      result: candidates[0].result };
    const end = start + testBars;
    const test = runEngineBacktest({ ...options, candles: options.candles.slice(Math.max(0, start - 200), end),
      initialCapital: capital, tradeStart: options.candles[start].timestamp, tradeEnd: undefined,
      stopMultiplier: best.stopMultiplier, rewardRatio: best.rewardRatio });
    capital = test.summary.finalCapital;
    windows.push({ trainEnd: train[train.length - 1].closedAt, testStart: options.candles[start].timestamp,
      testEnd: options.candles[end - 1].closedAt, stopMultiplier: best.stopMultiplier,
      rewardRatio: best.rewardRatio, trainTrades: best.result.summary.totalTrades, test });
  }
  return { windows, initialCapital: options.initialCapital, finalCapital: capital,
    totalReturn: (capital / options.initialCapital - 1) * 100,
    warnings: windows.length ? ['Seçilen parametreler yalnızca önceki eğitim penceresinden gelir; başarılı canlı performans garantisi değildir.']
      : ['Eğitim ve test pencereleri için yeterli veri yok.'] };
}
