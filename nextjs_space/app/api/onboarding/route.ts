import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { GUIDE_STEPS, guideKey, guideStateSchema, parseGuideState } from '@/lib/onboarding';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  try {
    const row = await prisma.scanCache.findUnique({ where: { id: guideKey(session.user.id) } });
    return NextResponse.json(parseGuideState(row?.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Rehber ilerlemesi alınamadı.' }, { status: 503 }); }
}
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  let body: unknown;
  try { body = await readMutationJson(request, 1000); }
  catch (error) { return NextResponse.json({ error: error instanceof RequestError ? error.message : 'Geçersiz istek.' }, { status: error instanceof RequestError ? error.status : 400 }); }
  const parsed = guideStateSchema.safeParse(body);
  if (!parsed.success || !['in_progress', 'skipped', 'completed'].includes(parsed.data.status) ||
    (parsed.data.status === 'completed' && parsed.data.step !== GUIDE_STEPS.length - 1)) {
    return NextResponse.json({ error: 'Geçersiz rehber adımı.' }, { status: 400 });
  }
  try {
    const id = guideKey(session.user.id), data = JSON.stringify(parsed.data);
    await prisma.scanCache.upsert({ where: { id }, create: { id, data }, update: { data } });
    return NextResponse.json(parsed.data);
  } catch { return NextResponse.json({ error: 'İlerleme kaydedilemedi. Tekrar deneyebilirsiniz.' }, { status: 503 }); }
}
