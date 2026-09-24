import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export async function applyBotSchema(db: PrismaClient) {
  const sql = readFileSync(join(process.cwd(), 'prisma/sql/bot-lab.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.replace(/^--.*$/gm, '').trim()).filter(s => s && s !== 'BEGIN' && s !== 'COMMIT');
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7291402)`;
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30000 });
}
