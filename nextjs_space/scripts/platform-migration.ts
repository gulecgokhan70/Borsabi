import { PrismaClient } from '@prisma/client';
import { applyPlatformSchema } from '../lib/platform-migration';
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi' || (url.port && url.port !== '5432') || (url.searchParams.get('schema') || 'public') !== 'public') throw new Error('Yerel borsabi veritabanı gerekli.');
  const db = new PrismaClient();
  try { await applyPlatformSchema(db); console.log('Platform alanları hazır; mevcut bakiyeler ve geçmiş kayıtlar korundu.'); }
  finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Platform geçişi tamamlanamadı. Önceki sürüme dönüş başlatılacak.'); process.exitCode = 1; });
