import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialState, State } from '@/lib/bot-lab/engine';
import { createBot, createAutoBot, controlBot } from '@/lib/bot-lab/validation';
import { autoInitial, AutoState, controlAuto } from '@/lib/bot-lab/auto-engine';
import { readMutationJson, RequestError } from '@/lib/request-json';
export const dynamic = 'force-dynamic';
async function user() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ? prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, commissionRate: true } }) : null;
}
const fail = () => NextResponse.json({ error: 'Bot işlemi tamamlanamadı. Lütfen tekrar deneyin.' }, { status: 503 });
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function GET() {
  try {
    const u = await user(); if (!u) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    const [bots, heartbeat] = await Promise.all([
      prisma.paperBot.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' }, include: { events: { orderBy: { createdAt: 'desc' }, take: 50 } } }),
      prisma.scanCache.findUnique({ where: { id: 'bot-lab-worker' } }),
    ]);
    return NextResponse.json({ bots, commission: u.commissionRate, workerOnline: !!heartbeat && Date.now() - heartbeat.updatedAt.getTime() < 180000 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return fail(); }
}
export async function POST(req: NextRequest) {
  try {
    const u = await user(); if (!u) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    const input = await readMutationJson(req) as { mode?: string } | null;
    const schema = input?.mode === 'auto-v2' ? createAutoBot : createBot;
    const parsed = schema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'Sembol veya risk ayarları geçersiz.' }, { status: 400 });
    const config = parsed.data;
    if (config.market === 'BIST') config.commission = u.commissionRate;
    if (!schema.safeParse(config).success) return NextResponse.json({ error: 'Profil komisyonunu kontrol edin.' }, { status: 400 });
    const bot = await prisma.paperBot.create({ data: { userId: u.id, market: config.market, symbol: 'mode' in config ? 'AUTO' : config.symbol, config: json(config), state: json('mode' in config ? autoInitial() : initialState()) } });
    return NextResponse.json({ id: bot.id }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Her piyasa için bir bot oluşturabilirsiniz.' }, { status: 409 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
    return fail();
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const u = await user(); if (!u) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    const parsed = controlBot.safeParse(await readMutationJson(req));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz komut.' }, { status: 400 });
    const { id, action } = parsed.data;
    const bot = await prisma.paperBot.findFirst({ where: { id, userId: u.id } });
    if (!bot) return NextResponse.json({ error: 'Bot bulunamadı.' }, { status: 404 });
    const auto = (bot.config as { mode?: string }).mode === 'auto-v2';
    if (!auto && action === 'close') return NextResponse.json({ error: 'Eski bot sürümü toplu kapatma desteklemiyor.' }, { status: 400 });
    if (auto && action === 'start' && (bot.state as unknown as AutoState).closeRequested) return NextResponse.json({ error: 'Kapatma tamamlanana kadar bekleyin.' }, { status: 409 });
    const state = auto ? controlAuto(bot.state as unknown as AutoState, action) : { ...(bot.state as unknown as State), pending: null, lastBar: 0 };
    const changed = await prisma.$transaction(async tx => {
      const result = await tx.paperBot.updateMany({ where: { id, userId: u.id, version: bot.version }, data: {
        running: auto ? true : action === 'start', state: json(state), version: { increment: 1 },
        message: action === 'start' ? 'Başlatıldı; sunucu kontrolü bekleniyor.' : action === 'close' ? 'Sanal pozisyon kapatma istendi; geçerli fiyat bekleniyor.' : auto ? 'Yeni alımlar duraklatıldı; çıkış kontrolleri devam ediyor.' : 'Durduruldu. Açık pozisyon korunuyor.',
      } });
      if (result.count) await tx.paperBotEvent.create({ data: { botId: id, data: json({ time: Date.now(), action: 'WAIT', reason: action === 'start' ? 'Kullanıcı botu başlattı.' : action === 'close' ? 'Kullanıcı tüm sanal pozisyonları kapatma talebi verdi.' : 'Kullanıcı yeni alımları duraklattı.' }) } });
      return result.count;
    });
    return changed ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Bot güncellendi; komutu tekrar deneyin.' }, { status: 409 });
  } catch (error) { if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status }); return error instanceof SyntaxError ? NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) : fail(); }
}
