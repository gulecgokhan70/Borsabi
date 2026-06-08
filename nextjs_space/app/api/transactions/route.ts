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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    const allTx = await prisma.transaction.findMany({ where: { userId } });
    const sells = allTx.filter((t: any) => t?.type === 'SELL' && t?.pnl != null);
    const totalPnl = sells.reduce((s: number, t: any) => s + (t?.pnl ?? 0), 0);
    const winCount = sells.filter((t: any) => (t?.pnl ?? 0) > 0).length;
    const lossCount = sells.filter((t: any) => (t?.pnl ?? 0) < 0).length;
    const avgWin = winCount > 0 ? sells.filter((t: any) => (t?.pnl ?? 0) > 0).reduce((s: number, t: any) => s + (t?.pnl ?? 0), 0) / winCount : 0;
    const avgLoss = lossCount > 0 ? sells.filter((t: any) => (t?.pnl ?? 0) < 0).reduce((s: number, t: any) => s + (t?.pnl ?? 0), 0) / lossCount : 0;

    return NextResponse.json({
      transactions,
      total,
      page,
      stats: {
        totalTrades: sells?.length ?? 0,
        winCount,
        lossCount,
        winRate: (sells?.length ?? 0) > 0 ? (winCount / (sells?.length ?? 1)) * 100 : 0,
        totalPnl,
        avgWin,
        avgLoss,
      },
    });
  } catch (error: any) {
    console.error('Transactions error:', error);
    return NextResponse.json({ error: 'İşlem geçmişi alınamadı' }, { status: 500 });
  }
}
