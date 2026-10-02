import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { activityAsset } from '@/lib/asset-activity';
import { takeRequestSlot } from '@/lib/request-limit';
import { marketDecision } from '@/lib/trading-engine/service';
import type { Timeframe } from '@/lib/trading-engine/types';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status,
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return reply({ error: 'Analiz için giriş yapın.' }, 401);
    const url = new URL(request.url), asset = activityAsset(url.searchParams.get('symbol') ?? '');
    const timeframe = url.searchParams.get('timeframe') ?? '1d';
    if (!asset || !['1d', '1h', '15m'].includes(timeframe)) return reply({ error: 'Varlık veya zaman aralığı geçersiz.' }, 400);
    const slot = takeRequestSlot('engine:' + session.user.id, 12, 60000);
    if (!slot.allowed) return reply({ error: 'Çok sık analiz istendi. Bir dakika sonra deneyin.' }, 429);
    const decision = await marketDecision(asset.symbol, asset.market, timeframe as Timeframe);
    return reply({ ...decision, symbol: asset.symbol, currency: asset.market === 'CRYPTO' ? 'USD' : 'TRY',
      disclaimer: 'Eğitim amaçlıdır; yatırım tavsiyesi değildir. Güven puanı kazanma olasılığı değildir.' });
  } catch { return reply({ error: 'Piyasa verisi alınamadı. Daha sonra tekrar deneyin.' }, 503); }
}
