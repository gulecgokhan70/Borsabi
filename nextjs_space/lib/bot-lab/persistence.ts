import { Prisma, type PrismaClient } from '@prisma/client';
import { AutoEvent } from './auto-engine';
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function persistBot(db: PrismaClient, id: string, version: number, state: unknown, message: string, events: AutoEvent[]) {
  return db.$transaction(async tx => {
    const changed = await tx.paperBot.updateMany({ where: { id, version, running: true }, data: { state: json(state), version: { increment: 1 }, checkedAt: new Date(), message } });
    if (changed.count) for (const event of events) await tx.paperBotEvent.create({ data: { botId: id, data: json(event) } });
    return changed.count;
  });
}
