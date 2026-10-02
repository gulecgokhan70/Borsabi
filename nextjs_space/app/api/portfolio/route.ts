import { readBotPortfolio } from '@/lib/bot-lab/portfolio-view';
import { valuePositions } from '@/lib/position-valuation';
import { CurrencyError } from '@/lib/currency';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { explainPortfolio } from '@/lib/portfolio-explanation';
import { buildEquityCurve, summarizeSales } from '@/lib/portfolio-accounting';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const userId = (session.user as any).id;

    const summaryOnly = request.nextUrl.searchParams.get('summary') === '1';
    const { user, positions, botData, manualTransactions, sales, winners } = await prisma.$transaction(async tx => {
      const [user, positions, botData] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { balance: true, initialBalance: true, commissionRate: true } }),
        tx.position.findMany({ where: { userId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } }),
        readBotPortfolio(tx, userId),
      ]);
      const manualTransactions = summaryOnly ? [] : await tx.transaction.findMany({
        where: { userId }, orderBy: { createdAt: 'asc' },
        select: { type: true, total: true, pnl: true, commission: true, price: true, quantity: true, symbol: true, createdAt: true, pricePnlTry: true, fxPnlTry: true },
      });
      const sales = summaryOnly ? await tx.transaction.aggregate({ where: { userId, type: 'SELL', pnl: { not: null } }, _sum: { pnl: true }, _count: { _all: true } }) : null;
      const winners = summaryOnly ? await tx.transaction.count({ where: { userId, type: 'SELL', pnl: { gt: 0 } } }) : 0;
      return { user, positions, botData, manualTransactions, sales, winners };
    }, { isolationLevel: 'RepeatableRead' });
    if (!user) return NextResponse.json({ error: 'Hesap bulunamadı' }, { status: 404 });

    const enrichedPositions = await valuePositions(positions);

    const allPositions = [...enrichedPositions, ...botData.positions];
    const totalInvested = allPositions.reduce((sum: number, p: any) => sum + (p.totalCost ?? 0), 0);
    const totalPositionValue = allPositions.reduce((sum: number, p: any) => sum + (p.totalValue ?? 0), 0);
    const unrealizedPnl = allPositions.reduce((sum: number, p: any) => sum + (p.pnl ?? 0), 0);
    // Dashboard needs totals, not the entire ledger, closed-position list or chart.
    if (summaryOnly) {
      const botSales = summarizeSales(botData.ledger);
      const totalTrades = sales!._count._all + botSales.totalTrades;
      return NextResponse.json({ accountId: userId, ...user, totalInvested, totalPositionValue,
        unrealizedPnl, realizedPnl: (sales!._sum.pnl ?? 0) + botSales.realizedPnl, totalTrades,
        winRate: totalTrades ? (winners + botData.ledger.filter(e => e.type === 'SELL' && (e.pnl ?? 0) > 0).length) / totalTrades * 100 : 0,
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const closedPositions = await prisma.position.findMany({ where: { userId, status: 'CLOSED' }, orderBy: { closedAt: 'desc' }, take: 50 });
    // Toplam portföy değeri eğrisi: işlem geçmişinden hesapla
    // Her işlem noktasında: nakit bakiye + açık pozisyonların maliyet değeri = toplam portföy
    const allTransactions = [...manualTransactions, ...botData.ledger].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const capitalEntries = botData.capitalChanges.map(c => ({ type: 'CAPITAL', symbol: '', quantity: 0, total: c.amount, commission: 0, pnl: null, createdAt: new Date(c.time) }));
    const { realizedPnl, winRate, totalTrades } = summarizeSales(allTransactions);
    const equityCurve = buildEquityCurve(user.initialBalance - botData.capitalChanges.reduce((n, c) => n + c.amount, 0), [...allTransactions, ...capitalEntries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));

    // Son durum: güncel bakiye + güncel pozisyon değeri (canlı fiyatlarla)
    const currentTotal = (user?.balance ?? 100000) + totalPositionValue;
    const lastPoint = equityCurve[equityCurve.length - 1];
    if (Math.abs((lastPoint?.balance ?? 0) - currentTotal) > 1) {
      equityCurve.push({
        date: 'Şimdi',
        balance: Math.round(currentTotal * 100) / 100,
      });
    }

    // Pozisyon dağılımı: donut chart için
    const distribution = allPositions.map((p: any) => ({
      name: p.symbol?.replace?.('.IS', '')?.replace?.('-USD', '') ?? 'Bilinmiyor',
      value: Math.round((p.totalValue ?? 0) * 100) / 100,
      pnlPercent: p.pnlPercent ?? 0,
    }));
    // Nakit kısmını da ekle
    if ((user?.balance ?? 0) > 0) {
      distribution.unshift({ name: 'Nakit', value: Math.round((user?.balance ?? 100000) * 100) / 100, pnlPercent: 0 });
    }

    return NextResponse.json({
      accountId: userId,
      balance: user?.balance ?? 100000,
      initialBalance: user?.initialBalance ?? 100000,
      commissionRate: user?.commissionRate ?? 0.002,
      positions: enrichedPositions,
      botAccounts: botData.bots,
      hasCapitalChanges: botData.capitalChanges.length > 0,
      closedPositions,
      totalInvested,
      totalPositionValue,
      unrealizedPnl,
      realizedPnl,
      winRate,
      totalTrades,
      buyCount: allTransactions.filter(t => t.type === 'BUY' && !('transfer' in t && t.transfer)).length,
      sellCount: allTransactions.filter(t => t.type === 'SELL').length,
      equityCurve,
      distribution,
      explanation: explainPortfolio(user.initialBalance, user.balance, allPositions, allTransactions),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    if (error instanceof CurrencyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Portfolio error:', error);
    return NextResponse.json({ error: 'Portföy verileri alınamadı' }, { status: 500 });
  }
}
