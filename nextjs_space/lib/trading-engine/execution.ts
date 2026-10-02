import type { CandleData, Costs, SimPosition } from './types';
export const fillPrice = (price: number, side: 'BUY' | 'SELL', costs: Costs) => price * (1 + (side === 'BUY' ? 1 : -1) * (costs.slippage + costs.spread / 2));
/** Evaluate inherited stops before ratcheting; never assume the intrabar high happened first. */
export function exitOnBar(position: SimPosition, bar: CandleData): { price: number; reason: string } | null {
  const long = position.side === 'LONG';
  const trailing = position.trailingPercent > 0 ? position.extreme * (1 + (long ? -1 : 1) * position.trailingPercent) : position.stopLoss;
  const stop = long ? Math.max(position.stopLoss, trailing) : Math.min(position.stopLoss, trailing);
  if (long ? bar.open <= stop : bar.open >= stop) return { price: bar.open, reason: 'STOP_GAP' };
  if (long ? bar.open >= position.takeProfit : bar.open <= position.takeProfit) return { price: position.takeProfit, reason: 'TAKE_PROFIT' };
  // If both touched, choose the stop: OHLC cannot establish event order.
  if (long ? bar.low <= stop : bar.high >= stop) return { price: stop, reason: stop !== position.stopLoss ? 'TRAILING_STOP' : 'STOP_LOSS' };
  if (long ? bar.high >= position.takeProfit : bar.low <= position.takeProfit) return { price: position.takeProfit, reason: 'TAKE_PROFIT' };
  return null;
}
export function ratchetTrailing(position: SimPosition, high: number, low: number): SimPosition {
  return { ...position, extreme: position.side === 'LONG' ? Math.max(position.extreme, high) : Math.min(position.extreme, low) };
}
