export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cachedQuoteBatch, cachedChart } from '@/lib/yahoo-finance';
import { BIST_TOP_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { getMidasStockMap } from '@/lib/midas-api';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Midas data for all top stocks
    const midasMap = await getMidasStockMap().catch(() => new Map());

    // Build stock data with change info
    const stocksWithData = BIST_TOP_STOCKS.map(s => {
      const code = s.symbol.replace('.IS', '');
      const m: any = midasMap.get(code) || {};
      return {
        symbol: s.symbol,
        name: s.name,
        shortName: s.shortName,
        price: m.Last || m.Close || 0,
        change: m.DailyChange || 0,
        changePercent: m.DailyChangePercent || 0,
        volume: m.TotalVolume || 0,
      };
    }).filter(s => s.price > 0);

    // Top gainers & losers
    const sorted = [...stocksWithData].sort((a, b) => b.changePercent - a.changePercent);
    const topGainers = sorted.slice(0, 5);
    const topLosers = sorted.slice(-5).reverse();

    // Volume leaders
    const volumeLeaders = [...stocksWithData].sort((a, b) => b.volume - a.volume).slice(0, 5);

    // Most watched (from watchlist table)
    let popularStocks: any[] = [];
    try {
      const watchCounts = await prisma.watchlist.groupBy({
        by: ['symbol'],
        _count: { symbol: true },
        orderBy: { _count: { symbol: 'desc' } },
        take: 5,
      });
      popularStocks = watchCounts.map((w: any) => {
        const found = stocksWithData.find(s => s.symbol === w.symbol);
        return found ? { ...found, watchCount: w._count.symbol } : null;
      }).filter(Boolean);
    } catch {}

    // Crypto movers
    let cryptoMovers: any[] = [];
    try {
      const cSymbols = CRYPTO_ASSETS.map(c => c.symbol);
      const cQuotes = await cachedQuoteBatch(cSymbols);
      cryptoMovers = CRYPTO_ASSETS.map(ca => {
        const q: any = cQuotes.get(ca.symbol) || {};
        return {
          symbol: ca.symbol,
          name: ca.name,
          shortName: ca.shortName,
          price: q.regularMarketPrice ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
        };
      }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    } catch {}

    // Recent community trades (anonymized)
    let recentTrades: any[] = [];
    try {
      const trades = await prisma.transaction.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: { type: true, symbol: true, quantity: true, price: true, createdAt: true },
      });
      recentTrades = trades.map((t: any) => ({
        type: t.type,
        symbol: t.symbol,
        quantity: t.quantity,
        price: t.price,
        time: t.createdAt,
      }));
    } catch {}

    // Quick tips
    const tips = [
      { title: 'Stop-Loss Kullanın', desc: 'Her işlemde mutlaka stop-loss belirleyin. Sermayenizi korumak kazançtan önemlidir.', icon: 'shield' },
      { title: 'Pozisyon Büyüklüğü', desc: 'İşlem başına portföyünüzün en fazla %2\'sini riske edin.', icon: 'target' },
      { title: 'Trend Takibi', desc: 'Trende karşı işlem yapmakın riskini bilin. Ana trendi takip edin.', icon: 'trending' },
      { title: 'Duygusal Kontrol', desc: 'Korku ve açgözlükle değil, planınızla işlem yapın.', icon: 'brain' },
      { title: 'Hacim Analizi', desc: 'Fiyat hareketini hacimle doğrulayın. Düşük hacimde kırılımlar güvenilir değildir.', icon: 'bar' },
      { title: 'Risk/Ödül Oranı', desc: 'En az 1:2 risk/ödül oranıyla işlem açın.', icon: 'scale' },
    ];

    return NextResponse.json({
      topGainers,
      topLosers,
      volumeLeaders,
      popularStocks,
      cryptoMovers,
      recentTrades,
      tips,
    });
  } catch (e: any) {
    console.error('Keşfet API error:', e);
    return NextResponse.json({ error: 'Veri alınamadı' }, { status: 500 });
  }
}
