export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executeTrade, tradeSchema, TradeError } from '@/lib/trading';
import { getMarketQuotes, normalizeMarketSymbol } from '@/lib/market-quotes';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const parsed = tradeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz işlem' }, { status: 400 });
    const trade = { ...parsed.data, symbol: normalizeMarketSymbol(parsed.data.symbol) };
    if (trade.marketType === 'BIST' && !trade.symbol.endsWith('.IS')) {
      return NextResponse.json({ error: 'BIST sembolü bulunamadı' }, { status: 400 });
    }
    const [quote] = await getMarketQuotes([trade.symbol]);
    if (!quote || quote.error || !Number.isFinite(quote.price) || quote.price <= 0) {
      return NextResponse.json({ error: 'Piyasa fiyatı alınamadı. Lütfen tekrar deneyin.' }, { status: 503 });
    }
    return NextResponse.json(await executeTrade(prisma, session.user.id, trade, quote.price));
  } catch (error) {
    if (error instanceof TradeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Trade error:', error);
    return NextResponse.json({ error: 'İşlem sırasında hata oluştu' }, { status: 500 });
  }
}
