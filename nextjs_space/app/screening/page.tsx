import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScreeningClient } from './screening-client';

export default async function ScreeningPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <ScreeningClient />;
}
