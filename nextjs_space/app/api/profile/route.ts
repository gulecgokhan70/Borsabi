export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cachedQuoteBatch } from '@/lib/yahoo-finance';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { BIST_ALL_ASSETS } from '@/lib/constants';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        positions: true,
        transactions: { where: { type: 'SELL' }, orderBy: { createdAt: 'desc' } },
        achievements: true,
        priceAlerts: { where: { active: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const openPositions = user.positions.filter((p: any) => p.status === 'OPEN');
    const totalTrades = user.transactions.length;
    const wins = user.transactions.filter(t => (t.pnl ?? 0) > 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnl = user.transactions.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    // Açık pozisyonlar için canlı fiyatları çek (portföy API'si ile aynı mantık)
    let openPositionValue = 0;
    if (openPositions.length > 0) {
      const normalizeSymbol = (sym: string): string => {
        if (sym.endsWith('.IS') || sym.endsWith('-USD')) return sym;
        const bistMatch = BIST_ALL_ASSETS.find((a: any) => a.symbol === `${sym}.IS`);
        return bistMatch ? bistMatch.symbol : sym;
      };

      const symbolMap = new Map<string, string>();
      openPositions.forEach((p: any) => { symbolMap.set(p.symbol, normalizeSymbol(p.symbol)); });

      const normalizedSymbols = [...new Set(Array.from(symbolMap.values()))];
      const bistSymbols = normalizedSymbols.filter((s: string) => s.endsWith('.IS'));
      const otherSymbols = normalizedSymbols.filter((s: string) => !s.endsWith('.IS'));

      let midasMap = new Map<string, MidasStock>();
      if (bistSymbols.length > 0) {
        try { midasMap = await getMidasStockMap(); } catch (e) { /* ignore */ }
      }

      let yahooMap = new Map<string, any>();
      const yahooNeeded = otherSymbols.concat(
        bistSymbols.filter((s: string) => !midasMap.has(s.replace('.IS', '').toUpperCase()))
      );
      if (yahooNeeded.length > 0) {
        try { yahooMap = await cachedQuoteBatch(yahooNeeded); } catch (e) { /* ignore */ }
      }

      openPositionValue = openPositions.reduce((sum: number, p: any) => {
        let livePrice = p.currentPrice ?? p.entryPrice;
        const normalized = symbolMap.get(p.symbol) ?? p.symbol;
        const cleanSym = normalized.replace('.IS', '').toUpperCase();
        const midas = normalized.endsWith('.IS') ? midasMap.get(cleanSym) : null;
        if (midas) {
          const mp = midas.Last || midas.Close || midas.PreviousClose || 0;
          if (mp > 0) livePrice = mp;
        } else {
          const yq: any = yahooMap.get(normalized) ?? yahooMap.get(p.symbol);
          if (yq) {
            const yp = yq?.regularMarketPrice ?? 0;
            if (yp > 0) livePrice = yp;
          }
        }
        return sum + (livePrice * p.quantity);
      }, 0);
    }

    const totalPortfolioValue = user.balance + openPositionValue;
    const totalReturn = user.initialBalance > 0 ? ((totalPortfolioValue - user.initialBalance) / user.initialBalance) * 100 : 0;

    // Monthly performance
    const now = new Date();
    const monthlyPerf: { month: string; pnl: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthTxns = user.transactions.filter((t: any) => {
        const td = new Date(t.createdAt);
        return td >= d && td < end && t.pnl != null;
      });
      const pnl = monthTxns.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
      monthlyPerf.push({ month: d.toLocaleString('tr-TR', { month: 'short' }), pnl });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      tier: user.tier,
      role: user.role,
      balance: user.balance,
      initialBalance: user.initialBalance,
      totalPortfolioValue,
      totalReturn,
      totalPnl,
      totalTrades,
      openPositions: openPositions.length,
      winRate,
      achievements: user.achievements,
      activeAlerts: user.priceAlerts.length,
      monthlyPerformance: monthlyPerf,
      commissionRate: user.commissionRate ?? 0.002,
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
    const { name, tier, avatar, commissionRate } = body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (tier && ['free', 'pro'].includes(tier)) updateData.tier = tier;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (commissionRate !== undefined) {
      const rate = parseFloat(commissionRate);
      if (!isNaN(rate) && rate >= 0 && rate <= 0.01) {
        updateData.commissionRate = rate;
      }
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
    });

    return NextResponse.json({ success: true, tier: user.tier, name: user.name, avatar: user.avatar });
  } catch (err: any) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
