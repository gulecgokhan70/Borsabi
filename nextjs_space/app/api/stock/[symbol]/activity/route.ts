import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { activityAsset, readAssetActivity, presentAssetActivity } from '@/lib/asset-activity';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
export async function GET(_req: Request, context: { params: Promise<{ symbol: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return reply({ error: 'İşlemlerinizi görmek için giriş yapın.' }, 401);
    const asset = activityAsset((await context.params).symbol);
    if (!asset) return reply({ error: 'Varlık bulunamadı.' }, 404);
    const snapshot = await prisma.$transaction(tx => readAssetActivity(tx, userId, asset), { isolationLevel: 'RepeatableRead' });
    return reply(await presentAssetActivity(snapshot, asset));
  } catch { return reply({ error: 'İşlemler yüklenemedi. Tekrar deneyin.' }, 503); }
}
