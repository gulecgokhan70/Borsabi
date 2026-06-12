export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cachedQuoteBatch } from '@/lib/yahoo-finance';
import { getMidasStockMap, type MidasStock } from '@/lib/midas-api';
import { BIST_ALL_ASSETS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const userId = (session.user as any).id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, initialBalance: true, commissionRate: true } });
    const positions = await prisma.position.findMany({ where: { userId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    const closedPositions = await prisma.position.findMany({ where: { userId, status: 'CLOSED' }, orderBy: { closedAt: 'desc' }, take: 50 });

    // Açık pozisyonlar için güncel fiyatları çek
    let enrichedPositions = positions.map((p: any) => ({ ...p }));
    if (positions.length > 0) {
      // Sembol normalizasyonu: .IS eki olmayan BIST sembollerini düzelt
      const normalizeSymbol = (sym: string): string => {
        if (sym.endsWith('.IS') || sym.endsWith('-USD')) return sym;
        const bistMatch = BIST_ALL_ASSETS.find((a: any) => a.symbol === `${sym}.IS`);
        return bistMatch ? bistMatch.symbol : sym;
      };

      // Her pozisyon için normalize edilmiş sembol haritası oluştur
      const symbolMap = new Map<string, string>(); // original -> normalized
      positions.forEach((p: any) => {
        symbolMap.set(p.symbol, normalizeSymbol(p.symbol));
      });

      const normalizedSymbols = [...new Set(Array.from(symbolMap.values()))];
      const bistSymbols = normalizedSymbols.filter((s: string) => s.endsWith('.IS'));
      const otherSymbols = normalizedSymbols.filter((s: string) => !s.endsWith('.IS'));

      // Midas'tan BIST fiyatlarını çek
      let midasMap = new Map<string, MidasStock>();
      if (bistSymbols.length > 0) {
        try {
          midasMap = await getMidasStockMap();
        } catch (e) {
          console.warn('[Portfolio] Midas hatası');
        }
      }

      // Yahoo'dan diğer fiyatları çek (Midas'ta bulunamayanlar)
      let yahooMap = new Map<string, any>();
      const yahooNeeded = otherSymbols.concat(
        bistSymbols.filter((s: string) => !midasMap.has(s.replace('.IS', '').toUpperCase()))
      );
      if (yahooNeeded.length > 0) {
        try {
          yahooMap = await cachedQuoteBatch(yahooNeeded);
        } catch (e) {
          console.warn('[Portfolio] Yahoo hatası');
        }
      }

      enrichedPositions = positions.map((p: any) => {
        let livePrice = p.currentPrice;
        const normalized = symbolMap.get(p.symbol) ?? p.symbol;
        const cleanSym = normalized.replace('.IS', '').toUpperCase();
        const midas = normalized.endsWith('.IS') ? midasMap.get(cleanSym) : null;

        if (midas) {
          const mp = midas.Last || midas.Close || midas.PreviousClose || 0;
          if (mp > 0) livePrice = mp;
        } else {
          // Yahoo: normalized veya orijinal sembolle dene
          const yq: any = yahooMap.get(normalized) ?? yahooMap.get(p.symbol);
          if (yq) {
            const yp = yq?.regularMarketPrice ?? 0;
            if (yp > 0) livePrice = yp;
          }
        }

        const totalValue = livePrice * p.quantity;
        const totalCost = p.entryPrice * p.quantity + (p.commission ?? 0); // komisyon dahil gerçek maliyet
        const pnl = totalValue - totalCost;
        const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

        return {
          ...p,
          currentPrice: livePrice,
          totalValue,
          totalCost,
          pnl,
          pnlPercent: pnlPct,
        };
      });
    }

    const totalInvested = enrichedPositions.reduce((sum: number, p: any) => sum + (p.totalCost ?? 0), 0);
    const totalPositionValue = enrichedPositions.reduce((sum: number, p: any) => sum + (p.totalValue ?? 0), 0);
    const unrealizedPnl = enrichedPositions.reduce((sum: number, p: any) => sum + (p.pnl ?? 0), 0);
    const realizedPnl = closedPositions.reduce((sum: number, p: any) => sum + (p?.pnl ?? 0), 0);
    const winCount = closedPositions.filter((p: any) => (p?.pnl ?? 0) > 0).length;
    const totalTrades = closedPositions?.length ?? 0;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    // Toplam portföy değeri eğrisi: işlem geçmişinden hesapla
    // Her işlem noktasında: nakit bakiye + açık pozisyonların maliyet değeri = toplam portföy
    const allTransactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { type: true, total: true, pnl: true, price: true, quantity: true, symbol: true, createdAt: true },
    });

    const initBal = user?.initialBalance ?? 100000;
    let cashBalance = initBal;
    let positionCostMap = new Map<string, number>(); // symbol -> maliyet değeri

    const equityCurve: { date: string; balance: number }[] = [
      { date: allTransactions.length > 0
        ? new Date(allTransactions[0].createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
        : new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        balance: initBal },
    ];

    for (const tx of allTransactions) {
      const txTotal = tx.total ?? ((tx.price ?? 0) * (tx.quantity ?? 0));
      const sym = tx.symbol ?? '';
      if (tx.type === 'BUY') {
        cashBalance -= txTotal;
        positionCostMap.set(sym, (positionCostMap.get(sym) ?? 0) + txTotal);
      } else {
        // SELL: nakit artar, pozisyon maliyeti azalır, realized PnL yansır
        cashBalance += txTotal;
        const prevCost = positionCostMap.get(sym) ?? 0;
        const sellCost = (tx.price ?? 0) > 0 && (tx.quantity ?? 0) > 0
          ? txTotal - (tx.pnl ?? 0) // maliyet = satış tutarı - kâr
          : txTotal;
        positionCostMap.set(sym, Math.max(0, prevCost - sellCost));
        if ((positionCostMap.get(sym) ?? 0) < 0.01) positionCostMap.delete(sym);
      }
      const totalPositionCost = Array.from(positionCostMap.values()).reduce((s, v) => s + v, 0);
      const portfolioValue = cashBalance + totalPositionCost;
      equityCurve.push({
        date: new Date(tx.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        balance: Math.round(portfolioValue * 100) / 100,
      });
    }

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
    const distribution = enrichedPositions.map((p: any) => ({
      name: p.symbol?.replace?.('.IS', '')?.replace?.('-USD', '') ?? 'Bilinmiyor',
      value: Math.round((p.totalValue ?? 0) * 100) / 100,
      pnlPercent: p.pnlPercent ?? 0,
    }));
    // Nakit kısmını da ekle
    if ((user?.balance ?? 0) > 0) {
      distribution.unshift({ name: 'Nakit', value: Math.round((user?.balance ?? 100000) * 100) / 100, pnlPercent: 0 });
    }

    return NextResponse.json({
      balance: user?.balance ?? 100000,
      initialBalance: user?.initialBalance ?? 100000,
      commissionRate: user?.commissionRate ?? 0.002,
      positions: enrichedPositions,
      closedPositions,
      totalInvested,
      totalPositionValue,
      unrealizedPnl,
      realizedPnl,
      winRate,
      totalTrades,
      equityCurve,
      distribution,
    });
  } catch (error: any) {
    console.error('Portfolio error:', error);
    return NextResponse.json({ error: 'Portföy verileri alınamadı' }, { status: 500 });
  }
}
