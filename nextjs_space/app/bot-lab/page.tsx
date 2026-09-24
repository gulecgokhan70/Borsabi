import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BotLabClient } from './bot-lab-client';
export default async function BotLabPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <BotLabClient />;
}
