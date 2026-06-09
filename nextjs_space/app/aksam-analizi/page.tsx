import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AksamAnaliziClient from './aksam-analizi-client';

export default async function AksamAnaliziPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <AksamAnaliziClient />;
}
