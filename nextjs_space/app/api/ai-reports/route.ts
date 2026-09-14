import { createHash } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { aiReportSchema } from '@/lib/ai-report';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { takeRequestSlot } from '@/lib/request-limit';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    const parsed = aiReportSchema.safeParse(await readMutationJson(request, 60_000));
    if (!parsed.success) return NextResponse.json({ error: 'Bildirim içeriği geçersiz veya çok uzun.' }, { status: 400 });
    if (!await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) return NextResponse.json({ error: 'Hesap bulunamadı.' }, { status: 401 });
    const fingerprint = createHash('sha256').update(JSON.stringify([parsed.data.source, parsed.data.content, parsed.data.reason])).digest('hex');
    const existing = await prisma.aiContentReport.findUnique({ where: { userId_fingerprint: { userId, fingerprint } }, select: { id: true } });
    if (existing) return NextResponse.json({ id: existing.id, received: true });
    const slot = takeRequestSlot(`ai-report:${userId}`, 10, 60 * 60_000);
    if (!slot.allowed) return NextResponse.json({ error: 'Bildirim sınırına ulaştınız. Daha sonra tekrar deneyin.' }, { status: 429, headers: { 'Retry-After': String(slot.retryAfter) } });
    const report = await prisma.aiContentReport.upsert({
      where: { userId_fingerprint: { userId, fingerprint } }, update: {},
      create: { ...parsed.data, userId, fingerprint }, select: { id: true },
    });
    return NextResponse.json({ id: report.id, received: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Bildirim kaydedilemedi. Lütfen tekrar deneyin.' }, { status: 500 });
  }
}
