import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export async function applyPlatformSchema(db: PrismaClient) {
  const sql = readFileSync(join(process.cwd(), 'scripts/platform-schema.sql'), 'utf8');
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('LOCK TABLE "Position", "Transaction" IN SHARE ROW EXCLUSIVE MODE');
    for (const statement of sql.split(';').map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30_000 });
}
