'use client';
import { useEffect, useState } from 'react';
import type { RadarReport } from '@/lib/event-radar';
export function EventRadar() {
  const [report, setReport] = useState<RadarReport | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch('/api/event-radar', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      return response.json();
    }).then(data => { if (!controller.signal.aborted) setReport(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Gelişmeler alınamadı. Yeniden deneyebilirsin.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  return <section className="glass-card rounded-2xl p-4 md:p-6 space-y-4" aria-label="Gelişme radarı" aria-busy={loading}>
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Gelişme radarı</h2><p className="text-xs text-muted-foreground">Haberlerin olası etkisi · Deneysel</p></div>
      <button disabled={loading} onClick={() => setAttempt(n => n + 1)} className="min-h-[44px] px-3 rounded-xl glass-inner text-sm disabled:opacity-50">Yenile</button></div>
    <p className="text-sm text-muted-foreground">Olası etkiler gösterilir; al/sat sinyali değildir.</p>
    <div role="status" className="text-sm text-muted-foreground">{loading ? 'Güncel gelişmeler inceleniyor…' : error || (report?.status === 'insufficient' && !report.headlines?.length ? 'Güncel etki senaryosu bulunamadı. Bu, piyasada risk olmadığı anlamına gelmez.' : '')}</div>
    {report?.conflict && <p className="text-sm text-amber-600 dark:text-amber-400">Aynı alan için zıt etkili haberler var. Tek yönlü sonuç çıkarılmıyor.</p>}
    {report?.events.map(event => <details key={event.id} className="glass-inner rounded-xl p-3">
      <summary className="cursor-pointer min-h-[44px] text-sm font-medium text-foreground"><span className="block text-xs text-muted-foreground mb-1">{event.category}{event.symbols.length ? ` · ${event.symbols.join(', ')}` : ''}</span>{event.title}</summary>
      <p className="text-xs text-muted-foreground mt-3">{new Date(event.publishedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Türkiye saati) · {event.sourceType}</p>
      {event.channels.map(c => <div key={c.sector} className="mt-3 text-sm space-y-1"><p className="font-medium text-foreground">{c.sector} · Olası etki: {c.direction}</p><p className="text-muted-foreground">{c.mechanism}</p><p className="text-muted-foreground"><strong>Ters senaryo / belirsizlik:</strong> {c.counterScenario}</p></div>)}
      <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-sm text-blue-500 underline">Kaynağı oku · {event.sourceHost}</a>
    </details>)}
    {!!report?.headlines?.length && <div className="space-y-3">
      <h3 className="font-semibold">Son haberler</h3>
      <p className="text-xs text-muted-foreground">Bu başlıklar için otomatik yön tahmini yapılmadı.</p>
      {report.headlines.map(item => <article key={item.sourceUrl} className="border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium min-h-[44px] py-2">{item.title}</a>
        <p className="text-xs text-muted-foreground">{item.sourceHost} · {new Date(item.publishedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}{item.older ? ' · 48 saatten eski' : ''}</p>
      </article>)}
    </div>}
    {!loading && report && !report.events.length && !report.headlines?.length && <p className="text-sm text-muted-foreground">Kaynaklardan son 7 güne ait tarihli haber alınamadı. Kaynak durumunu aşağıdan kontrol edebilirsin.</p>}
    {!!report?.sources?.length && <details className="text-xs text-muted-foreground">
      <summary className="min-h-[44px] cursor-pointer">Haber kaynakları · {report.sources.filter(s => s.state === 'ok').length}/{report.sources.length} yanıt verdi</summary>
      <ul className="space-y-2">{report.sources.map(s => <li key={s.source}>{s.source}: {s.state === 'error' ? 'Kaynağa ulaşılamadı' : s.state === 'empty' ? 'Haber listesi boş döndü' : `${s.count} başlık alındı`}{s.latestPublishedAt ? ` · Son haber: ${new Date(s.latestPublishedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : ''}</li>)}</ul>
    </details>}
    {report && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer min-h-[44px]">Kapsam ve yöntem</summary><ul className="list-disc pl-4 space-y-2">{report.limitations.map(line => <li key={line}>{line}</li>)}</ul><p className="mt-3">Analiz zamanı: {new Date(report.generatedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Türkiye saati)</p></details>}
  </section>;
}
