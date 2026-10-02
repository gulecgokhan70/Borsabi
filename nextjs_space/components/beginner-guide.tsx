'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GUIDE_STEPS, guideStateSchema, type GuideState } from '@/lib/onboarding';
import { dismissGuide, saveGuide } from '@/lib/guide-client';
export function BeginnerGuide({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [state, setState] = useState<GuideState>({ step: 0, status: 'available' });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [quantity, setQuantity] = useState('1');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setLoading(true); setError('');
    fetch('/api/onboarding', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const parsed = guideStateSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error();
      if (active) { setState(parsed.data); setLoaded(true); }
    }).catch(() => { if (active) setError('Rehber ilerlemen alınamadı. Yeniden deneyebilir veya şimdilik atlayabilirsin.'); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [accountId, retry]);
  useEffect(() => { if (!loading) titleRef.current?.focus(); }, [state.step, state.status, loading]);
  async function move(next: GuideState) {
    setBusy(true); setError('');
    try { await saveGuide(next); if (alive.current) { setState(next); dismissGuide(accountId); } }
    catch { if (alive.current) setError('İlerleme kaydedilemedi. Aynı düğmeyle tekrar deneyebilir veya şimdilik atlayabilirsin.'); }
    finally { if (alive.current) setBusy(false); }
  }
  function skip() {
    dismissGuide(accountId);
    // Navigation never waits on optional education preferences. Avoid racing an in-flight save.
    if (!busy && !loading && loaded && state.status !== 'completed') void saveGuide({ step: state.step, status: 'skipped' }).catch(() => {});
    router.push('/dashboard');
  }
  const step = GUIDE_STEPS[state.step], completed = state.status === 'completed';
  const amount = Number(quantity), validAmount = quantity.trim() !== '' && Number.isInteger(amount) && amount >= 1 && amount <= 10;
  return <section className="max-w-2xl mx-auto space-y-5 pb-6">
    <div className="flex items-center justify-between gap-3"><Link href="/academy" className="text-sm text-[#3B82F6] min-h-[44px] inline-flex items-center">← Öğren</Link><button onClick={skip} className="text-sm text-muted-foreground min-h-[44px] px-2">Şimdilik atla</button></div>
    <div className="glass-card rounded-2xl p-5 sm:p-7 space-y-5">
      <p className="text-sm font-medium text-[#3B82F6]">Başlangıç rehberi</p>
      {loading ? <p role="status">Rehber açılıyor…</p> : loaded ? <>
        <p className="text-xs text-muted-foreground">{completed ? '5 adım tamamlandı' : `Adım ${state.step + 1} / ${GUIDE_STEPS.length}`}</p>
        <progress aria-label="Rehber ilerlemesi" max={GUIDE_STEPS.length} value={completed ? GUIDE_STEPS.length : state.step} className="w-full h-2 accent-[#3B82F6]" />
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-semibold outline-none">{completed ? 'Rehberi tamamladın' : step.title}</h1>
        {completed ? <>
          <p className="text-muted-foreground">İstersen şimdi bir hisse keşfet veya başlangıç derslerine geç. Eğitim sırasında hesabında alım ya da satış yapılmadı.</p>
          <div className="flex flex-wrap gap-3"><Link href="/piyasalar" className="rounded-xl bg-[#3B82F6] text-white px-4 min-h-[44px] inline-flex items-center">Piyasaları keşfet</Link><Link href="/academy" className="px-3 min-h-[44px] inline-flex items-center text-[#3B82F6]">Derslere geç</Link></div>
          <button disabled={busy} onClick={() => move({ step: 0, status: 'in_progress' })} className="text-sm text-muted-foreground min-h-[44px]">Rehberi baştan aç</button>
        </> : <>
          <p className="text-muted-foreground leading-relaxed">{step.text}</p>
          <ul className="space-y-3 list-disc pl-5 text-sm leading-relaxed">{step.points.map(point => <li key={point}>{point}</li>)}</ul>
          {state.step === 2 && <div className="glass-inner rounded-xl p-4 space-y-3">
            <p className="font-medium text-sm">Deneme alanı</p><p className="text-xs text-muted-foreground">Örnek fiyat: 100 TL · Varsayılan komisyon: 0 TL. Bu alan işlem göndermez.</p>
            <label className="block text-sm">Adet (1–10)<input type="number" inputMode="numeric" min="1" max="10" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 block w-full bg-background border border-border rounded-lg p-3" /></label>
            <p aria-live="polite" className="text-sm">{validAmount ? `Örnek toplam: ${(amount * 100).toLocaleString('tr-TR')} TL` : '1 ile 10 arasında tam bir adet gir.'}</p>
          </div>}
          <p className="text-sm glass-inner rounded-xl p-3 leading-relaxed">{step.tip}</p>
          <div className="flex justify-between gap-3"><button disabled={busy || state.step === 0} onClick={() => move({ step: state.step - 1, status: 'in_progress' })} className="min-h-[44px] px-4 text-sm disabled:opacity-40">Geri</button><button disabled={busy} onClick={() => move(state.step === GUIDE_STEPS.length - 1 ? { step: state.step, status: 'completed' } : { step: state.step + 1, status: 'in_progress' })} className="min-h-[44px] rounded-xl bg-[#3B82F6] text-white px-5 text-sm disabled:opacity-50">{busy ? 'Kaydediliyor…' : state.step === GUIDE_STEPS.length - 1 ? 'Rehberi tamamla' : 'Devam'}</button></div>
        </>}
      </> : null}
      {error && <div role="alert" className="text-sm text-red-500"><p>{error}</p>{!busy && <button onClick={() => setRetry(v => v + 1)} className="min-h-[44px] underline">İlerlemeyi yeniden yükle</button>}</div>}
    </div>
  </section>;
}
