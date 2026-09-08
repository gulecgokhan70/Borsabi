type LedgerEntry = { type: string; symbol: string; quantity: number; total: number; commission: number; pnl: number | null; createdAt: Date };

export function summarizeSales(entries: { type: string; pnl: number | null }[]) {
  const sales = entries.filter(t => t.type === 'SELL' && t.pnl !== null);
  return {
    realizedPnl: sales.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
    totalTrades: sales.length,
    winRate: sales.length ? sales.filter(t => (t.pnl ?? 0) > 0).length / sales.length * 100 : 0,
  };
}

// Historical points value remaining holdings at cost; the API appends the live valuation.
export function buildEquityCurve(initialBalance: number, entries: LedgerEntry[]) {
  let cash = initialBalance;
  const holdings = new Map<string, { quantity: number; cost: number }>();
  const label = (date: Date) => date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const curve = [{ date: label(entries[0]?.createdAt ?? new Date()), balance: initialBalance }];
  for (const entry of entries) {
    const symbol = entry.symbol.replace(/\.IS$/, '');
    const holding = holdings.get(symbol) ?? { quantity: 0, cost: 0 };
    if (entry.type === 'BUY') {
      cash -= entry.total + entry.commission;
      holding.quantity += entry.quantity;
      holding.cost += entry.total;
    } else if (entry.type === 'SELL') {
      cash += entry.total - entry.commission;
      const ratio = holding.quantity > 0 ? Math.min(1, entry.quantity / holding.quantity) : 0;
      holding.cost *= 1 - ratio;
      holding.quantity = Math.max(0, holding.quantity - entry.quantity);
    } else continue;
    holdings.set(symbol, holding);
    const cost = [...holdings.values()].reduce((sum, h) => sum + h.cost, 0);
    curve.push({ date: label(entry.createdAt), balance: Math.round((cash + cost) * 100) / 100 });
  }
  return curve;
}
