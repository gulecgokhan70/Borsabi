export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const BADGE_DEFS: { id: string; name: string; desc: string; icon: string; check: (data: any) => boolean }[] = [
  { id: 'first-trade', name: 'İlk Adım', desc: 'İlk işleminizi gerçekleştirdiniz', icon: '🎯', check: (d: any) => d.totalTrades >= 1 },
  { id: 'trader-10', name: 'Aktif Trader', desc: '10 işlem tamamladınız', icon: '📊', check: (d: any) => d.totalTrades >= 10 },
  { id: 'trader-50', name: 'Deneyimli Trader', desc: '50 işlem tamamladınız', icon: '🏅', check: (d: any) => d.totalTrades >= 50 },
  { id: 'trader-100', name: 'Profesyonel', desc: '100 işlem tamamladınız', icon: '👑', check: (d: any) => d.totalTrades >= 100 },
  { id: 'profit-10', name: 'Kârlı Başlangıç', desc: '%10 toplam getiri elde ettiniz', icon: '💰', check: (d: any) => d.totalReturn >= 10 },
  { id: 'profit-50', name: 'Altın Boğa', desc: '%50 toplam getiri elde ettiniz', icon: '🐂', check: (d: any) => d.totalReturn >= 50 },
  { id: 'win-rate-60', name: 'Keskin Nişancı', desc: '%60+ kazanç oranı (min 10 işlem)', icon: '🎯', check: (d: any) => d.winRate >= 60 && d.closedCount >= 10 },
  { id: 'risk-master', name: 'Risk Ustası', desc: 'Stop loss ile 20+ işlem kapattınız', icon: '🛡️', check: (d: any) => d.stoppedTrades >= 20 },
  { id: 'diversified', name: 'Portföy Ustası', desc: '5+ farklı sembolde işlem yaptınız', icon: '🌐', check: (d: any) => d.uniqueSymbols >= 5 },
  { id: 'crypto-trader', name: 'Kripto Kaşifi', desc: 'Kripto varlıkta işlem yaptınız', icon: '₿', check: (d: any) => d.hasCrypto },
  { id: 'academy-grad', name: 'Akademi Mezunu', desc: 'Tüm akademi kurslarını tamamladınız', icon: '🎓', check: () => false },
  { id: 'streak-3', name: 'Üçlü Seri', desc: 'Art arda 3 kârlı işlem yaptınız', icon: '🔥', check: (d: any) => d.maxWinStreak >= 3 },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        positions: true,
        transactions: { orderBy: { createdAt: 'asc' } },
        achievements: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const closedPositions = user.positions.filter((p: any) => p.status === 'CLOSED');
    const wins = closedPositions.filter((p: any) => p.pnl > 0);
    const totalReturn = ((user.balance - user.initialBalance) / user.initialBalance) * 100;
    const uniqueSymbols = new Set(user.transactions.map((t: any) => t.symbol)).size;
    const hasCrypto = user.transactions.some((t: any) => t.marketType === 'CRYPTO');
    const stoppedTrades = closedPositions.filter((p: any) => p.stopLoss != null).length;

    // Calculate max win streak
    let maxWinStreak = 0;
    let currentStreak = 0;
    const sellTxns = user.transactions.filter((t: any) => t.type === 'SELL');
    for (const t of sellTxns) {
      if ((t as any).pnl != null && (t as any).pnl > 0) {
        currentStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const data = {
      totalTrades: user.transactions.length,
      closedCount: closedPositions.length,
      totalReturn,
      winRate: closedPositions.length > 0 ? (wins.length / closedPositions.length) * 100 : 0,
      uniqueSymbols,
      hasCrypto,
      stoppedTrades,
      maxWinStreak,
    };

    // Check and unlock badges
    const existingBadges = new Set(user.achievements.map((a: any) => a.badge));
    const newBadges: string[] = [];

    for (const badge of BADGE_DEFS) {
      if (!existingBadges.has(badge.id) && badge.check(data)) {
        try {
          await prisma.achievement.create({ data: { userId: user.id, badge: badge.id } });
          newBadges.push(badge.id);
        } catch (e: any) {
          // Unique constraint - already exists
        }
      }
    }

    const allAchievements = await prisma.achievement.findMany({ where: { userId: user.id } });
    const unlockedIds = new Set(allAchievements.map((a: any) => a.badge));

    const badges = BADGE_DEFS.map((b: any) => ({
      ...b,
      unlocked: unlockedIds.has(b.id),
      unlockedAt: allAchievements.find((a: any) => a.badge === b.id)?.unlockedAt || null,
    }));

    return NextResponse.json({ badges, newBadges, stats: data });
  } catch (err: any) {
    console.error('Achievements error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
