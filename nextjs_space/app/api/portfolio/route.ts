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

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, initialBalance: true } });
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
        const totalCost = p.entryPrice * p.quantity;
        const pnl = totalValue - totalCost - (p.commission ?? 0);
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

    return NextResponse.json({
      balance: user?.balance ?? 100000,
      initialBalance: user?.initialBalance ?? 100000,
      positions: enrichedPositions,
      closedPositions,
      totalInvested,
      totalPositionValue,
      unrealizedPnl,
      realizedPnl,
      winRate,
      totalTrades,
    });
  } catch (error: any) {
    console.error('Portfolio error:', error);
    return NextResponse.json({ error: 'Portföy verileri alınamadı' }, { status: 500 });
  }
}
