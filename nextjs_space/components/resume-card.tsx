'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readResume, updateResume, type ResumeState } from '@/lib/resume';
import { getCourseById } from '@/lib/academy-data';
export function ResumeCard({ accountId }: { accountId: string }) {
  const [state, setState] = useState<ResumeState>({});
  useEffect(() => {
    const refresh = () => setState(readResume(accountId)); refresh();
    const local = (event: Event) => { if ((event as CustomEvent).detail?.id === accountId) refresh(); };
    window.addEventListener('storage', refresh); window.addEventListener('borsabi-resume', local);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('borsabi-resume', local); };
  }, [accountId]);
  const items = [state.stock, state.course && getCourseById(state.course.href.split('/')[2]) ? state.course : undefined].filter(Boolean);
  if (!items.length) return null;
  if (state.hidden) return null;
  return <section aria-label="Kaldığın yerden devam et" className="glass-card rounded-xl p-4 space-y-3">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Kaldığın yerden devam et</h2><button className="min-h-[44px] text-xs underline" onClick={() => updateResume(accountId, { hidden: true })}>Gizle</button></div>
    <div className="grid gap-3 sm:grid-cols-2">{items.map(item => <div key={item!.href} className="glass-inner rounded-lg p-3 min-w-0"><p className="font-medium break-words">{item!.title}</p><p className="text-xs text-muted-foreground">{new Date(item!.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · Türkiye saati</p><Link href={item!.href} className="inline-flex min-h-[44px] items-center text-sm text-blue-500 underline">Devam et</Link></div>)}</div>
    <p className="text-xs text-muted-foreground">Son ziyaretler ve ders ilerlemesi bu tarayıcıda, hesabına özel saklanır.</p>
  </section>;
}
