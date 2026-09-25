import type { Prisma } from '@prisma/client';
import type { AutoState, AutoEvent, AutoConfig } from './auto-engine';
import { isShared } from './shared-portfolio';
export async function readBotPortfolio(db: Prisma.TransactionClient, userId: string) {
  const bots = (await db.paperBot.findMany({ where: { userId, config: { path: ['funding'], equals: 'portfolio' } }, include: { events: { where: { AND: [{ data: { path: ['portfolio'], equals: true } }, { OR: [{ data: { path: ['action'], equals: 'BUY' } }, { data: { path: ['action'], equals: 'SELL' } }] }] }, orderBy: { createdAt: 'asc' } } } })).filter(b => isShared(b.config));
  const budget = await db.portfolioBotBudget.findUnique({ where: { userId } });
  const positions = bots.flatMap(b => Object.entries((b.state as unknown as AutoState).holdings).map(([symbol, h]) => ({
    id: `${b.id}:${symbol}`, name: symbol, quantity: h.quantity, entryPrice: h.entry, currentPrice: h.mark, currency: 'TRY', botManaged: true,
    stopLoss: h.entry * (1 - (b.config as unknown as AutoConfig).stopLoss), takeProfit: h.entry * (1 + (b.config as unknown as AutoConfig).takeProfit),
    symbol, totalValue: h.quantity * h.mark, totalCost: h.quantity * h.entry + h.entryFee,
    pnl: h.quantity * (h.mark - h.entry) - h.entryFee, priceStale: !h.quoteTime || Date.now() - h.quoteTime > (b.market === 'BIST' ? 20 : 5) * 60000,
    breakdown: { pricePnlTry: 0, fxPnlTry: 0 }, breakdownKnown: false,
    pnlPercent: (h.quantity * h.entry + h.entryFee) > 0 ? (h.quantity * (h.mark - h.entry) - h.entryFee) / (h.quantity * h.entry + h.entryFee) * 100 : 0,
  })));
  const ledger = bots.flatMap(b => b.events.map(row => ({ row, e: row.data as unknown as AutoEvent })).filter(({ e }) => e.portfolio && (e.action === 'BUY' || e.action === 'SELL')).map(({ row, e }) => ({
    id: row.id, type: e.action, symbol: e.symbol!, holdingKey: `${b.id}:${e.symbol}`, quantity: e.quantity!, price: e.price!, total: e.quantity! * e.price!, commission: e.fee || 0, pnl: e.pnl ?? null,
    createdAt: new Date(e.time), pricePnlTry: null, fxPnlTry: null, origin: 'BOT' as const, transfer: !!e.transfer,
  })));
  return { positions, ledger, bots: bots.map(b => ({ id: b.id, market: b.market, running: b.running, config: b.config as unknown as AutoConfig,
    state: b.state as unknown as AutoState, events: b.events.map(e => ({ id: e.id, data: e.data as unknown as AutoEvent })).filter(e => e.data.portfolio && ['BUY', 'SELL'].includes(e.data.action)).slice(-20).reverse() })),
    capitalChanges: (budget?.capitalChanges ?? []) as unknown as { time: number; amount: number }[] };
}
