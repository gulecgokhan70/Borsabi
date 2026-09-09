import 'dotenv/config';
import { prisma } from '../lib/db';
import { runAutomationCycle } from '../lib/automation';
import { deliverNotifications } from '../lib/push';
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
async function main() {
  while (!stopping) {
    try { await runAutomationCycle(prisma); await deliverNotifications(prisma); }
    catch { console.error('Otomasyon döngüsü tamamlanamadı; sonraki döngüde yeniden denenecek.'); }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 30_000));
  }
  await prisma.$disconnect();
}
main().catch(() => { process.exitCode = 1; });
