import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readMutationJson, RequestError } from '@/lib/request-json';
export const dynamic = 'force-dynamic';
async function isAdmin() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return false;
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return user?.role === 'admin';
}
export async function GET(request: NextRequest) {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 });
    const page = Number(request.nextUrl.searchParams.get('page') || 1);
    const status = request.nextUrl.searchParams.get('status') || 'OPEN';
    if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || !['OPEN', 'REVIEWED', 'DISMISSED'].includes(status)) return NextResponse.json({ error: 'Geçersiz filtre.' }, { status: 400 });
    const [reports, total] = await Promise.all([
      prisma.aiContentReport.findMany({ where: { status }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20,
        select: { id: true, source: true, content: true, reason: true, comment: true, status: true, createdAt: true, reviewedAt: true } }),
      prisma.aiContentReport.count({ where: { status } }),
    ]);
    return NextResponse.json({ reports, total, page }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Bildirimler alınamadı.' }, { status: 500 }); }
}
export async function PATCH(request: NextRequest) {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 });
    const parsed = z.object({ id: z.string().min(1).max(100), status: z.enum(['OPEN', 'REVIEWED', 'DISMISSED']) }).strict().safeParse(await readMutationJson(request, 4096));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz inceleme sonucu.' }, { status: 400 });
    const result = await prisma.aiContentReport.updateMany({ where: { id: parsed.data.id }, data: { status: parsed.data.status, reviewedAt: parsed.data.status === 'OPEN' ? null : new Date() } });
    if (!result.count) return NextResponse.json({ error: 'Bildirim bulunamadı.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'İnceleme kaydedilemedi.' }, { status: 500 });
  }
}
