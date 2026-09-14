export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { transactionSummary } from '@/lib/transaction-summary';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const page = Number(params.get('page') ?? '1'), limit = Number(params.get('limit') ?? '25');
    const filter = params.get('type') || 'all';
    if (!Number.isSafeInteger(page) || page < 1 || page > 100_000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !['all', 'BUY', 'SELL'].includes(filter)) {
      return NextResponse.json({ error: 'Geçersiz sayfa, işlem türü veya limit (1–100).' }, { status: 400 });
    }
    const where = { userId, ...(filter === 'all' ? {} : { type: filter }) };
    const result = await prisma.$transaction(async tx => {
      const [rows, total, stats] = await Promise.all([
        tx.transaction.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        tx.transaction.count({ where }),
        transactionSummary(tx, userId),
      ]);
      return { transactions: rows.map(t => ({ ...t, currency: t.marketType === 'CRYPTO' ? 'USD' : 'TRY', legacyCurrency: t.marketType === 'CRYPTO' && t.fxRate == null })), total, stats };
    }, { isolationLevel: 'RepeatableRead' });
    return NextResponse.json({ ...result, page, limit, hasMore: page * limit < result.total }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'İşlem geçmişi alınamadı' }, { status: 500 });
  }
}
