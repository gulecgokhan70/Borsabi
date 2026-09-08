export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signupSchema } from '@/lib/signup-validation';
import { signupClientKey, takeRequestSlot } from '@/lib/request-limit';

export async function POST(request: NextRequest) {
  try {
    const slot = takeRequestSlot(signupClientKey(request.headers), 5, 15 * 60 * 1000);
    if (!slot.allowed) {
      return NextResponse.json({ error: 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.' },
        { status: 429, headers: { 'Retry-After': String(slot.retryAfter) } });
    }
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
    }
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Bu email adresi zaten kayıtlı' }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, balance: 100000, initialBalance: 100000 },
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Bu email adresi zaten kayıtlı' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Kayıt sırasında bir hata oluştu' }, { status: 500 });
  }
}
