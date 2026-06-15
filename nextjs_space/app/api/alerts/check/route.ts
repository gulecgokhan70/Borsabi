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
        // Güncel fiyatı kaydet
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { currentPrice },
        });
      }
    }

    return NextResponse.json({ triggered });
  } catch (error: any) {
    console.error('Alert check error:', error);
    return NextResponse.json({ triggered: [] });
  }
}
