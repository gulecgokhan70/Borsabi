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
    const items = await prisma.watchlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ data: items });
  } catch (error: any) {
    console.error('Watchlist error:', error);
    return NextResponse.json({ error: 'İzleme listesi alınamadı' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const userId = (session.user as any).id;
    const { symbol, name, type } = await request.json();
    if (!symbol) return NextResponse.json({ error: 'Sembol gerekli' }, { status: 400 });

    const existing = await prisma.watchlist.findUnique({ where: { userId_symbol: { userId, symbol } } });
    if (existing) {
      await prisma.watchlist.delete({ where: { id: existing.id } });
      return NextResponse.json({ removed: true, message: `${symbol} izleme listesinden kaldırıldı` });
    }

    const item = await prisma.watchlist.create({ data: { userId, symbol, name: name ?? symbol, type: type ?? 'BIST' } });
    return NextResponse.json({ added: true, data: item, message: `${symbol} izleme listesine eklendi` });
  } catch (error: any) {
    console.error('Watchlist error:', error);
    return NextResponse.json({ error: 'İzleme listesi güncellenemedi' }, { status: 500 });
  }
}
