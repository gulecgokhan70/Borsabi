export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { normalizeMarketSymbol } from '@/lib/market-quotes';

const alertSchema = z.object({
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9.^=-]+$/),
  name: z.string().trim().min(1).max(160),
  condition: z.enum(['above', 'below']),
  targetPrice: z.number().finite().positive(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const alerts = await prisma.priceAlert.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ alerts });
  } catch (err: any) {
    console.error('Alerts GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const parsed = alertSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz alarm bilgileri' }, { status: 400 });
    const max = ['pro', 'elite'].includes(user.tier) ? 50 : 5;
    const alert = await prisma.$transaction(async tx => {
      const count = await tx.priceAlert.count({ where: { userId: user.id, active: true, triggered: false } });
      if (count >= max) return null;
      return tx.priceAlert.create({ data: { ...parsed.data, symbol: normalizeMarketSymbol(parsed.data.symbol), userId: user.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!alert) return NextResponse.json({ error: `Maksimum ${max} aktif alarm limiti. Paketinizi yükseltin.` }, { status: 400 });

    return NextResponse.json({ alert });
  } catch (err: any) {
    if (err?.code === 'P2034') return NextResponse.json({ error: 'Eşzamanlı alarm güncellemesi. Lütfen tekrar deneyin.' }, { status: 409 });
    console.error('Alerts POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const alertId = searchParams.get('id');
    if (!alertId) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 });

    await prisma.priceAlert.deleteMany({ where: { id: alertId, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Alerts DELETE error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
