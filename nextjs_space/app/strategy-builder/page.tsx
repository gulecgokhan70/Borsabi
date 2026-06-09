import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StrategyBuilderClient from './strategy-builder-client';

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <StrategyBuilderClient />;
}
