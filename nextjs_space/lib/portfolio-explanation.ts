type PositionValue = {
  breakdownKnown?: boolean; symbol: string; totalValue: number; pnl: number; priceStale?: boolean;
  breakdown: { pricePnlTry: number; fxPnlTry: number };
};
type Entry = {
  type: string; symbol: string; commission: number; pnl: number | null;
  pricePnlTry: number | null; fxPnlTry: number | null;
};

/** Since inception, in TRY. Never label cost-basis history as daily market returns. */
export function explainPortfolio(initialBalance: number, cash: number, positions: PositionValue[], entries: Entry[]) {
  const currentValue = cash + positions.reduce((sum, p) => sum + p.totalValue, 0);
  const netChange = currentValue - initialBalance;
  const bySymbol = new Map<string, { symbol: string; price: number; fx: number; fees: number; incomplete: boolean }>();
  const row = (symbol: string) => {
    const key = symbol.replace(/\.IS$/, '');
    if (!bySymbol.has(key)) bySymbol.set(key, { symbol: key, price: 0, fx: 0, fees: 0, incomplete: false });
    return bySymbol.get(key)!;
  };
  let realizedNet = 0, missingBreakdowns = 0;
  for (const p of positions) {
    const item = row(p.symbol);
    if (p.breakdownKnown === false) { item.incomplete = true; missingBreakdowns++; }
    item.price += p.breakdown.pricePnlTry;
    item.fx += p.breakdown.fxPnlTry;
  }
  for (const entry of entries) {
    if (entry.type !== 'BUY' && entry.type !== 'SELL') continue;
    const item = row(entry.symbol);
    item.fees += entry.commission; // Each ledger fee once; no re-deduction of allocated buy fees.
    if (entry.type === 'SELL') {
      realizedNet += entry.pnl ?? 0;
      if (entry.pricePnlTry !== null && entry.fxPnlTry !== null &&
          Number.isFinite(entry.pricePnlTry) && Number.isFinite(entry.fxPnlTry)) {
        item.price += entry.pricePnlTry;
        item.fx += entry.fxPnlTry;
      } else { item.incomplete = true; missingBreakdowns++; }
    }
  }
  const contributors = [...bySymbol.values()].map(item => ({ ...item, net: item.price + item.fx - item.fees }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const priceEffect = contributors.reduce((sum, r) => sum + r.price, 0);
  const fxEffect = contributors.reduce((sum, r) => sum + r.fx, 0);
  const commissions = contributors.reduce((sum, r) => sum + r.fees, 0);
  const unexplained = netChange - (priceEffect + fxEffect - commissions);
  return { initialBalance, currentValue, netChange, priceEffect, fxEffect, commissions, unexplained,
    realizedNet, openNet: positions.reduce((sum, p) => sum + p.pnl, 0),
    missingBreakdowns, hasStalePrices: positions.some(p => p.priceStale), contributors };
}
export type PortfolioExplanation = ReturnType<typeof explainPortfolio>;
