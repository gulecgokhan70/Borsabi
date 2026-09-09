import { valuePositions } from '@/lib/position-valuation';
import { CurrencyError } from '@/lib/currency';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { MAX_RISK_PER_TRADE, DAILY_LOSS_LIMIT } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        positions: { where: { status: 'OPEN' } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    const balance = user.balance;
    const initialBalance = user.initialBalance;
    const rawPositions = user.positions ?? [];
    const transactions = user.transactions ?? [];

    const openPositions = await valuePositions(rawPositions);

    // Toplam portföy değeri
    const totalPositionValue = openPositions.reduce((sum: number, p: any) => sum + p.totalValue, 0);
    const portfolioValue = balance + totalPositionValue;

    // Toplam kâr/zarar
    const totalPnL = portfolioValue - initialBalance;
    const totalPnLPercent = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;

    // Açık pozisyon riski
    const positionRisks = openPositions.map((p: any) => {
      const positionValue = p.totalValue;
      const entryValue = p.totalCost;
      const unrealizedPnL = positionValue - entryValue;
      const unrealizedPnLPercent = entryValue > 0 ? (unrealizedPnL / entryValue) * 100 : 0;
      const portfolioWeight = portfolioValue > 0 ? (positionValue / portfolioValue) * 100 : 0;

      // Stop loss riski
      const stopLossRisk = p.stopLoss
        ? ((p.currentPrice - p.stopLoss) / p.currentPrice) * 100
        : null;

      // Risk seviyesi
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (portfolioWeight > 25) riskLevel = 'critical';
      else if (portfolioWeight > 15) riskLevel = 'high';
      else if (portfolioWeight > 10) riskLevel = 'medium';

      if (unrealizedPnLPercent < -5) riskLevel = 'critical';
      else if (unrealizedPnLPercent < -3) riskLevel = riskLevel === 'low' ? 'high' : riskLevel;

      return {
        id: p.id,
        currency: p.currency,
        symbol: p.symbol,
        name: p.name,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        positionValue,
        unrealizedPnL,
        unrealizedPnLPercent: Math.round(unrealizedPnLPercent * 100) / 100,
        portfolioWeight: Math.round(portfolioWeight * 100) / 100,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        stopLossRisk: stopLossRisk ? Math.round(stopLossRisk * 100) / 100 : null,
        riskLevel,
        hasStopLoss: !!p.stopLoss,
      };
    });

    // İstanbul zamanı (UTC+3)
    const IST_OFFSET = 3 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET);
    const todayIST = new Date(nowIST);
    todayIST.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(todayIST.getTime() - IST_OFFSET); // UTC'ye çevir

    const weekIST = new Date(nowIST);
    weekIST.setUTCDate(weekIST.getUTCDate() - 7);
    weekIST.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(weekIST.getTime() - IST_OFFSET);

    // Gerçekleşmiş K/Z (satış işlemlerinden)
    const todayTx = transactions.filter((t: any) => new Date(t.createdAt) >= todayStart);
    const todayRealizedPnL = todayTx.reduce((sum: number, t: any) => sum + (t.pnl ?? 0), 0);

    const weekTx = transactions.filter((t: any) => new Date(t.createdAt) >= weekStart);
    const weekRealizedPnL = weekTx.reduce((sum: number, t: any) => sum + (t.pnl ?? 0), 0);

    // Gerçekleşmemiş K/Z (açık pozisyonlardan)
    const totalUnrealizedPnL = openPositions.reduce((sum: number, p: any) => {
      return sum + p.pnl;
    }, 0);

    // Günlük/Haftalık K/Z = gerçekleşmiş + gerçekleşmemiş
    const todayPnL = todayRealizedPnL + totalUnrealizedPnL;
    const todayPnLPercent = initialBalance > 0 ? (todayPnL / initialBalance) * 100 : 0;

    const weekPnL = weekRealizedPnL + totalUnrealizedPnL;
    const weekPnLPercent = initialBalance > 0 ? (weekPnL / initialBalance) * 100 : 0;

    // Uyarılar
    const warnings: Array<{ type: 'info' | 'warning' | 'danger'; message: string }> = [];

    // Günlük zarar kontrolü
    if (todayPnLPercent < -DAILY_LOSS_LIMIT * 100) {
      warnings.push({ type: 'danger', message: `Günlük zarar limiti aşıldı! (${todayPnLPercent.toFixed(2)}% - Limit: %${(DAILY_LOSS_LIMIT * 100).toFixed(0)})` });
    } else if (todayPnLPercent < -(DAILY_LOSS_LIMIT * 100 * 0.7)) {
      warnings.push({ type: 'warning', message: `Günlük zarar limitine yaklaşıyorsunuz (${todayPnLPercent.toFixed(2)}%)` });
    }

    // Haftalık zarar
    if (weekPnLPercent < -6) {
      warnings.push({ type: 'danger', message: `Haftalık zarar limiti aşıldı! (${weekPnLPercent.toFixed(2)}% - Limit: %6)` });
    } else if (weekPnLPercent < -4) {
      warnings.push({ type: 'warning', message: `Haftalık zarar limitine yaklaşıyorsunuz (${weekPnLPercent.toFixed(2)}%)` });
    }

    // Stop loss kontrolü
    const noStopPositions = openPositions.filter((p: any) => !p.stopLoss);
    if (noStopPositions.length > 0) {
      warnings.push({ type: 'danger', message: `${noStopPositions.length} pozisyonda Stop Loss yok! Risk korumanız eksik.` });
    }

    // Konsantrasyon riski
    const sectorConcentration = positionRisks.filter((p: any) => p.portfolioWeight > 20);
    if (sectorConcentration.length > 0) {
      warnings.push({ type: 'warning', message: `${sectorConcentration.map((p: any) => p.symbol).join(', ')} pozisyonları portföyün %20'sinden fazla.` });
    }

    // Toplam risk oranı
    const totalExposure = portfolioValue > 0 ? (totalPositionValue / portfolioValue) * 100 : 0;
    if (totalExposure > 80) {
      warnings.push({ type: 'warning', message: `Portföy maruziyeti çok yüksek (%${totalExposure.toFixed(0)}). Nakit oranını artırın.` });
    }

    // Pozisyon sayısı
    if (openPositions.length > 8) {
      warnings.push({ type: 'info', message: `Çok fazla açık pozisyon (${openPositions.length}). Odaklanmak için azaltmayı düşünün.` });
    }

    // Kazanan / kaybeden işlem istatistikleri
    const closedTrades = transactions.filter((t: any) => t.type === 'SELL' && t.pnl !== null);
    const winningTrades = closedTrades.filter((t: any) => (t.pnl ?? 0) > 0);
    const losingTrades = closedTrades.filter((t: any) => (t.pnl ?? 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) / losingTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Risk skoru (0-100)
    // Portföy boşsa ve işlem yoksa risk skoru 0
    const hasActivity = openPositions.length > 0 || closedTrades.length > 0;
    let riskScore = hasActivity ? 20 : 0;
    if (hasActivity) {
      if (noStopPositions.length > 0) riskScore += 20;
      if (totalExposure > 80) riskScore += 15;
      if (todayPnLPercent < -2) riskScore += 15;
      if (sectorConcentration.length > 0) riskScore += 10;
      if (openPositions.length > 8) riskScore += 10;
      if (winRate < 40 && closedTrades.length > 5) riskScore += 10;
    }
    riskScore = Math.min(100, riskScore);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 80) riskLevel = 'critical';
    else if (riskScore >= 65) riskLevel = 'high';
    else if (riskScore >= 50) riskLevel = 'medium';

    return NextResponse.json({
      summary: {
        portfolioValue: Math.round(portfolioValue * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        totalPositionValue: Math.round(totalPositionValue * 100) / 100,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
        todayPnL: Math.round(todayPnL * 100) / 100,
        todayPnLPercent: Math.round(todayPnLPercent * 100) / 100,
        weekPnL: Math.round(weekPnL * 100) / 100,
        weekPnLPercent: Math.round(weekPnLPercent * 100) / 100,
        openPositionCount: openPositions.length,
        totalExposure: Math.round(totalExposure * 100) / 100,
        cashRatio: Math.round((100 - totalExposure) * 100) / 100,
        riskScore,
        riskLevel,
      },
      stats: {
        totalTrades: closedTrades.length,
        winRate: Math.round(winRate * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        maxRiskPerTrade: MAX_RISK_PER_TRADE * 100,
        dailyLossLimit: DAILY_LOSS_LIMIT * 100,
      },
      positions: positionRisks,
      warnings,
    });
  } catch (error: any) {
    if (error instanceof CurrencyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Risk center error:', error);
    return NextResponse.json({ error: 'Risk merkezi yüklenemedi' }, { status: 500 });
  }
}
