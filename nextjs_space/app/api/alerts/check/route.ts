export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getMarketQuotes, normalizeMarketSymbol } from '@/lib/market-quotes';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const userId = session.user.id;
    const [activeAlerts, positions] = await Promise.all([
      prisma.priceAlert.findMany({ where: { userId, active: true, triggered: false } }),
      prisma.position.findMany({ where: { userId, status: 'OPEN', trailingStopPercent: { not: null } } }),
    ]);
    const symbols = [...new Set([...activeAlerts, ...positions].map(item => normalizeMarketSymbol(item.symbol)))];
    if (!symbols.length) return NextResponse.json({ triggered: [], trailingAlerts: [] });
    const quotes = await getMarketQuotes(symbols);
    const prices = new Map(quotes.filter(q => !q.error && Number.isFinite(q.price) && q.price > 0).map(q => [q.symbol, q.price]));
    const triggered = [];
    for (const alert of activeAlerts) {
      const currentPrice = prices.get(normalizeMarketSymbol(alert.symbol));
      if (currentPrice === undefined) continue;
      const crossed = (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);
      const triggeredAt = new Date();
      // Only one concurrent poll may claim and notify this alert.
      const result = await prisma.priceAlert.updateMany({
        where: { id: alert.id, userId, active: true, triggered: false },
        data: crossed ? { currentPrice, triggered: true, active: false, triggeredAt } : { currentPrice },
      });
      if (crossed && result.count === 1) triggered.push({ ...alert, currentPrice, triggered: true, active: false, triggeredAt });
    }
    const trailingAlerts = [];
    for (const pos of positions) {
      const currentPrice = prices.get(normalizeMarketSymbol(pos.symbol));
      const percent = pos.trailingStopPercent;
      if (currentPrice === undefined || !percent || percent <= 0 || percent > 100) continue;
      const previousHigh = pos.trailingStopHighest ?? pos.entryPrice;
      const highest = Math.max(currentPrice, previousHigh);
      const stopLevel = highest * (1 - percent / 100);
      const previousStopLevel = previousHigh * (1 - percent / 100);
      const result = await prisma.position.updateMany({
        where: { id: pos.id, userId, status: 'OPEN', updatedAt: pos.updatedAt },
        data: { currentPrice, trailingStopHighest: highest, stopLoss: stopLevel },
      });
      // Notify on crossing, rather than repeatedly while price stays below the stop.
      if (result.count === 1 && currentPrice <= stopLevel && pos.currentPrice > previousStopLevel) {
        trailingAlerts.push({
          symbol: pos.symbol, name: pos.name, type: 'trailing_stop', currentPrice, stopLevel, highest,
          message: `🚨 ${pos.symbol} iz süren stop tetiklendi! Fiyat: ${currentPrice.toFixed(2)} ≤ Stop: ${stopLevel.toFixed(2)} (En yüksek: ${highest.toFixed(2)}, -%${percent})`,
        });
      }
    }
    return NextResponse.json({ triggered, trailingAlerts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Alert check error:', error);
    return NextResponse.json({ error: 'Alarmlar kontrol edilemedi' }, { status: 503 });
  }
}
