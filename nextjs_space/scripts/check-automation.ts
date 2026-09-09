import { prisma } from '../lib/db';
async function main() {
  const started = Number(process.argv[2]);
  if (!Number.isFinite(started)) throw new Error();
  const state = await prisma.scanCache.findUnique({ where: { id: 'automation-heartbeat' } });
  if (!state || state.updatedAt.getTime() < started * 1000 || Date.now() - state.updatedAt.getTime() > 120_000) throw new Error();
}
main().catch(() => { process.exitCode = 1; }).finally(() => prisma.$disconnect());
