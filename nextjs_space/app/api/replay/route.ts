import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { cachedChart } from '@/lib/yahoo-finance';
import { normalizeMarketSymbol } from '@/lib/market-quotes';
import { tradableMarketType } from '@/lib/asset-display';
import { createReplay, applyReplay, replayAction, replayView, replayDate, type ReplayState } from '@/lib/replay';
import { takeRequestSlot } from '@/lib/request-limit';
import { z } from 'zod';
import { commissionRate } from '@/lib/commission';
export const dynamic = 'force-dynamic';
const response = (row: { id: string; version: number; state: unknown }, rate: number) => NextResponse.json({ id: row.id, version: row.version, ...replayView(row.state as ReplayState), commissionRate: rate }, { headers: { 'Cache-Control': 'no-store' } });
async function profileRate(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { commissionRate: true } });
  return commissionRate(user?.commissionRate);
}
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  const row = await prisma.replaySession.findFirst({ where: { userId: session.user.id, ...(id ? { id } : {}) }, orderBy: { createdAt: 'desc' } });
  const rate = await profileRate(session.user.id);
  return row ? response(row, rate) : NextResponse.json({ empty: true, commissionRate: rate }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!takeRequestSlot(`replay:${session.user.id}`, 10, 3600000).allowed) return NextResponse.json({ error: 'Bir saatte en fazla 10 yeni pratik açabilirsiniz.' }, { status: 429 });
  const parsed = z.object({ symbol: z.string().min(1).max(32).regex(/^[A-Za-z0-9.-]+$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Sembol ve geçmiş gün seçin.' }, { status: 400 });
  const symbol = normalizeMarketSymbol(parsed.data.symbol);
  if (!tradableMarketType(symbol)) return NextResponse.json({ error: 'BIST hissesi veya USD kripto sembolü seçin.' }, { status: 400 });
  const start = new Date(`${parsed.data.date}T00:00:00+03:00`), end = new Date(start.getTime() + 86400000);
  if (!Number.isFinite(start.getTime()) || replayDate(start.toISOString()) !== parsed.data.date || end.getTime() > Date.now() || Date.now() - start.getTime() > 30 * 86400000) return NextResponse.json({ error: 'Son 30 gün içinde tamamlanmış bir gün seçin.' }, { status: 400 });
  try {
    const rate = await profileRate(session.user.id);
    const chart: any = await cachedChart(symbol, { period1: start, period2: end, interval: '5m' });
    const expectedCurrency = symbol.endsWith('-USD') ? 'USD' : 'TRY';
    if (chart?.meta?.currency !== expectedCurrency) throw new Error('Geçmiş verinin para birimi doğrulanamadı.');
    const bars = (chart.quotes ?? []).filter((q: any) => new Date(q.date) >= start && new Date(q.date) < end)
      .map((q: any) => ({ time: new Date(q.date).toISOString(), open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume ?? 0 }));
    const state = createReplay(symbol, bars, new Date().toISOString(), rate);
    state.practiceDate = parsed.data.date;
    const row = await prisma.replaySession.create({ data: { userId: session.user.id, state: state as unknown as Prisma.InputJsonValue } }).catch(() => { throw new Error('Pratik kaydedilemedi. Lütfen tekrar deneyin.'); });
    return response(row, rate);
  } catch (error) { return NextResponse.json({ error: error instanceof Error && /^(Bu günde|Geçmiş fiyat|Geçmiş verinin|Pratik kaydedilemedi|Profil komisyon)/.test(error.message) ? error.message : 'Geçmiş veri alınamadı. Başka bir sembol veya gün deneyin.' }, { status: 503 }); }
}
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const parsed = replayAction.extend({ id: z.string().max(100), version: z.number().int().nonnegative() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz pratik işlemi.' }, { status: 400 });
  const row = await prisma.replaySession.findFirst({ where: { id: parsed.data.id, userId: session.user.id } });
  if (!row) return NextResponse.json({ error: 'Pratik bulunamadı.' }, { status: 404 });
  if (row.version !== parsed.data.version) return NextResponse.json({ error: 'Pratik güncellendi. Son durumu yükleyin.' }, { status: 409 });
  try {
    const rate = await profileRate(session.user.id);
    const state = applyReplay(row.state as unknown as ReplayState, parsed.data, rate);
    const updated = await prisma.replaySession.updateMany({ where: { id: row.id, userId: session.user.id, version: row.version }, data: { state: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
    if (!updated.count) return NextResponse.json({ error: 'İşlem zaten işlendi veya pratik değişti. Yenileyin.' }, { status: 409 });
    return response({ id: row.id, state, version: row.version + 1 }, rate);
  } catch (error) { return NextResponse.json({ error: error instanceof Error && /^(Bu pratik|Pratik|Geçerli miktar|Profil komisyon)/.test(error.message) ? error.message : 'İşlem yapılamadı. Son durumu yeniden yükleyin.' }, { status: 400 }); }
}
