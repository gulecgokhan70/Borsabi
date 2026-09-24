import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cachedChart } from '@/lib/yahoo-finance';
import { Config } from '@/lib/bot-lab/engine';
import { replay } from '@/lib/bot-lab/replay';
import { readMutationJson, RequestError } from '@/lib/request-json';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    const body = await readMutationJson(req) as { id?: unknown } | null;
    if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Bot seçin.' }, { status: 400 });
    const bot = await prisma.paperBot.findFirst({ where: { id: body.id, user: { email: session.user.email } } });
    if (!bot) return NextResponse.json({ error: 'Bot bulunamadı.' }, { status: 404 });
    if ((bot.config as { mode?: string }).mode === 'auto-v2') return NextResponse.json({ error: 'Çoklu varlık botu ileriye dönük sanal testtedir; eski tek varlık testi bu stratejiye uygulanmaz.' }, { status: 422 });
    const config = bot.config as unknown as Config;
    const opts = { period1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), interval: '1h' };
    const [chart, fx] = await Promise.all([cachedChart(config.symbol, opts), config.market === 'CRYPTO' ? cachedChart('USDTRY=X', opts) : Promise.resolve(null)]);
    const bars = (chart?.quotes || []).map((q: { date: Date; close: number; open: number }) => ({ time: new Date(q.date).getTime(), close: q.close, open: q.open }))
      .filter((b: { time: number; close: number; open: number }) => Number.isFinite(b.time) && b.open > 0 && b.close > 0 && b.time + 3600000 <= Date.now());
    if (bars.length < 22) return NextResponse.json({ error: 'Yeterli saatlik veri yok.' }, { status: 422 });
    // FX CLOSE prices belong to the end of each hourly bar, never its beginning.
    const rates = (fx?.quotes || []).map((q: { date: Date; close: number }) => ({ time: new Date(q.date).getTime() + 3600000, close: q.close })).filter((b: { close: number }) => Number.isFinite(b.close) && b.close > 0);
    const result = replay(config, bars, rates);
    if (!result.equity.length) return NextResponse.json({ error: 'Eşleşen fiyat/kur verisi bulunamadı.' }, { status: 422 });
    return NextResponse.json(result);
  } catch (error) { if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: 'Geçmiş veri testi tamamlanamadı.' }, { status: 503 }); }
}
