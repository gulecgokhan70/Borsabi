export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const userId = (session.user as any).id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, initialBalance: true } });
    const positions = await prisma.position.findMany({ where: { userId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    const closedPositions = await prisma.position.findMany({ where: { userId, status: 'CLOSED' }, orderBy: { closedAt: 'desc' }, take: 50 });
    
    const totalInvested = positions.reduce((sum: number, p: any) => sum + (p?.entryPrice ?? 0) * (p?.quantity ?? 0), 0);
    const totalPnl = closedPositions.reduce((sum: number, p: any) => sum + (p?.pnl ?? 0), 0);
    const winCount = closedPositions.filter((p: any) => (p?.pnl ?? 0) > 0).length;
    const totalTrades = closedPositions?.length ?? 0;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    return NextResponse.json({
      balance: user?.balance ?? 100000,
      initialBalance: user?.initialBalance ?? 100000,
      positions,
      closedPositions,
      totalInvested,
      totalPnl,
      winRate,
      totalTrades,
    });
  } catch (error: any) {
    console.error('Portfolio error:', error);
    return NextResponse.json({ error: 'Portföy verileri alınamadı' }, { status: 500 });
  }
}
