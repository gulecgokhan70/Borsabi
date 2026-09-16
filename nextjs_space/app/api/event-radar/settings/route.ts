export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { z } from 'zod';
import { RADAR_STATE_ID, RADAR_INTERVAL, radarPreferenceId, readRadarState } from '@/lib/radar-worker';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const [row, disabled] = await Promise.all([
    prisma.scanCache.findUnique({ where: { id: RADAR_STATE_ID } }),
    prisma.scanCache.findUnique({ where: { id: radarPreferenceId(session.user.id) } }),
  ]);
  const state = readRadarState(row?.data);
  return NextResponse.json({ enabled: !disabled, checkedAt: state.checkedAt || null,
    running: !!state.checkedAt && Date.now() - state.checkedAt < 3 * RADAR_INTERVAL }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  try {
    const body = z.object({ enabled: z.boolean() }).strict().safeParse(await readMutationJson(request, 1024));
    if (!body.success) return NextResponse.json({ error: 'Geçersiz tercih' }, { status: 400 });
    const id = radarPreferenceId(session.user.id);
    if (body.data.enabled) await prisma.scanCache.deleteMany({ where: { id } });
    else await prisma.scanCache.upsert({ where: { id }, create: { id, data: 'true' }, update: { data: 'true' } });
    return NextResponse.json({ enabled: body.data.enabled });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RequestError ? error.message : 'Tercih kaydedilemedi.' }, { status: error instanceof RequestError ? error.status : 503 });
  }
}
