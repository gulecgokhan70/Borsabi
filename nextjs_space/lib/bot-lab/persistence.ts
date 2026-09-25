import { Prisma, type PrismaClient } from '@prisma/client';
import { type AutoEvent, type AutoState } from './auto-engine';
import { budgetView, BudgetError, holdingCost, isShared, serial } from './shared-portfolio';
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function persistBot(db: PrismaClient, id: string, version: number, state: unknown, message: string, events: AutoEvent[]) {
  return serial(db, async tx => {
    const bot = await tx.paperBot.findUnique({ where: { id } });
    if (!bot || bot.version !== version || !bot.running) return 0;
    const shared = isShared(bot.config);
    if (shared) {
      const view = await budgetView(tx, bot.userId);
      if (!view.configured) throw new BudgetError('Ortak bütçe bulunamadı.');
      let cashDelta = 0;
      const trades = events.filter(e => e.action === 'BUY' || e.action === 'SELL');
      for (const e of trades) {
        if (!e.quantity || e.quantity <= 0 || !e.price || e.price <= 0 || !Number.isFinite(e.quantity * e.price) || !Number.isFinite(e.fee) || e.fee! < 0) throw new BudgetError('Bot işlem tutarı doğrulanamadı.');
        const cost = e.quantity * e.price + e.fee!;
        if (e.action === 'BUY' && cost > view.limit * view.perTradePercent / 100 + 1e-6) throw new BudgetError('Ortak işlem başı bütçesi değişti; alım yeniden değerlendirilecek.');
        cashDelta += e.action === 'BUY' ? -cost : e.quantity * e.price - e.fee!;
      }
      if (trades.some(e => e.action === 'BUY') && view.used - holdingCost(bot.state as unknown as AutoState) + holdingCost(state as AutoState) > view.limit + 1e-6) throw new BudgetError('Ortak bot kullanım sınırı dolu; alım yeniden değerlendirilecek.');
      if (view.cash + cashDelta < -1e-6) throw new BudgetError('Ana portföy nakdi yetersiz; alım yeniden değerlendirilecek.');
      if (cashDelta) {
        const changed = await tx.user.updateMany({ where: { id: bot.userId, balance: { gte: Math.max(0, -cashDelta) } }, data: { balance: { increment: cashDelta } } });
        if (!changed.count) throw new BudgetError('Ana portföy nakdi değişti.');
      }
    }
    const changed = await tx.paperBot.updateMany({ where: { id, version, running: true }, data: { state: json(state), version: { increment: 1 }, checkedAt: new Date(), message } });
    if (!changed.count) throw new BudgetError('Bot ayarları değişti; işlem tekrar değerlendirilecek.');
    for (const event of events) await tx.paperBotEvent.create({ data: { botId: id, data: json(shared ? { ...event, portfolio: true } : event) } });
    return changed.count;
  });
}
