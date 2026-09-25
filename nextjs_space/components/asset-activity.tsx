'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { AssetActivityData } from '@/lib/asset-activity';

const money = (v: number | null, currency = 'TRY') => v === null ? 'Hesaplanamadı' : v.toLocaleString('tr-TR', { style: 'currency', currency });
const quantity = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 8 });
const date = (v: string | null) => v ? new Date(v).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'Tarih kaydı yok';
const resultColor = (v: number | null) => v === null || v === 0 ? '' : v > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
type View = 'open' | 'closed' | 'trades';

export function AssetActivityContent({ data, view }: { data: AssetActivityData; view: View }) {
  if (view === 'open') return <div className="space-y-3">
    {data.valuationUnavailable && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">Fiyat veya kur bilgisi alınamadı; son değer ve kâr/zarar hesaplanamadı. İşlem kayıtlarınız aşağıda korunuyor.</p>}
    {!data.open.length && <p className="text-sm text-muted-foreground py-3">Bu varlıkta açık pozisyonunuz yok.</p>}
    {data.open.map(p => <article key={p.id} className="rounded-2xl border border-black/10 dark:border-white/10 p-4 space-y-3">
      <div className="flex justify-between flex-wrap gap-2"><h3 className="font-semibold">{p.origin}</h3><span>{quantity(p.quantity)} adet</span></div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted-foreground">Alış maliyeti</dt><dd className="font-semibold mt-1">{money(p.cost)}</dd></div>
        <div><dt className="text-muted-foreground">Son değer</dt><dd className="font-semibold mt-1">{money(p.value)}</dd></div>
        <div className="col-span-2"><dt className="text-muted-foreground">Gerçekleşmemiş kâr/zarar</dt><dd className={`font-semibold mt-1 ${resultColor(p.pnl)}`}>{money(p.pnl)}</dd></div>
      </dl>
      <details className="text-sm"><summary className="cursor-pointer min-h-[44px] flex items-center">Pozisyon ayrıntıları</summary><div className="space-y-1 text-muted-foreground">
        <p>Ortalama alış: {money(p.entry, p.currency)} ({p.currency})</p><p>Açılış: {date(p.openedAt)}</p>
        {p.quoteTime && <p>Fiyat zamanı: {date(p.quoteTime)}</p>}
        {p.origin === 'Eski sanal bot' && <p>Ayrı sanal bot hesabına aittir; ana portföy toplamına dahil değildir.</p>}
      </div></details>
      {p.stale && p.value !== null && <p className="text-xs text-amber-700 dark:text-amber-400">Güncel fiyat doğrulanamadı; değer son kayıtlı fiyata dayanıyor.</p>}
    </article>)}
    {!!data.open.length && <p className="text-xs text-muted-foreground">Toplamlar TL cinsindedir. Maliyet alış komisyonunu içerir; olası satış masrafları henüz düşülmemiştir. Fiyatlar gecikmeli olabilir.</p>}
  </div>;
  if (view === 'closed') return <div className="space-y-3">
    {!data.closed.length && <p className="text-sm text-muted-foreground py-3">Bu varlıkta kapanmış pozisyonunuz yok. Kısmi satışlar işlem geçmişinde görünür.</p>}
    {data.closed.map(p => <article key={p.id} className="rounded-2xl border border-black/10 dark:border-white/10 p-4 text-sm space-y-2">
      <h3 className="font-semibold">{p.origin} · Kapandı</h3><p className="text-muted-foreground">{date(p.closedAt)}</p>
      <p>Gerçekleşen net kâr/zarar: <strong className={resultColor(p.pnl)}>{money(p.pnl)}</strong></p>
      {p.origin === 'Eski sanal bot' && <p className="text-muted-foreground">Ayrı sanal bot hesabı</p>}
    </article>)}
    {data.moreClosed && <p className="text-xs text-muted-foreground">En son 20 kapanan pozisyon gösteriliyor.</p>}
  </div>;
  return <div className="space-y-3">
    {!data.trades.length && <p className="text-sm text-muted-foreground py-3">Bu varlıkta henüz gerçekleşmiş işleminiz yok.</p>}
    {data.trades.map(t => <article key={t.id} className="rounded-2xl border border-black/10 dark:border-white/10 p-4 text-sm space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{t.action === 'TRANSFER' ? 'Pozisyon aktarımı' : t.action === 'BUY' ? 'Alış' : 'Satış'}</h3><span className="text-muted-foreground">{t.origin}</span></div>
      <p className="text-muted-foreground">{date(t.time)}</p>
      <p>{quantity(t.quantity)} adet · Birim fiyat {money(t.price, t.currency)} ({t.currency})</p>
      <p>{t.action === 'TRANSFER' ? 'Aktarılan alış tutarı' : 'İşlem tutarı'}: {money(t.total)}</p>
      <p>{t.action === 'TRANSFER' ? 'Kayıtlı alış komisyonu' : 'Komisyon'}: {money(t.fee)}</p>
      {t.action === 'TRANSFER' ? <p className="text-muted-foreground">Mevcut pozisyon ortak portföye taşındı; yeni bir piyasa alımı değildir.</p>
        : <p>{t.action === 'BUY' ? 'Toplam ödeme' : 'Net satış tutarı'}: <strong>{money(t.total + (t.action === 'BUY' ? t.fee : -t.fee))}</strong></p>}
      {t.action === 'SELL' && <p>Gerçekleşen net kâr/zarar: <strong className={resultColor(t.pnl)}>{money(t.pnl)}</strong></p>}
      {t.origin === 'Eski sanal bot' && <p className="text-muted-foreground">Ayrı sanal bot hesabı</p>}
    </article>)}
    {data.moreTrades && <p className="text-xs text-muted-foreground">En son 20 işlem gösteriliyor.</p>}
  </div>;
}

export function AssetActivity({ symbol, revision = 0 }: { symbol: string; revision?: number }) {
  const { data: session, status } = useSession();
  const [data, setData] = useState<AssetActivityData | null>(null);
  const [view, setView] = useState<View>('open');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setData(null); setError(''); setLoading(false);
    if (status !== 'authenticated') return;
    let disposed = false;
    let controller: AbortController | null = null;
    const load = async () => {
      controller?.abort();
      const current = new AbortController(); controller = current;
      setLoading(true);
      try {
        const response = await fetch(`/api/stock/${encodeURIComponent(symbol)}/activity`, { cache: 'no-store', signal: current.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'İşlemler yüklenemedi.');
        if (!disposed && !current.signal.aborted) { setData(body); setError(''); }
      } catch (e) {
        if (!disposed && !current.signal.aborted) { setData(null); setError(e instanceof Error ? e.message : 'İşlemler yüklenemedi.'); }
      } finally { if (!disposed && !current.signal.aborted) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [symbol, revision, retry, status, session?.user?.id]);
  return <section aria-label="Bu varlıktaki işlemlerim" className="py-5 border-y border-black/10 dark:border-white/10 space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="text-xl font-semibold">Bu varlıktaki işlemlerim</h2><button type="button" disabled={loading} onClick={() => setRetry(n => n + 1)} className="text-sm text-indigo-600 dark:text-indigo-400 min-h-[44px] disabled:opacity-50">{loading ? 'Yükleniyor…' : 'Yenile'}</button></div>
    <p className="text-xs text-muted-foreground">Sanal işlemler · Yalnızca sizin kayıtlarınız</p>
    {status === 'unauthenticated' ? <Link href="/login" className="text-indigo-600 underline">İşlemlerinizi görmek için giriş yapın</Link> : <>
      <div className="flex flex-wrap gap-2" aria-label="İşlem görünümü">{([['open', 'Açık'], ['closed', 'Kapalı'], ['trades', 'Geçmiş']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`min-h-[44px] px-4 rounded-xl text-sm font-medium ${view === key ? 'bg-indigo-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{label}{key === 'open' && data ? ` (${data.open.length})` : ''}</button>)}</div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p role="status" className="text-sm text-muted-foreground">İşlemler yükleniyor…</p>}
      {data && <AssetActivityContent data={data} view={view} />}
      <div className="flex flex-wrap gap-x-5 text-sm"><Link href="/portfolio" className="text-indigo-600 dark:text-indigo-400 min-h-[44px] flex items-center">Portföyüm →</Link><Link href="/trade-log" className="text-indigo-600 dark:text-indigo-400 min-h-[44px] flex items-center">İşlem günlüğü →</Link><Link href="/bot-lab" className="text-indigo-600 dark:text-indigo-400 min-h-[44px] flex items-center">Bot işlemleri →</Link></div>
    </>}
  </section>;
}
