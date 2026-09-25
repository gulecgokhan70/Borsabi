import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { autoStep, type AutoConfig, type AutoState, type AutoEvent, type Observation } from './auto-engine';

export const budgetInput = z.object({
  capital: z.number().finite().int().min(1000).max(10000000),
  allocationPercent: z.number().finite().min(1).max(100),
  perTradePercent: z.number().finite().min(1).max(100),
  version: z.number().int().min(0),
}).strict();
export class BudgetError extends Error { constructor(message: string, public status = 409) { super(message); } }
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const isShared = (config: unknown) => (config as AutoConfig)?.funding === 'portfolio';
export const holdingCost = (s: AutoState) => Object.values(s.holdings).reduce((n, h) => n + h.quantity * h.entry + h.entryFee, 0);
export const holdingValue = (s: AutoState) => Object.values(s.holdings).reduce((n, h) => n + h.quantity * h.mark, 0);
export async function serial<T>(db: PrismaClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(e.code) && i < 3) continue; throw e; }
  }
}
export async function budgetView(db: PrismaClient | Prisma.TransactionClient, userId: string) {
  const [user, budget, bots] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true, initialBalance: true } }),
    db.portfolioBotBudget.findUnique({ where: { userId } }),
    db.paperBot.findMany({ where: { userId } }),
  ]);
  const shared = bots.filter(b => isShared(b.config));
  const used = shared.reduce((n, b) => n + holdingCost(b.state as unknown as AutoState), 0);
  const migrationCost = bots.filter(b => !isShared(b.config) && (b.config as any).mode === 'auto-v2').reduce((n, b) => n + holdingCost(b.state as unknown as AutoState), 0);
  const limit = budget ? user.initialBalance * budget.allocationPercent / 100 : 0;
  return { capital: user.initialBalance, cash: user.balance, allocationPercent: budget?.allocationPercent ?? 30, perTradePercent: budget?.perTradePercent ?? 10,
    version: budget?.version ?? 0, configured: !!budget, limit, used, available: Math.max(0, Math.min(user.balance, limit - used)), migrationCost,
    capitalChanges: (budget?.capitalChanges ?? []) as unknown as { time: number; amount: number }[] };
}
export async function configureBudget(db: PrismaClient, userId: string, raw: unknown) {
  const input = budgetInput.parse(raw);
  return serial(db, async tx => {
    const view = await budgetView(tx, userId);
    if (view.version !== input.version) throw new BudgetError('Bütçe değişti; sayfayı yenileyip tekrar deneyin.');
    const bots = await tx.paperBot.findMany({ where: { userId } });
    if (bots.some(b => !isShared(b.config) && (b.config as any).mode !== 'auto-v2')) throw new BudgetError('Eski tek varlık botu için dönüşüm gerekli. Otomatik seçimli botlarla devam edin.');
    const delta = input.capital - view.capital;
    const limit = input.capital * input.allocationPercent / 100;
    if (view.cash + delta + 1e-7 < view.migrationCost) throw new BudgetError('Pozisyonları taşımak için ana portföyde yeterli nakit yok. Sermayeyi artırabilirsiniz.');
    if (view.used + view.migrationCost > limit + 1e-7) throw new BudgetError('Bot bütçesi mevcut pozisyonların alış maliyetinden düşük olamaz. Kullanım yüzdesini artırın.');
    const now = Date.now();
    const changes = delta ? [...view.capitalChanges, { time: now, amount: delta }] : view.capitalChanges;
    await tx.user.update({ where: { id: userId }, data: { initialBalance: input.capital, balance: { increment: delta - view.migrationCost } } });
    await tx.portfolioBotBudget.upsert({ where: { userId }, create: { userId, allocationPercent: input.allocationPercent, perTradePercent: input.perTradePercent, capitalChanges: json(changes), version: 1 }, update: { allocationPercent: input.allocationPercent, perTradePercent: input.perTradePercent, capitalChanges: json(changes), version: { increment: 1 } } });
    for (const b of bots) {
      const state = b.state as unknown as AutoState;
      if (!isShared(b.config)) {
        // Preserve original isolated history, but never transfer its artificial cash or closed P/L.
        for (const [symbol, h] of Object.entries(state.holdings)) {
          const e: AutoEvent = { time: now, action: 'BUY', symbol, quantity: h.quantity, price: h.entry, fee: h.entryFee,
            reason: 'Mevcut bot pozisyonu alış maliyetiyle ana portföye taşındı; yeni piyasa alımı değildir.', portfolio: true, transfer: true, quoteTime: h.quoteTime, source: h.source };
          await tx.paperBotEvent.create({ data: { botId: b.id, data: json(e) } });
        }
      }
      const cash = Math.max(0, Math.min(view.cash + delta - view.migrationCost, limit - view.used - view.migrationCost));
      const equity = cash + holdingValue(state);
      await tx.paperBot.update({ where: { id: b.id }, data: { config: json({ ...(b.config as object), funding: 'portfolio' }), version: { increment: 1 },
        state: json({ ...state, cash, equity, peak: isShared(b.config) ? Math.max(0, state.peak + cash - state.cash) : equity, dayEquity: isShared(b.config) ? Math.max(0, state.dayEquity + cash - state.cash) : equity, day: isShared(b.config) ? state.day : '', pending: Object.fromEntries(Object.entries(state.pending).filter(([, p]) => p.side === 'SELL')), ...(isShared(b.config) ? {} : { realized: 0, fees: Object.values(state.holdings).reduce((n, h) => n + h.entryFee, 0), frictionCost: 0, drawdown: 0 }) }),
        message: 'Ana portföy bütçesi kullanılıyor. Eski sanal nakit ana hesaba eklenmedi.' } });
    }
    return budgetView(tx, userId);
  });
}
export async function sharedStep(db: PrismaClient, userId: string, state: AutoState, config: AutoConfig, observations: Observation[], now: number) {
  if (!isShared(config)) return autoStep(state, config, observations, now);
  const view = await budgetView(db, userId);
  if (!view.configured) throw new BudgetError('Ortak bot bütçesi bulunamadı.');
  const cash = view.available;
  const delta = cash - state.cash;
  const adjusted = { ...state, cash, equity: cash + holdingValue(state), peak: Math.max(0, state.peak + delta), dayEquity: Math.max(0, state.dayEquity + delta) };
  const fraction = adjusted.equity > 0 ? Math.min(1, view.limit * view.perTradePercent / 100 / adjusted.equity) : 0;
  return autoStep(adjusted, { ...config, orderFraction: fraction, orderLimitTry: view.limit * view.perTradePercent / 100, exposureLimitTry: Math.max(0, view.limit - view.used + holdingCost(state)) }, observations, now);
}
