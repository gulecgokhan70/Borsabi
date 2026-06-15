export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Fiyat alarmlarını kontrol et ve tetiklenenleri dön
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ triggered: [] });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ triggered: [] });

    // Aktif alarmları getir
    const activeAlerts = await prisma.priceAlert.findMany({
      where: { userId: user.id, active: true, triggered: false },
    });

    if (activeAlerts.length === 0) return NextResponse.json({ triggered: [] });

    // Fiyatları al
    const symbols = [...new Set(activeAlerts.map((a: any) => a.symbol))];
    let prices: Record<string, number> = {};

    try {
      const internalBase = `http://localhost:${process.env.PORT || 3000}`;
      const res = await fetch(`${internalBase}/api/market?symbols=${symbols.join(',')}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((d: any) => { if (d?.symbol && d?.price) prices[d.symbol] = d.price; });
      }
    } catch (e) {
      console.error('Alert price fetch error:', e);
      return NextResponse.json({ triggered: [] });
    }

    const triggered: any[] = [];

    for (const alert of activeAlerts) {
      const currentPrice = prices[alert.symbol];
      if (!currentPrice) continue;

      let shouldTrigger = false;
      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) shouldTrigger = true;
      if (alert.condition === 'below' && currentPrice <= alert.targetPrice) shouldTrigger = true;

      if (shouldTrigger) {
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { triggered: true, currentPrice, triggeredAt: new Date() },
        });
        triggered.push({ ...alert, currentPrice });
      } else {
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { currentPrice },
        });
      }
    }

    // İz süren stop (trailing stop) kontrolü
    const trailingAlerts: any[] = [];
    try {
      const allOpenPositions = await prisma.position.findMany({
        where: { userId: user.id, status: 'OPEN' },
      });
      const openPositions = allOpenPositions.filter((p: any) => p.trailingStopPercent != null);

      for (const pos of openPositions) {
        const p = pos as any;
        const cp = prices[p.symbol] || prices[p.symbol + '.IS'];
        if (!cp || !p.trailingStopPercent) continue;

        const tsp: number = p.trailingStopPercent;
        const tsh: number = p.trailingStopHighest ?? p.entryPrice;
        const highest = Math.max(cp, tsh);
        const trailingStopLevel = highest * (1 - tsp / 100);

        // Fiyat yükseldiyse en yüksek seviyeyi ve stop'u güncelle
        if (highest > tsh) {
          await prisma.position.update({
            where: { id: p.id },
            data: {
              trailingStopHighest: highest,
              stopLoss: +trailingStopLevel.toFixed(2),
              currentPrice: cp,
            } as any,
          });
        } else {
          await prisma.position.update({
            where: { id: p.id },
            data: { currentPrice: cp },
          });
        }

        // Fiyat trailing stop seviyesinin altına düştü mü?
        if (cp <= trailingStopLevel) {
          trailingAlerts.push({
            symbol: p.symbol,
            name: p.name,
            type: 'trailing_stop',
            message: `🚨 ${p.symbol} iz süren stop tetiklendi! Fiyat: ${cp.toFixed(2)} ≤ Stop: ${trailingStopLevel.toFixed(2)} (En yüksek: ${highest.toFixed(2)}, -%${tsp})`,
            currentPrice: cp,
            stopLevel: +trailingStopLevel.toFixed(2),
            highest,
          });
        }
      }
    } catch (e) {
      console.error('Trailing stop check error:', e);
    }

    return NextResponse.json({ triggered, trailingAlerts });
  } catch (error: any) {
    console.error('Alert check error:', error);
    return NextResponse.json({ triggered: [] });
  }
}
