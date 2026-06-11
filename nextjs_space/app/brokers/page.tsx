export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BrokersClient } from './brokers-client';

export default async function BrokersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <BrokersClient />;
}
