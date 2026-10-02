'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dismissGuide, guideDismissed, saveGuide } from '@/lib/guide-client';
export function Onboarding({ accountId }: { accountId: string }) {
  const [show, setShow] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (guideDismissed(accountId)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch('/api/onboarding', { signal: controller.signal, cache: 'no-store' }).then(async r => {
      if (!r.ok) return; const state = await r.json();
      if (!controller.signal.aborted && state.status === 'new') setShow(true);
    }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [accountId]);
  function choose(start: boolean) {
    dismissGuide(accountId); setShow(false);
    if (start) router.push('/baslangic-rehberi');
    else void saveGuide({ step: 0, status: 'skipped' }).catch(() => { /* Dismissal still applies locally. */ });
  }
  if (!show) return null;
  return <section aria-label="Yeni üye rehberi" className="glass-card rounded-xl p-4 sm:p-6 space-y-3 border border-[#3B82F6]/20">
    <p className="text-xs font-medium text-[#3B82F6]">BorsaBi’ye hoş geldin</p>
    <h2 className="text-xl font-semibold">İlk adımlarını birlikte atalım</h2>
    <p className="text-sm text-muted-foreground">5 kısa adımda hisse bulmayı, sanal işlem formunu ve portföyünü tanı. İstersen rehberi atlayıp hemen uygulamayı kullanabilirsin.</p>
    <div className="flex flex-wrap gap-2"><button onClick={() => choose(true)} className="rounded-xl bg-[#3B82F6] text-white px-4 min-h-[44px] text-sm font-medium">Rehbere başla</button><button onClick={() => choose(false)} className="rounded-xl px-4 min-h-[44px] text-sm text-muted-foreground">Şimdilik atla</button></div>
    <p className="text-xs text-muted-foreground">Daha sonra Öğren → Başlangıç rehberi üzerinden ulaşabilirsin.</p>
  </section>;
}
