import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ReportsClient } from './reports-client';
export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (user?.role !== 'admin') redirect('/profile');
  return <ReportsClient />;
}
