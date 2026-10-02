import type { Prisma } from '@prisma/client';
import { BIST_ALL_STOCKS, CRYPTO_ASSETS } from './constants';
import { valuePositions } from './position-valuation';
import { entryCostTry } from './currency';
import type { AutoConfig, AutoEvent, AutoState } from './bot-lab/auto-engine';

export type ActivityOrigin = 'Manuel' | 'Otomatik satış' | 'Bot' | 'Eski sanal bot';
export type AssetOpenPosition = {
  id: string; origin: ActivityOrigin; quantity: number; entry: number; currency: string;
  cost: number | null; value: number | null; pnl: number | null; openedAt: string;
  stale: boolean; quoteTime: string | null;
};
export type AssetClosedPosition = {
  id: string; origin: ActivityOrigin; closedAt: string | null; pnl: number | null;
};
export type AssetTrade = {
  id: string; origin: ActivityOrigin; action: 'BUY' | 'SELL' | 'TRANSFER'; time: string;
  quantity: number; price: number; currency: string; total: number; fee: number;
  pnl: number | null;
};
export type AssetActivityData = {
  open: AssetOpenPosition[]; closed: AssetClosedPosition[]; trades: AssetTrade[];
  moreClosed: boolean; moreTrades: boolean; valuationUnavailable: boolean;
};
const LIMIT = 20;

export function activityAsset(input: string) {
  const key = input.trim().toUpperCase();
  const stock = BIST_ALL_STOCKS.find(a => a.symbol === key || a.symbol.replace(/\.IS$/, '') === key);
  if (stock) return { symbol: stock.symbol, market: 'BIST' as const, aliases: [stock.symbol, stock.symbol.replace(/\.IS$/, '')] };
  const crypto = CRYPTO_ASSETS.find(a => a.symbol === key);
  return crypto ? { symbol: crypto.symbol, market: 'CRYPTO' as const, aliases: [crypto.symbol] } : null;
}

// Owner and market filters apply to every query, including JSON bot events. Personal data
// deliberately stays out of the public price/chart response. Reads share one DB snapshot.
export async function readAssetActivity(db: Prisma.TransactionClient, userId: string, asset: NonNullable<ReturnType<typeof activityAsset>>) {
  const where = { userId, symbol: { in: asset.aliases } };
  const eventScope: Prisma.PaperBotEventWhereInput = {
    bot: { userId, market: asset.market, config: { path: ['mode'], equals: 'auto-v2' } },
    OR: asset.aliases.map(symbol => ({ data: { path: ['symbol'], equals: symbol } })),
  };
  const [open, closed, trades, bots, events, exits] = await Promise.all([
    db.position.findMany({ where: { ...where, type: asset.market, status: 'OPEN' }, orderBy: { openedAt: 'desc' } }),
    db.position.findMany({ where: { ...where, type: asset.market, status: 'CLOSED' }, orderBy: [{ closedAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1 }),
    db.transaction.findMany({ where: { ...where, marketType: asset.market, type: { in: ['BUY', 'SELL'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1 }),
    db.paperBot.findMany({ where: { userId, market: asset.market, config: { path: ['mode'], equals: 'auto-v2' } }, select: { id: true, config: true, state: true } }),
    db.paperBotEvent.findMany({ where: { ...eventScope, AND: [{ OR: ['BUY', 'SELL'].map(action => ({ data: { path: ['action'], equals: action } })) }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1 }),
    db.paperBotEvent.findMany({ where: { ...eventScope, AND: [{ data: { path: ['action'], equals: 'SELL' } }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1 }),
  ]);
  return { open, closed, trades, bots, events, exits };
}

export async function presentAssetActivity(snapshot: Awaited<ReturnType<typeof readAssetActivity>>, asset: NonNullable<ReturnType<typeof activityAsset>>): Promise<AssetActivityData> {
  let valued: Awaited<ReturnType<typeof valuePositions>> = [];
  let valuationUnavailable = false;
  try { if (snapshot.open.length) valued = await valuePositions(snapshot.open); }
  catch { valuationUnavailable = true; } // A quote/legacy FX problem must not hide executed trades.
  const open: AssetOpenPosition[] = snapshot.open.map(p => {
    const v = valued.find(v => v.id === p.id);
    let cost: number | null = null;
    try { cost = entryCostTry(p) * p.quantity + p.commission; } catch { /* Legacy crypto cost is unknown. */ }
    return { id: p.id, origin: 'Manuel', quantity: p.quantity, entry: p.entryPrice,
      currency: p.type === 'CRYPTO' ? 'USD' : 'TRY', cost, value: v?.totalValue ?? null, pnl: v?.pnl ?? null,
      openedAt: p.openedAt.toISOString(), stale: v?.priceStale ?? true, quoteTime: null };
  });
  for (const bot of snapshot.bots) {
    const config = bot.config as unknown as AutoConfig;
    const state = bot.state as unknown as AutoState;
    for (const [symbol, h] of Object.entries(state.holdings ?? {})) {
      if (!asset.aliases.includes(symbol) || h.quantity <= 0) continue;
      const cost = h.quantity * h.entry + h.entryFee;
      open.push({ id: bot.id + ':' + symbol, origin: config.funding === 'portfolio' ? 'Bot' : 'Eski sanal bot',
        quantity: h.quantity, entry: h.entry, currency: 'TRY', cost, value: h.quantity * h.mark,
        pnl: h.quantity * h.mark - cost, openedAt: new Date(h.openedAt).toISOString(),
        stale: !h.quoteTime || Date.now() - h.quoteTime > (asset.market === 'BIST' ? 20 : 5) * 60000,
        quoteTime: h.quoteTime ? new Date(h.quoteTime).toISOString() : null });
    }
  }
  const botTrade = (row: typeof snapshot.events[number]): AssetTrade => {
    const e = row.data as unknown as AutoEvent;
    return { id: row.id, origin: e.portfolio ? 'Bot' : 'Eski sanal bot', action: e.transfer ? 'TRANSFER' : e.action as 'BUY' | 'SELL',
      time: new Date(e.time).toISOString(), quantity: e.quantity!, price: e.price!, currency: 'TRY',
      total: e.quantity! * e.price!, fee: e.fee ?? 0, pnl: e.pnl ?? null };
  };
  const trades: AssetTrade[] = [...snapshot.trades.map(t => ({ id: t.id,
    origin: t.executionReason && t.executionReason !== 'MANUAL' ? 'Otomatik satış' as const : 'Manuel' as const,
    action: t.type as 'BUY' | 'SELL', time: t.createdAt.toISOString(), quantity: t.quantity, price: t.price,
    currency: t.marketType === 'CRYPTO' ? 'USD' : 'TRY', total: t.total, fee: t.commission, pnl: t.pnl,
  })), ...snapshot.events.map(botTrade)].sort((a, b) => b.time.localeCompare(a.time) || b.id.localeCompare(a.id));
  // Manual closed positions store remaining quantity=0: do not invent an original size
  // or cost from it. Their cumulative P/L already includes any partial exits.
  // auto-v2 always sells the full holding, so each SELL is a completed bot position.
  const closed: AssetClosedPosition[] = [...snapshot.closed.map(p => ({ id: p.id, origin: 'Manuel' as const,
    closedAt: p.closedAt?.toISOString() ?? null, pnl: p.pnl })), ...snapshot.exits.map(row => {
      const t = botTrade(row); return { id: t.id, origin: t.origin, closedAt: t.time, pnl: t.pnl };
    })].sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '') || b.id.localeCompare(a.id));
  return { open, closed: closed.slice(0, LIMIT), trades: trades.slice(0, LIMIT),
    moreClosed: closed.length > LIMIT, moreTrades: trades.length > LIMIT, valuationUnavailable };
}
