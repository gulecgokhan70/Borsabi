import { Prisma, type PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RequestError } from './request-json';

export async function deleteOwnAccount(db: PrismaClient, userId: string, password: string) {
  const account = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!account) throw new RequestError('Hesap bulunamadı.', 401);
  if (!await bcrypt.compare(password, account.password)) throw new RequestError('Mevcut şifreniz doğru değil.', 403);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await db.$transaction(async tx => {
        // Trading updates the same user row. The lock serializes account removal
        // with balance writes; every child and the account disappear atomically.
        const locked = await tx.$queryRaw<Array<{ password: string }>>`SELECT "password" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        if (!locked.length || locked[0].password !== account.password) throw new RequestError('Hesap değişti. Yeniden giriş yapın.', 409);
        const where = { userId };
        await tx.socialFollow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
        await tx.aiContentReport.deleteMany({ where });
        await tx.chatMessage.deleteMany({ where });
        await tx.priceAlert.deleteMany({ where });
        await tx.achievement.deleteMany({ where });
        await tx.watchlist.deleteMany({ where });
        await tx.appNotification.deleteMany({ where });
        await tx.pushSubscription.deleteMany({ where });
        await tx.replaySession.deleteMany({ where });
        await tx.tradeRequest.deleteMany({ where });
        await tx.transaction.deleteMany({ where });
        await tx.position.deleteMany({ where });
        await tx.user.delete({ where: { id: userId } });
      }, { timeout: 20_000 });
      return;
    } catch (error) {
      // A concurrent sell can lock Position before User. PostgreSQL resolves a
      // deadlock by rolling one transaction back; retry the entire deletion.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) continue;
      throw error;
    }
  }
}
