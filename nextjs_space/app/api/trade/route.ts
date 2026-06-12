export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { MAX_RISK_PER_TRADE, DAILY_LOSS_LIMIT } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const userId = (session.user as any).id;

    const body = await request.json();
    const { symbol, name, type, marketType, quantity, price, stopLoss, takeProfit, note } = body ?? {};

    if (!symbol || !type || !quantity || !price) {
      return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

    const userCommRate = user.commissionRate ?? 0.002;
    const total = quantity * price;
    const commission = total * userCommRate;
    const totalWithCommission = total + commission;

    // Risk warnings
    const warnings: string[] = [];
    const riskAmount = stopLoss ? Math.abs(price - stopLoss) * quantity : total * MAX_RISK_PER_TRADE;
    const riskPercent = riskAmount / (user?.balance ?? 100000);
    if (riskPercent > MAX_RISK_PER_TRADE) {
      warnings.push(`⚠️ İşlem başına risk %${(riskPercent * 100).toFixed(1)} - Maksimum %1 önerilir`);
    }

    // Daily loss check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = await prisma.transaction.findMany({
      where: { userId, createdAt: { gte: today } },
    });
    const dailyLoss = todayTransactions.reduce((sum: number, t: any) => sum + Math.min(t?.pnl ?? 0, 0), 0);
    const dailyLossPercent = Math.abs(dailyLoss) / (user?.initialBalance ?? 100000);
    if (dailyLossPercent > DAILY_LOSS_LIMIT) {
      warnings.push(`⚠️ Günlük zarar limiti aşıldı (%${(dailyLossPercent * 100).toFixed(1)})`);
    }

    if (type === 'BUY') {
      if (totalWithCommission > (user?.balance ?? 0)) {
        return NextResponse.json({ error: `Yetersiz bakiye. Gerekli: ${totalWithCommission.toFixed(2)} TL, Mevcut: ${(user?.balance ?? 0).toFixed(2)} TL` }, { status: 400 });
      }

      // Check for existing position
      const existingPosition = await prisma.position.findFirst({ where: { userId, symbol, status: 'OPEN' } });

      if (existingPosition) {
        // Average down/up
        const newQty = (existingPosition?.quantity ?? 0) + quantity;
        const newAvgPrice = (((existingPosition?.quantity ?? 0) * (existingPosition?.entryPrice ?? 0)) + (quantity * price)) / newQty;
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            quantity: newQty,
            entryPrice: newAvgPrice,
            currentPrice: price,
            stopLoss: stopLoss ?? existingPosition?.stopLoss,
            takeProfit: takeProfit ?? existingPosition?.takeProfit,
            commission: (existingPosition?.commission ?? 0) + commission,
          },
        });
      } else {
        await prisma.position.create({
          data: {
            userId, symbol, name: name ?? symbol, type: marketType ?? 'BIST', quantity, entryPrice: price,
            currentPrice: price, stopLoss: stopLoss ?? null, takeProfit: takeProfit ?? null, commission, status: 'OPEN',
          },
        });
      }

      await prisma.user.update({ where: { id: userId }, data: { balance: { decrement: totalWithCommission } } });
      await prisma.transaction.create({
        data: {
          userId, symbol, name: name ?? symbol, type: 'BUY', marketType: marketType ?? 'BIST',
          quantity, price, total, commission, stopLoss: stopLoss ?? null, takeProfit: takeProfit ?? null, note: note ?? null,
        },
      });

      return NextResponse.json({ success: true, message: `${quantity} adet ${symbol} alındı`, warnings });
    }

    if (type === 'SELL') {
      const position = await prisma.position.findFirst({ where: { userId, symbol, status: 'OPEN' } });
      if (!position) return NextResponse.json({ error: 'Açık pozisyon bulunamadı' }, { status: 400 });
      if (quantity > (position?.quantity ?? 0)) return NextResponse.json({ error: 'Yetersiz miktar' }, { status: 400 });

      const sellTotal = quantity * price;
      const sellCommission = sellTotal * userCommRate;
      const costBasis = quantity * (position?.entryPrice ?? 0);
      const pnl = sellTotal - costBasis - commission - sellCommission;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      const remainingQty = (position?.quantity ?? 0) - quantity;

      if (remainingQty <= 0.0001) {
        await prisma.position.update({
          where: { id: position.id },
          data: { status: 'CLOSED', currentPrice: price, pnl, pnlPercent, closedAt: new Date(), quantity: 0 },
        });
      } else {
        await prisma.position.update({
          where: { id: position.id },
          data: { quantity: remainingQty, currentPrice: price },
        });
      }

      await prisma.user.update({ where: { id: userId }, data: { balance: { increment: sellTotal - sellCommission } } });
      await prisma.transaction.create({
        data: {
          userId, symbol, name: name ?? symbol, type: 'SELL', marketType: marketType ?? 'BIST',
          quantity, price, total: sellTotal, commission: sellCommission, pnl, pnlPercent, note: note ?? null,
        },
      });

      return NextResponse.json({ success: true, message: `${quantity} adet ${symbol} satıldı. K/Z: ${pnl.toFixed(2)} TL`, warnings, pnl });
    }

    return NextResponse.json({ error: 'Geçersiz işlem türü' }, { status: 400 });
  } catch (error: any) {
    console.error('Trade error:', error);
    return NextResponse.json({ error: 'İşlem sırasında hata oluştu' }, { status: 500 });
  }
}
