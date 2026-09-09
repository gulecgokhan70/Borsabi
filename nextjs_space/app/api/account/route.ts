import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteOwnAccount } from '@/lib/account-deletion';
import { readMutationJson, RequestError } from '@/lib/request-json';
import { takeRequestSlot } from '@/lib/request-limit';
export const dynamic = 'force-dynamic';
const deletion = z.object({ password: z.string().min(1).max(256), confirmation: z.literal('HESABIMI SİL') }).strict();

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Yeniden giriş yapın.' }, { status: 401 });
    const slot = takeRequestSlot(`delete-account:${userId}`, 5, 15 * 60_000);
    if (!slot.allowed) return NextResponse.json({ error: 'Çok fazla deneme. Daha sonra tekrar deneyin.' }, { status: 429, headers: { 'Retry-After': String(slot.retryAfter) } });
    const parsed = deletion.safeParse(await readMutationJson(request, 4096));
    if (!parsed.success) return NextResponse.json({ error: 'Şifrenizi girip hesap silmeyi onaylayın.' }, { status: 400 });
    await deleteOwnAccount(prisma, userId, parsed.data.password);
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Hesabınız silinemedi. Daha sonra tekrar deneyin.' }, { status: 500 });
  }
}
