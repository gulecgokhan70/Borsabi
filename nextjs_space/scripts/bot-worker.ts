import 'dotenv/config';
import { runBots } from '../lib/bot-lab/runner';
import { prisma } from '../lib/db';
let stopped = false;
process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });
async function main() {
  try {
    do {
      try { console.log('Bot kontrolü:', await runBots()); }
      catch { console.error('Bot kontrolü başarısız. Veritabanını ve veri bağlantısını kontrol edin.'); }
      if (process.argv.includes('--once')) break;
      for (let i = 0; i < 60 && !stopped; i++) await new Promise(resolve => setTimeout(resolve, 1000));
    } while (!stopped);
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { process.exitCode = 1; });
