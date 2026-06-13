export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!currentUser) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

    // Tüm traderları getir - performans bilgileriyle
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, avatar: true, tier: true, balance: true, initialBalance: true, createdAt: true,
        _count: { select: { followers: true, following: true } },
        transactions: { select: { type: true, pnl: true }, where: { type: 'SELL' } },
        positions: { where: { status: 'OPEN' }, select: { symbol: true, pnl: true } },
        achievements: { select: { badge: true } },
      },
      orderBy: { balance: 'desc' },
    });

    // Takip ettiklerimi al
    const myFollowing = await prisma.socialFollow.findMany({
      where: { followerId: currentUser.id },
      select: { followingId: true },
    });
    const followingSet = new Set(myFollowing.map((f: any) => f.followingId));

    const traders = users.map((u: any, idx: number) => {
      const totalPnl = u.transactions.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
      const winTrades = u.transactions.filter((t: any) => (t.pnl || 0) > 0).length;
      const totalTrades = u.transactions.length;
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
      const totalReturn = u.initialBalance > 0 ? ((u.balance - u.initialBalance) / u.initialBalance) * 100 : 0;
      return {
        id: u.id,
        name: u.name || 'Trader',
        avatar: u.avatar || '🦊',
        tier: u.tier,
        rank: idx + 1,
        balance: u.balance,
        totalReturn,
        totalPnl,
        totalTrades,
        winRate,
        openPositions: u.positions.length,
        topPositions: u.positions.slice(0, 3).map((p: any) => p.symbol.replace('.IS', '')),
        achievements: u.achievements.length,
        followers: u._count.followers,
        following: u._count.following,
        isFollowing: followingSet.has(u.id),
        isMe: u.id === currentUser.id,
        joinedAt: u.createdAt,
      };
    });

    return NextResponse.json({ traders, myId: currentUser.id });
  } catch (error: any) {
    console.error('Social API error:', error);
    return NextResponse.json({ error: 'Veriler alınamadı' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!currentUser) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }
    const { action, targetUserId } = body;

    if (!targetUserId || targetUserId === currentUser.id) {
      return NextResponse.json({ error: 'Geçersiz kullanıcı' }, { status: 400 });
    }

    if (action === 'follow') {
      await prisma.socialFollow.create({
        data: { followerId: currentUser.id, followingId: targetUserId },
      });
      return NextResponse.json({ success: true, action: 'followed' });
    } else if (action === 'unfollow') {
      await prisma.socialFollow.deleteMany({
        where: { followerId: currentUser.id, followingId: targetUserId },
      });
      return NextResponse.json({ success: true, action: 'unfollowed' });
    }

    return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: true, action: 'already_following' });
    }
    console.error('Social follow error:', error);
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 });
  }
}
