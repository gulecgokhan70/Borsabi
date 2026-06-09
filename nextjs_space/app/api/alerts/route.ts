export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

    const body = await req.json();
    const { symbol, name, condition, targetPrice } = body;

    if (!symbol || !name || !condition || !targetPrice) {
      return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });
    }

    // Limit: free=5, pro=20, elite=50
    const activeCount = await prisma.priceAlert.count({ where: { userId: user.id, active: true } });
    const limits: Record<string, number> = { free: 5, pro: 20, elite: 50 };
    const max = limits[user.tier] || 5;
    if (activeCount >= max) {
      return NextResponse.json({ error: `Maksimum ${max} aktif alarm limiti. Paketinizi yükseltin.` }, { status: 400 });
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        symbol,
        name,
        condition,
        targetPrice,
      },
    });

    return NextResponse.json({ alert });
  } catch (err: any) {
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
