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
import { walkForward } from '@/lib/trading-engine/walk-forward';
export const dynamic = 'force-dynamic';
const schema = z.object({ symbol: z.string().min(1).max(30), timeframe: z.enum(['1d', '1h', '15m']).default('1d'),
  initialCapital: z.number().finite().min(100).max(100000000), walkForward: z.boolean().default(false) }).strict();
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status,
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return reply({ error: 'Oturum gerekli.' }, 401);
    const parsed = schema.safeParse(await readMutationJson(request));
    if (!parsed.success) return reply({ error: 'Backtest girdileri geçersiz.' }, 400);
    const input = parsed.data, asset = activityAsset(input.symbol);
    if (!asset) return reply({ error: 'Varlık bulunamadı.' }, 400);
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { tier: true, commissionRate: true } });
    if (!user) return reply({ error: 'Kullanıcı bulunamadı.' }, 404);
    if (!['pro', 'elite'].includes(user.tier)) return reply({ error: 'V2 gelişmiş backtest için Pro üyelik gerekir.' }, 403);
    const slot = takeRequestSlot('engine-backtest:' + session.user.id, 3, 60000);
    if (!slot.allowed) return reply({ error: 'Bir dakika sonra yeniden deneyin.' }, 429);
    const commission = commissionRate(user.commissionRate), asOf = Date.now();
    const candles = (await engineHistory(asset.symbol, asset.market, input.timeframe, asOf)).slice(-1200);
    if (candles.length < (input.walkForward ? 360 : 220)) return reply({ error: 'Seçilen zaman aralığında yeterli kapanmış mum yok.' }, 422);
    let contextAt;
    if (asset.market === 'CRYPTO') {
      const [btc, eth] = await Promise.all([
        asset.symbol === 'BTC-USD' ? Promise.resolve(candles) : engineHistory('BTC-USD', asset.market, input.timeframe, asOf),
        asset.symbol === 'ETH-USD' ? Promise.resolve(candles) : engineHistory('ETH-USD', asset.market, input.timeframe, asOf),
      ]);
      contextAt = (time: number) => cryptoContextAt(candles, btc, eth, input.timeframe, time);
    }
    const options = { candles, market: asset.market, timeframe: input.timeframe, initialCapital: input.initialCapital,
      costs: defaultCosts(asset.market, commission), contextAt };
    const currency = asset.market === 'CRYPTO' ? 'USD' : 'TRY';
    if (input.walkForward) {
      const result = walkForward(options);
      return reply({ mode: 'walk-forward', currency, commissionRate: commission, ...result,
        windows: result.windows.map(w => ({ ...w, test: { summary: w.test.summary, assumptions: w.test.assumptions } })) });
    }
    const result = runEngineBacktest(options);
    return reply({ mode: 'backtest', commissionRate: commission, ...result,
      trades: result.trades.slice(-100), timeline: result.timeline.filter((_, n) => n % Math.max(1, Math.ceil(result.timeline.length / 200)) === 0 || n === result.timeline.length - 1),
      capitalNote: `Başlangıç sermayesi ve sonuçlar ${currency}; geçmiş USD/TRY dönüşümü uygulanmaz. Gerçek portföy bakiyesi değişmez.` });
  } catch (error) {
    if (error instanceof RequestError) return reply({ error: error.message }, error.status);
    if (error instanceof RangeError) return reply({ error: error.message }, 422);
    return reply({ error: 'Backtest tamamlanamadı. Veri sağlayıcısını veya profil komisyonunu kontrol edin.' }, 503);
  }
}
