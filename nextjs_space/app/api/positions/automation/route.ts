import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { automationStatus } from '@/lib/automation';
import { z } from 'zod';
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const parsed = z.object({ id: z.string().max(100), enabled: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  const p = await prisma.position.findFirst({ where: { id: parsed.data.id, userId: session.user.id, status: 'OPEN' } });
  if (!p) return NextResponse.json({ error: 'Pozisyon bulunamadı' }, { status: 404 });
  if (parsed.data.enabled && (!(p.stopLoss || p.takeProfit || p.trailingStopPercent) || !(await automationStatus(prisma)).active)) {
    return NextResponse.json({ error: 'Geçerli bir eşik ve çalışan otomasyon hizmeti gerekiyor.' }, { status: 409 });
  }
  const update = await prisma.position.updateMany({ where: { id: p.id, userId: session.user.id, status: 'OPEN', updatedAt: p.updatedAt }, data: { autoExit: parsed.data.enabled } });
  return NextResponse.json(update.count ? { success: true } : { error: 'Pozisyon değişti; yenileyin.' }, { status: update.count ? 200 : 409 });
}
