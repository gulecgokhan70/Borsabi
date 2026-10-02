import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { automationStatus } from '@/lib/automation';
import { z } from 'zod';
const schema = z.object({
  id: z.string().min(1).max(100), updatedAt: z.string().datetime(),
  stopLoss: z.number().finite().positive().nullable(),
  takeProfit: z.number().finite().positive().nullable(),
  trailingStopPercent: z.number().finite().positive().lt(100).nullable(),
  autoExit: z.boolean(),
}).strict().refine(v => v.stopLoss === null || v.takeProfit === null || v.stopLoss < v.takeProfit,
  'Zarar durdur seviyesi kâr al seviyesinden düşük olmalı.');
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçerli seviyeler girin. Zarar durdur, kâr al seviyesinden düşük; iz süren stop %0 ile %100 arasında olmalı.' }, { status: 400 });
  const { id, updatedAt, ...settings } = parsed.data;
  const position = await prisma.position.findFirst({ where: { id, userId: session.user.id, status: 'OPEN' } });
  if (!position) return NextResponse.json({ error: 'Açık pozisyon bulunamadı.' }, { status: 404 });
  if (position.updatedAt.toISOString() !== updatedAt) return NextResponse.json({ error: 'Pozisyon değişti. Portföyü yenileyip emri tekrar açın.' }, { status: 409 });
  if (settings.autoExit && (!(settings.stopLoss || settings.takeProfit || settings.trailingStopPercent) || !(await automationStatus(prisma)).active)) {
    return NextResponse.json({ error: 'Otomatik satış için en az bir eşik ve çalışan otomasyon hizmeti gerekli.' }, { status: 409 });
  }
  // Preserve the existing high; enabling trailing starts from the last recorded price.
  const trailingStopHighest = settings.trailingStopPercent === null ? null
    : position.trailingStopPercent && position.trailingStopHighest ? position.trailingStopHighest
    : position.currentPrice > 0 ? position.currentPrice : position.entryPrice;
  const result = await prisma.position.updateMany({
    where: { id, userId: session.user.id, status: 'OPEN', updatedAt: position.updatedAt },
    data: { ...settings, trailingStopHighest },
  });
  return NextResponse.json(result.count ? { success: true } : { error: 'Pozisyon değişti. Portföyü yenileyip tekrar deneyin.' }, { status: result.count ? 200 : 409 });
}
