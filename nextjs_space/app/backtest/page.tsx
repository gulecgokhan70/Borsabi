import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BacktestClient } from './backtest-client';
import { ReplayClient } from '../replay/replay-client';

export default async function BacktestPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const practice = (await searchParams).mode === 'practice';
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Backtest</h1>
    <p className="text-sm text-muted-foreground">Geçmiş verilerde stratejinizi otomatik test edin veya kararları kendiniz vererek pratik yapın.</p>
    <nav aria-label="Backtest modu" className="flex flex-wrap gap-2">
      {[{ href: '/backtest', label: 'Strateji testi', active: !practice }, { href: '/backtest?mode=practice', label: 'Adım adım pratik', active: practice }].map(item => <Link key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined} className={`min-h-[44px] px-4 py-3 rounded-lg text-sm ${item.active ? 'bg-[#3B82F6] text-white' : 'glass-inner'}`}>{item.label}</Link>)}
    </nav>
    {practice ? <ReplayClient /> : <BacktestClient />}
  </div>;
}
