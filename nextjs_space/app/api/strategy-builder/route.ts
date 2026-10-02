import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { activityAsset } from '@/lib/asset-activity';
import { commissionRate } from '@/lib/commission';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { takeRequestSlot } from '@/lib/request-limit';
import { engineHistory, cryptoContextAt } from '@/lib/trading-engine/service';
import { defaultCosts } from '@/lib/trading-engine/config';
import { runEngineBacktest } from '@/lib/trading-engine/backtest-engine';
import { customRuleSignal, ruleSchema } from '@/lib/trading-engine/custom-rules';
import type { Timeframe } from '@/lib/trading-engine/types';
export const dynamic = 'force-dynamic';
const periods = ['1d', '1w', '15d', '1m', '3m', '6m', '1y', '2y', '3y'] as const;
const schema = z.object({ name: z.string().trim().min(1).max(100).default('Benim Stratejim'),
  symbol: z.string().min(1).max(30), period: z.enum(periods).default('1y'),
  initialCapital: z.number().finite().min(100).max(1e8).default(100000),
  stopLoss: z.number().finite().min(0.1).max(50).default(5), takeProfit: z.number().finite().min(0.1).max(50).default(10),
  rules: z.array(ruleSchema).min(1).max(20) }).strict()
  .refine(v => v.rules.some(r => r.direction === 'buy'), 'En az bir alış kuralı gerekli.')
  .refine(v => v.takeProfit / v.stopLoss >= 1.5, 'Hedef/stop oranı en az 1.5 olmalı.')
  .refine(v => new Set(v.rules.map(r => r.id)).size === v.rules.length, 'Kural numaraları benzersiz olmalı.');
const days = { '1d': 1, '1w': 7, '15d': 15, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730, '3y': 1095 };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status,
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return reply({ error: 'Oturum gerekli.' }, 401);
    const parsed = schema.safeParse(await readMutationJson(request));
    if (!parsed.success) return reply({ error: 'Strateji girdileri geçersiz. En az bir alış kuralı ve hedef/stop oranı en az 1.5 olmalı.' }, 400);
    const input = parsed.data, asset = activityAsset(input.symbol);
    if (!asset) return reply({ error: 'Varlık bulunamadı.' }, 400);
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { tier: true, commissionRate: true } });
    if (!user) return reply({ error: 'Kullanıcı bulunamadı.' }, 404);
    if (!['pro', 'elite'].includes(user.tier)) return reply({ error: 'Strateji oluşturucu için Pro üyelik gerekir.' }, 403);
    if (!takeRequestSlot('strategy-builder:' + session.user.id, 3, 60000).allowed) return reply({ error: 'Bir dakika sonra yeniden deneyin.' }, 429);
    const commission = commissionRate(user.commissionRate);
    const timeframe: Timeframe = ['1d', '1w', '15d'].includes(input.period) ? '15m' : input.period === '1m' ? '1h' : '1d';
    const asOf = Date.now(), tradeStart = asOf - days[input.period] * 86400000;
    const candles = (await engineHistory(asset.symbol, asset.market, timeframe, asOf)).slice(-1200);
    if (candles.length < 201) return reply({ error: 'En az 201 geçerli kapanmış mum gerekir. Daha uzun veri geçmişi olan bir varlık seçin.' }, 422);
    let contextAt;
    if (asset.market === 'CRYPTO') {
      const [btc, eth] = await Promise.all([
        asset.symbol === 'BTC-USD' ? Promise.resolve(candles) : engineHistory('BTC-USD', asset.market, timeframe, asOf),
        asset.symbol === 'ETH-USD' ? Promise.resolve(candles) : engineHistory('ETH-USD', asset.market, timeframe, asOf),
      ]);
      contextAt = (time: number) => cryptoContextAt(candles, btc, eth, timeframe, time);
    }
    const result = runEngineBacktest({ candles, market: asset.market, timeframe, initialCapital: input.initialCapital,
      tradeStart, tradeEnd: asOf, costs: defaultCosts(asset.market, commission), contextAt,
      stopPercent: input.stopLoss / 100, takeProfitPercent: input.takeProfit / 100,
      customSignal: (past, decision) => customRuleSignal(input.rules, past, decision) });
    if (!result.timeline.length) return reply({ error: 'Seçilen dönemde 200 mumluk hazırlık sonrası test edilebilir kapanmış seans yok.' }, 422);
    const firstTest = result.timeline[0].time, lastTest = result.timeline[result.timeline.length - 1].time;
    const warnings = ['Özel alış kuralları V2 sinyalini ek olarak filtreler; BTC/ETH bağlamı ve risk sınırları geçerlidir. Satış kuralları short açmaz.',
      'Sinyal kapanmış mumdan alınır, işlem sonraki açılışta gerçekleşir. Komisyon profilinizden alınır.',
      'Başlangıç sermayesi ve sonuçlar varlığın para birimindedir; geçmiş USD/TRY dönüşümü uygulanmaz. Yatırım tavsiyesi değildir.'];
    if (candles[200].timestamp > tradeStart) warnings.push('Veri geçmişi/hazırlık süresi nedeniyle istenen dönemin başlangıcı kısaltıldı. Gerçek test tarihlerini kontrol edin.');
    return reply({ name: input.name, symbol: asset.symbol, period: input.period, timeframe, engine: 'v2',
      currency: result.currency, commissionRate: commission, summary: result.summary,
      equity: result.equity.filter((_, n) => n % Math.max(1, Math.ceil(result.equity.length / 300)) === 0 || n === result.equity.length - 1),
      trades: result.trades.slice(-100).map(t => ({ ...t, reason: t.exitReason, date: new Date(t.exitTime).toISOString().slice(0, 10) })),
      assumptions: result.assumptions, warnings, requestedStart: tradeStart, firstTest, lastTest });
  } catch (error) {
    if (error instanceof RequestError) return reply({ error: error.message }, error.status);
    if (error instanceof RangeError) return reply({ error: error.message }, 422);
    return reply({ error: 'Strateji testi tamamlanamadı. Veri sağlayıcısını veya profil komisyonunu kontrol edin.' }, 503);
  }
}
