'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Loader2, Newspaper, RefreshCw } from 'lucide-react';
import type { MarketAlertsReport } from '@/lib/market-alerts';
const dateLabel = (date: string) => new Date(date).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export function MarketAlertsPanel() {
  const [open, setOpen] = useState(false), [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<MarketAlertsReport | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [topic, setTopic] = useState('Tümü'), [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    setLoading(true); setError('');
    void (async () => {
      try {
        const response = await fetch('/api/market-alerts', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Haberler alınamadı. Tekrar deneyin.');
        const data = await response.json(); if (!Array.isArray(data.alerts)) throw new Error('Haber listesi alınamadı.');
        if (active && !controller.signal.aborted) { setReport(data); setTopic('Tümü'); setShowAll(false); }
      } catch (e) {
        if (active) setError(controller.signal.aborted ? 'İstek zaman aşımına uğradı. Tekrar deneyin.' : e instanceof Error ? e.message : 'Bağlantı kurulamadı.');
      } finally { clearTimeout(timeout); if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [open, refresh]);
  const topics = ['Tümü', ...new Set(report?.alerts.map(a => a.topic) ?? [])];
  const filtered = (report?.alerts ?? []).filter(a => topic === 'Tümü' || a.topic === topic);
  const shown = showAll ? filtered : filtered.slice(0, 3);
  return <section className="glass-card rounded-xl border border-border overflow-hidden" aria-label="Piyasa Uyarıları">
    <h2><button type="button" className="w-full flex items-center gap-3 p-4 text-left min-h-[64px]" aria-expanded={open} aria-controls="market-alerts-content" onClick={() => setOpen(v => !v)}>
      <Newspaper aria-hidden="true" className="w-5 h-5 text-[#F59E0B] shrink-0" />
      <span className="flex-1 min-w-0"><span className="block text-base font-semibold">Piyasa Uyarıları</span><span className="block text-xs font-normal text-muted-foreground mt-1">Önemli haberler ve olası etkileri</span></span>
      <ChevronDown aria-hidden="true" className={`w-5 h-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button></h2>
    {open && <div id="market-alerts-content" className="border-t border-border">
      <div className="px-4 pt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{report ? `Liste güncellendi: ${dateLabel(report.checkedAt)} · TSİ` : 'Son 48 saatte yayımlanan haberler'}</p>
        <button type="button" disabled={loading} onClick={() => setRefresh(v => v + 1)} className="inline-flex items-center gap-1 min-h-[44px] text-sm text-[#3B82F6] shrink-0"><RefreshCw aria-hidden="true" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Yenile</button>
      </div>
      {loading && <p role="status" className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />Haberler yükleniyor…</p>}
      {error && <p role="alert" className="px-4 py-3 text-sm text-red-500">{error}{report && ' Önceki liste gösteriliyor.'}</p>}
      {!!report?.failedSources.length && <p role="status" className="px-4 py-2 text-xs text-muted-foreground">Bazı kaynaklara ulaşılamadı: {report.failedSources.join(', ')}. Liste eksik olabilir.</p>}
      {report && !loading && report.alerts.length === 0 && <p className="p-4 text-sm text-muted-foreground">{report.status === 'unavailable' ? 'Kaynak sorunu nedeniyle güncel uyarılar değerlendirilemiyor.' : 'Son 48 saatte bu bölümün ölçütlerine uyan haber bulunamadı. Bu, piyasada risk olmadığı anlamına gelmez.'}</p>}
      {!!report?.alerts.length && <>
        <div role="group" aria-label="Haber konusu" className="flex gap-2 px-4 py-3 overflow-x-auto">
          {topics.map(t => <button type="button" key={t} aria-pressed={topic === t} onClick={() => { setTopic(t); setShowAll(false); }} className={`shrink-0 rounded-full px-3 min-h-[44px] text-xs ${topic === t ? 'bg-[#3B82F6] text-white' : 'glass-inner text-muted-foreground'}`}>{t}</button>)}
        </div>
        <div className="divide-y divide-border">
          {shown.map(alert => <article key={alert.id} className="p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground"><span>{alert.topic}</span>{alert.context === 'Beklenti / soru' && <span className="rounded-full px-2 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400">Beklenti / soru</span>}{alert.priority && <span className="font-medium">Öncelikli konu</span>}</div>
            <h3 className="font-semibold text-base leading-relaxed break-words">{alert.title}</h3>
            <a href={alert.url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-wrap items-center gap-1 text-xs text-[#3B82F6] min-h-[32px]">{alert.source} · <time dateTime={alert.publishedAt}>{dateLabel(alert.publishedAt)} TSİ</time><ExternalLink aria-hidden="true" className="w-3 h-3" /><span className="sr-only"> Haberi kaynağında aç</span></a>
            <details className="glass-inner rounded-lg p-3">
              <summary className="cursor-pointer min-h-[32px] text-sm font-medium">Olası etkiler ve ayrıntılar</summary>
              <div className="mt-3 space-y-3 text-sm leading-relaxed">
                {alert.summary && <p className="text-muted-foreground">{alert.summary}</p>}
                {alert.context === 'Beklenti / soru' && <p className="text-xs text-muted-foreground">Başlık beklenti veya soru içeriyor; bir kararın gerçekleştiği anlamına gelmez.</p>}
                {alert.scenario ? <>
                  <p className="text-xs text-muted-foreground">Aşağıdakiler haberin konusuna göre hazırlanan koşullu senaryolardır.</p>
                  <div className="border-l-2 border-emerald-500 pl-3"><p className="font-medium text-emerald-700 dark:text-emerald-400">Olumlu senaryo</p><p>{alert.scenario.positive}</p></div>
                  <div className="border-l-2 border-rose-500 pl-3"><p className="font-medium text-rose-700 dark:text-rose-400">Olumsuz senaryo</p><p>{alert.scenario.negative}</p></div>
                  {!!alert.scenario.sectors.length && <p><span className="font-medium">İlgili sektörler: </span>{alert.scenario.sectors.join(' · ')}</p>}
                  <p><span className="font-medium">Neyi izlemeli? </span>{alert.scenario.watch}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Etki süresi: </span>{alert.scenario.horizon}</p>
                </> : <p className="text-muted-foreground">Bu haber için otomatik etki senaryosu bulunmuyor. Ayrıntılar için kaynağı açabilirsiniz.</p>}
              </div>
            </details>
          </article>)}
        </div>
        {filtered.length > 3 && <button type="button" className="w-full min-h-[48px] text-sm text-[#3B82F6] border-t border-border" onClick={() => setShowAll(v => !v)}>{showAll ? 'Daha az göster' : `Tümünü göster (${filtered.length})`}</button>}
      </>}
      <details className="m-4 text-xs text-muted-foreground"><summary className="cursor-pointer min-h-[32px]">Nasıl hazırlanıyor?</summary><p className="leading-relaxed">Haberler yayın tarihi ve konu önemine göre süzülür; tekrarlar birleştirilir. Öncelik, başlıktaki konuyu belirtir; ölçülmüş bir risk puanı değildir. Etkiler konu temelli senaryolardır; fiyat hedefi, gerçekleşme olasılığı veya al/sat önerisi içermez. Gerçek sonuç beklentilere ve şirketin durumuna bağlıdır.</p></details>
    </div>}
  </section>;
}
