import { PrismaClient } from '@prisma/client';
import { applyBotSchema } from '../lib/bot-lab/migration';
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/borsabi' || (url.port && url.port !== '5432') || (url.searchParams.get('schema') || 'public') !== 'public') throw new Error('Yerel borsabi veritabanı gerekli.');
  const db = new PrismaClient();
  try { await applyBotSchema(db); console.log('Sanal bot tabloları hazır; mevcut hesaplar korundu.'); }
  finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Sanal bot şeması hazırlanamadı; yayın durduruluyor.'); process.exitCode = 1; });
