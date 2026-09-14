'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tradableMarketType } from '@/lib/asset-display';
import { readFirstSteps, updateFirstSteps, firstStepsProgress, type FirstStepsState } from '@/lib/first-steps';

export function FirstSteps({ accountId, buyCount }: { accountId: string; buyCount: number }) {
  const [state, setState] = useState<FirstStepsState>({});
  useEffect(() => {
    setState(readFirstSteps(accountId));
    const refresh = () => setState(readFirstSteps(accountId));
    const local = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.accountId === accountId) setState(detail.state);
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('borsabi-first-steps', local);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('borsabi-first-steps', local); };
  }, [accountId]);
  const progress = firstStepsProgress(state, buyCount);
  const count = progress.filter(Boolean).length;
  const steps = [
    { title: 'Bir hisse keşfet', text: 'Piyasalarda arama yapıp fiyatı ve bilgileri incele.', href: '/piyasalar' },
    { title: 'İlk sanal işlemini yap', text: 'Miktarı seç, komisyonu ve işlem sonrası bakiyeyi kontrol et.', href: state.symbol && tradableMarketType(state.symbol) ? `/stock/${encodeURIComponent(state.symbol)}` : '/piyasalar' },
    { title: 'Sonucunu incele', text: 'Portföyde fiyat, komisyon ve varsa kur etkisini karşılaştır.', href: '/portfolio#ilk-islem-sonucu' },
  ];
  if (state.dismissed) return <button onClick={() => updateFirstSteps(accountId, { dismissed: false })} className="min-h-[44px] text-sm text-blue-500 underline">İlk işlem rehberine devam et ({count}/3)</button>;
  return <section aria-label="İlk sanal işlem rehberi" className="glass-card rounded-xl p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">İlk sanal işlemin — {count}/3 adım</h2>
      <button onClick={() => updateFirstSteps(accountId, { dismissed: true })} className="min-h-[44px] text-xs text-muted-foreground underline">Şimdilik gizle</button>
    </div>
    <ol className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => <li key={step.title} className="glass-inner rounded-lg p-3 min-w-0">
        <p className="text-xs text-muted-foreground">{progress[index] ? '✓ Tamamlandı' : `${index + 1}. adım`}</p>
        <h3 className="font-medium mt-1">{step.title}</h3><p className="text-xs text-muted-foreground mt-2">{step.text}</p>
        <Link href={step.href} className="inline-flex items-center min-h-[44px] text-sm text-blue-500 underline">{progress[index] ? 'Tekrar aç' : 'Devam et'}</Link>
      </li>)}
    </ol>
    <p className="text-xs text-muted-foreground">Gerçek para kullanılmaz. Alım adımı işlem kaydıyla, son adım senin inceleme onayınla tamamlanır. Rehber tercihin bu tarayıcıda saklanır.</p>
  </section>;
}
