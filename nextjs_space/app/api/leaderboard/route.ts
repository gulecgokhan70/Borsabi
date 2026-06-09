export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        tier: true,
        balance: true,
        initialBalance: true,
        createdAt: true,
        _count: { select: { positions: true, transactions: true, achievements: true } },
      },
      orderBy: { balance: 'desc' },
      take: 50,
    });

    const leaderboard = users.map((u: any, idx: number) => {
      const totalReturn = ((u.balance - u.initialBalance) / u.initialBalance) * 100;
      return {
        rank: idx + 1,
        name: u.name || 'Anonim Trader',
        tier: u.tier,
        balance: u.balance,
        totalReturn,
        totalTrades: u._count.transactions,
        achievements: u._count.achievements,
        memberSince: u.createdAt,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (err: any) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
