import 'dotenv/config';
import { prisma } from '../lib/db';
import { runAutomationCycle } from '../lib/automation';
import { deliverNotifications } from '../lib/push';
import { runRadarCycle } from '../lib/radar-worker';
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
async function main() {
  while (!stopping) {
    try { await runAutomationCycle(prisma); }
    catch { console.error('Otomasyon döngüsü tamamlanamadı; sonraki döngüde yeniden denenecek.'); }
    try { await runRadarCycle(prisma); }
    catch { console.error('Radar kontrolü tamamlanamadı; yeniden denenecek.'); }
    try { await deliverNotifications(prisma); }
    catch { console.error('Bildirim teslimi tamamlanamadı; yeniden denenecek.'); }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 30_000));
  }
  await prisma.$disconnect();
}
main().catch(() => { process.exitCode = 1; });
