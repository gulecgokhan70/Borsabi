import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { automationStatus } from '@/lib/automation';
import { pushConfigured, subscriptionSchema } from '@/lib/push';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const events = await prisma.appNotification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  return NextResponse.json({ events, automation: await automationStatus(prisma), publicKey: pushConfigured() ? process.env.WEB_PUSH_PUBLIC_KEY : null }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const data = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: 'Geçersiz bildirim aboneliği' }, { status: 400 });
  if (!pushConfigured()) return NextResponse.json({ error: 'Telefon bildirimleri henüz yapılandırılmadı.' }, { status: 503 });
  const count = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  if (count >= 10) return NextResponse.json({ error: 'En fazla 10 cihaz kaydedilebilir.' }, { status: 409 });
  await prisma.pushSubscription.upsert({ where: { endpoint: data.data.endpoint },
    create: { userId: session.user.id, endpoint: data.data.endpoint, ...data.data.keys },
    update: { userId: session.user.id, ...data.data.keys } });
  return NextResponse.json({ success: true });
}
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Abonelik gerekli' }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { userId: session.user.id, endpoint: body.endpoint } });
  return NextResponse.json({ success: true });
}
