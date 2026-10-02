import { Bar, Config, Decision, HOUR, initialState, step } from './engine';
export type HistoricalBar = Bar & { open: number };
/** Historical opens are only used at their own timestamps; decisions cannot fill on their signal bar. */
export function replay(config: Config, history: HistoricalBar[], fx: Bar[] = []) {
  let state = initialState();
  const events: Decision[] = [];
  const equity: { time: number; value: number; benchmark: number }[] = [];
  const sorted = [...history].sort((a, b) => a.time - b.time);
  const rates = [...fx].sort((a, b) => a.time - b.time);
  let skipped = 0;
  for (let i = 21; i < sorted.length; i++) {
    const current = sorted[i];
    let rate = 1;
    if (config.market === 'CRYPTO') {
      const eligible = rates.filter(b => b.time <= current.time);
      const lastFx = eligible[eligible.length - 1];
      if (!lastFx || current.time - lastFx.time > 20 * 60000 || lastFx.close <= 0) { skipped++; continue; }
      rate = lastFx.close;
    }
    const result = step(state, config, sorted.slice(0, i).map(b => ({ time: b.time + HOUR, close: b.close })),
      { time: current.time, price: current.open * rate, open: true }, current.time);
    state = result.state;
    if (result.decision.action !== 'WAIT') events.push(result.decision);
    equity.push({ time: current.time, value: state.equity, benchmark: state.benchmarkEquity });
  }
  return { state, events, equity, skipped };
}
