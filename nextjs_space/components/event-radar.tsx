'use client';
import { useEffect, useState } from 'react';
import type { ImpactScenario } from '@/lib/radar-scenarios';
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
    {report && <div className="rounded-xl glass-inner p-3 space-y-1">
      <p className="font-semibold text-sm">Varsayımsal piyasa görünümü: {report.marketOutlook ?? 'Koşula bağlı'}</p>
      <p className="text-xs text-muted-foreground">Son 48 saatteki başlıklara bağlı senaryoların özeti. Gerçekleşen piyasa tepkisi ölçülmedi.</p>
    </div>}
    {report?.events.map(event => <article key={event.id} className="glass-inner rounded-xl p-4 space-y-3">
      <p className="text-xs text-muted-foreground">{event.category}{event.symbols.length ? ` · ${event.symbols.join(', ')}` : ''}</p>
      <h3 className="text-sm font-semibold">{event.title}</h3>
      <p className="text-xs text-muted-foreground">{new Date(event.publishedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · {event.sourceType}</p>
      {event.scenario && <ScenarioView scenario={event.scenario} />}
      <details><summary className="text-xs cursor-pointer min-h-[44px]">Başlığa özgü etki ayrıntısı</summary>
        {event.channels.map(c => <div key={c.sector} className="mt-3 text-sm space-y-1"><p className="font-medium">{c.sector} · Olası etki: {c.direction}</p><p className="text-muted-foreground">{c.mechanism}</p><p className="text-muted-foreground"><strong>Ters senaryo / belirsizlik:</strong> {c.counterScenario}</p></div>)}
      </details>
      <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-sm text-blue-500 underline">Kaynağı oku · {event.sourceHost}</a>
    </article>)}
    {!!report?.headlines?.length && <div className="space-y-3">
      <h3 className="font-semibold">Gelişmeler ve olası etkileri</h3>
      {report.headlines.map(item => <article key={item.sourceUrl} className="glass-inner rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold">{item.title}</h4>
        <p className="text-xs text-muted-foreground">{item.sourceHost} · {new Date(item.publishedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}{item.older ? ' · 48 saatten eski; güncel piyasa özetine dahil değil' : ''}</p>
        {item.scenario ? <ScenarioView scenario={item.scenario} /> : <p className="text-xs text-muted-foreground">Bu başlık için sektör etkisi belirlenemedi; yön tahmini üretilmedi.</p>}
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm text-blue-500 underline">Kaynağı oku</a>
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

function ScenarioView({ scenario }: { scenario: ImpactScenario }) {
  return <div className="space-y-3">
    <p className="text-sm font-semibold">{scenario.topic} · Varsayımsal yön: <span className={scenario.direction === 'Pozitif' ? 'text-emerald-600 dark:text-emerald-400' : scenario.direction === 'Negatif' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>{scenario.direction}</span></p>
    <p className="text-xs text-muted-foreground"><strong>Varsayım:</strong> {scenario.assumption}</p>
    <p className="text-sm"><strong>Piyasa etkisi:</strong> {scenario.market}</p>
    <div className="grid gap-3 md:grid-cols-2 text-sm">
      <div className="rounded-lg border border-emerald-500/25 p-3"><p className="font-semibold text-emerald-600 dark:text-emerald-400">Pozitif senaryo</p><p className="mt-1">{scenario.positive}</p></div>
      <div className="rounded-lg border border-red-500/25 p-3"><p className="font-semibold text-red-600 dark:text-red-400">Negatif senaryo</p><p className="mt-1">{scenario.negative}</p></div>
    </div>
    <div className="space-y-3"><h5 className="text-sm font-semibold">Sektör etkileri</h5>{scenario.sectors.map(s => <div key={s.sector} className="text-xs space-y-1 border-l-2 border-blue-500/30 pl-3">
      <p className="font-semibold text-sm">{s.sector}</p><p><strong className="text-emerald-600 dark:text-emerald-400">Pozitif:</strong> {s.positive}</p><p><strong className="text-red-600 dark:text-red-400">Negatif:</strong> {s.negative}</p>
    </div>)}</div>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer min-h-[44px]">Senaryoyu takip etmek için</summary><ul className="list-disc pl-4 space-y-1">{scenario.watch.map(w => <li key={w}>{w}</li>)}</ul><p className="mt-2">Bu veriler otomatik doğrulanmadı; senaryonun hangi koşullarda değişeceğini gösterir.</p></details>
  </div>;
}
