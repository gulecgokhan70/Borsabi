import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  try {
    const started = Number(process.argv[2]) * 1000;
    const heartbeat = await db.scanCache.findUnique({ where: { id: 'bot-lab-worker' } });
    if (!Number.isFinite(started) || !heartbeat || heartbeat.updatedAt.getTime() < started || Date.now() - heartbeat.updatedAt.getTime() > 180000) throw new Error('heartbeat');
    console.log('Sanal bot servisi kontrolü geçti.');
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Sanal bot servisi henüz doğrulanmadı.'); process.exitCode = 1; });
