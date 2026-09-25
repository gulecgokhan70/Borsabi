import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { budgetInput, budgetView, configureBudget, BudgetError } from '@/lib/bot-lab/shared-portfolio';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  try { return NextResponse.json(await budgetView(prisma, session.user.id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Ortak bütçe alınamadı.' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  try {
    const parsed = budgetInput.safeParse(await readMutationJson(req));
    if (!parsed.success) return NextResponse.json({ error: 'Sermaye 1.000–10.000.000 TL, yüzdeler 1–100 aralığında olmalı.' }, { status: 400 });
    return NextResponse.json(await configureBudget(prisma, session.user.id, parsed.data));
  } catch (e) {
    if (e instanceof BudgetError || e instanceof RequestError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Bütçe kaydedilemedi; sayfayı yenileyin.' }, { status: 503 });
  }
}
