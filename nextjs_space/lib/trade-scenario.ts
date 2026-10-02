/** Hypothetical buy then full sale, with unchanged FX and the current profile fee on both legs. */
export function tradeScenario(quantity: number, priceTry: number, feeRate: number, equityTry: number | null, movePercent: number) {
  if (![quantity, priceTry, feeRate, movePercent].every(Number.isFinite) || quantity <= 0 || priceTry <= 0 || feeRate < 0 || feeRate > 1 || movePercent <= -100 || movePercent > 100) return null;
  const gross = quantity * priceTry;
  const buyFee = gross * feeRate;
  const scenarioValue = gross * (1 + movePercent / 100);
  const sellFee = scenarioValue * feeRate;
  const netResult = scenarioValue - gross - buyFee - sellFee;
  if (![gross, buyFee, scenarioValue, sellFee, netResult].every(Number.isFinite)) return null;
  const equityAfterBuy = equityTry == null ? null : equityTry - buyFee;
  return { gross, buyFee, sellFee, scenarioValue, netResult,
    allocationPercent: equityAfterBuy != null && Number.isFinite(equityAfterBuy) && equityAfterBuy > 0 ? gross / equityAfterBuy * 100 : null };
}
