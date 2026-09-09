import { PrismaClient } from '@prisma/client';
import { applyCurrencySchema, currencyAudit, requireConvertibleHistory } from '../lib/currency-migration';

async function main() {
  const connection = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname) || connection.pathname !== '/borsabi' ||
      (connection.port && connection.port !== '5432') || (connection.searchParams.get('schema') || 'public') !== 'public') {
    throw new Error('Bu VPS geçişi yalnızca yerel borsabi veritabanını kabul eder.');
  }
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) throw new Error('--check veya --apply gerekli.');
  const db = new PrismaClient();
  try {
    const counts = await currencyAudit(db);
    console.log(`Kur kaydı olmayan eski kripto pozisyonu: ${counts.positions}; işlem: ${counts.transactions}`);
    requireConvertibleHistory(counts);
    if (mode === '--apply') {
      await applyCurrencySchema(db);
      console.log('Para birimi alanları hazır. Bakiyeler ve geçmiş işlemler değiştirilmedi.');
    }
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  // Prisma failures may contain connection details. Only show our own audit messages.
  console.error(error instanceof Error && /^(Eski kur|Bu VPS|--check)/.test(error.message)
    ? error.message : 'Geçiş kontrolü tamamlanamadı. Veritabanı bağlantısını ve servis durumunu kontrol edin.');
  process.exitCode = 1;
});
