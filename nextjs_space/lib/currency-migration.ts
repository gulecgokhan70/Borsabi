import type { Prisma, PrismaClient } from '@prisma/client';

type Reader = Pick<Prisma.TransactionClient, '$queryRaw'>;
// to_jsonb works before the new columns exist. No customer data leaves this audit.
export async function currencyAudit(db: Reader) {
  const [counts] = await db.$queryRaw<Array<{ positions: number; transactions: number }>>`
    SELECT
      (SELECT count(*)::int FROM "Position" p WHERE p.type = 'CRYPTO'
        AND (to_jsonb(p)->>'entryPriceTry') IS NULL) AS positions,
      (SELECT count(*)::int FROM "Transaction" t WHERE t."marketType" = 'CRYPTO'
        AND (to_jsonb(t)->>'fxRate') IS NULL) AS transactions`;
  return counts;
}

export function requireConvertibleHistory(counts: { positions: number; transactions: number }) {
  if (counts.positions || counts.transactions) {
    throw new Error(`Eski kur kaydı eksik: ${counts.positions} kripto pozisyonu, ${counts.transactions} kripto işlemi. Otomatik geçiş durduruldu; mevcut kayıtlar korundu.`);
  }
}

export async function applyCurrencySchema(db: PrismaClient) {
  return db.$transaction(async tx => {
    // Prevent an old process writing a crypto row between inspection and schema update.
    await tx.$executeRawUnsafe('LOCK TABLE "Position", "Transaction" IN SHARE ROW EXCLUSIVE MODE');
    requireConvertibleHistory(await currencyAudit(tx));
    await tx.$executeRawUnsafe('ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "entryPriceTry" DOUBLE PRECISION');
    await tx.$executeRawUnsafe('ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxRate" DOUBLE PRECISION');
    await tx.$executeRawUnsafe('ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxAsOf" TIMESTAMP(3)');
  }, { timeout: 30_000 });
}
