export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        positions: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
        achievements: true,
        priceAlerts: { where: { active: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const closedPositions = user.positions.filter((p: any) => p.status === 'CLOSED');
    const openPositions = user.positions.filter((p: any) => p.status === 'OPEN');
    const totalTrades = closedPositions.length;
    const wins = closedPositions.filter((p: any) => (p.pnl ?? 0) > 0).length;
    const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0;
    const totalPnl = closedPositions.reduce((s: number, p: any) => s + (p.pnl || 0), 0);
    const totalReturn = user.initialBalance > 0 ? ((user.balance - user.initialBalance) / user.initialBalance) * 100 : 0;

    // Monthly performance
    const now = new Date();
    const monthlyPerf: { month: string; pnl: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthTxns = user.transactions.filter((t: any) => {
        const td = new Date(t.createdAt);
        return td >= d && td <= end && t.pnl != null;
      });
      const pnl = monthTxns.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
      monthlyPerf.push({ month: d.toLocaleString('tr-TR', { month: 'short' }), pnl });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      role: user.role,
      balance: user.balance,
      initialBalance: user.initialBalance,
      totalReturn,
      totalPnl,
      totalTrades,
      openPositions: openPositions.length,
      winRate,
      achievements: user.achievements,
      activeAlerts: user.priceAlerts.length,
      monthlyPerformance: monthlyPerf,
      memberSince: user.createdAt,
    });
  } catch (err: any) {
    console.error('Profile API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, tier } = body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (tier && ['free', 'pro'].includes(tier)) updateData.tier = tier;

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
    });

    return NextResponse.json({ success: true, tier: user.tier, name: user.name });
  } catch (err: any) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
