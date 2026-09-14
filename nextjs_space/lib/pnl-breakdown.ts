// Exact additive attribution; weighted entry FX = weighted TRY cost / native cost.
export function pnlBreakdown(quantity: number, entry: number, entryTry: number, price: number, rate: number, buyFee: number, sellFee = 0) {
  const entryRate = entryTry / entry;
  const pricePnlTry = (price - entry) * entryRate * quantity;
  const fxPnlTry = price * (rate - entryRate) * quantity;
  const commissionTry = buyFee + sellFee;
  return { pricePnlTry, fxPnlTry, commissionTry, pnl: pricePnlTry + fxPnlTry - commissionTry };
}
