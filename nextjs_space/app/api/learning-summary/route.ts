import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { transactionSummary, learningSuggestions } from '@/lib/transaction-summary';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    const days = Number(request.nextUrl.searchParams.get('days') || 7);
    if (![7, 30].includes(days)) return NextResponse.json({ error: '7 veya 30 günlük dönem seçin.' }, { status: 400 });
    const end = new Date(), start = new Date(end.getTime() - days * 86_400_000);
    const summary = await transactionSummary(prisma, userId, { start, end });
    return NextResponse.json({ days, start, end, summary, suggestions: learningSuggestions(summary) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Öğrenme özeti alınamadı.' }, { status: 500 }); }
}
