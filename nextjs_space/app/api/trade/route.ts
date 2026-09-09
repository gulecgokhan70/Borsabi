export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executeTrade, tradeSchema, TradeError, priorTrade } from '@/lib/trading';
import { getMarketQuotes, normalizeMarketSymbol } from '@/lib/market-quotes';
import { getUsdTryRate } from '@/lib/fx';
import { CurrencyError, quoteCurrency } from '@/lib/currency';
import { automationStatus } from '@/lib/automation';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const parsed = tradeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz işlem' }, { status: 400 });
    const trade = { ...parsed.data, symbol: normalizeMarketSymbol(parsed.data.symbol) };
    if (!trade.requestId) return NextResponse.json({ error: 'İşlem kimliği gerekli. Sayfayı yenileyip tekrar deneyin.' }, { status: 400 });
    const prior = await priorTrade(prisma, session.user.id, trade);
    if (prior) return NextResponse.json(prior);
    if (trade.autoExit && !(await automationStatus(prisma)).active) return NextResponse.json({ error: 'Otomasyon hizmeti hazır değil. Otomatik satışı kapatıp deneyin.' }, { status: 409 });
    if (trade.marketType === 'BIST' && !trade.symbol.endsWith('.IS')) {
      return NextResponse.json({ error: 'BIST sembolü bulunamadı' }, { status: 400 });
    }
    const [quote] = await getMarketQuotes([trade.symbol]);
    if (!quote || quote.error || !Number.isFinite(quote.price) || quote.price <= 0) {
      return NextResponse.json({ error: 'Piyasa fiyatı alınamadı. Lütfen tekrar deneyin.' }, { status: 503 });
    }
    if (quote.currency !== quoteCurrency(trade.marketType)) {
      return NextResponse.json({ error: 'Fiyatın para birimi doğrulanamadı.' }, { status: 503 });
    }
    const fx = trade.marketType === 'CRYPTO' ? await getUsdTryRate() : undefined;
    return NextResponse.json(await executeTrade(prisma, session.user.id, trade, quote.price, fx));
  } catch (error) {
    if (error instanceof TradeError || error instanceof CurrencyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Trade error:', error);
    return NextResponse.json({ error: 'İşlem sırasında hata oluştu' }, { status: 500 });
  }
}
