import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AiAssistantClient } from './ai-assistant-client';

export default async function AiAssistantPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <AiAssistantClient />;
}
