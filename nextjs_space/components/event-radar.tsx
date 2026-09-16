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
    setLoading(true); setError(''); setReport(null);
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
    <p className="text-sm text-muted-foreground">Kesin yön veya al/sat sinyali vermez. Senaryoların tahmin başarısı henüz ölçülmedi.</p>
    <div role="status" className="text-sm text-muted-foreground">{loading ? 'Güncel gelişmeler inceleniyor…' : error || (report?.status === 'insufficient' ? 'Değerlendirme için yeterli güncel ve tanınan haber yok. Bu, piyasada risk olmadığı anlamına gelmez.' : '')}</div>
    {report?.conflict && <p className="text-sm text-amber-600 dark:text-amber-400">Aynı alan için zıt etkili haberler var. Tek yönlü sonuç çıkarılmıyor.</p>}
    {report?.events.map(event => <details key={event.id} className="glass-inner rounded-xl p-3">
      <summary className="cursor-pointer min-h-[44px] text-sm font-medium text-foreground"><span className="block text-xs text-muted-foreground mb-1">{event.category}{event.symbols.length ? ` · ${event.symbols.join(', ')}` : ''}</span>{event.title}</summary>
      <p className="text-xs text-muted-foreground mt-3">{new Date(event.publishedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Türkiye saati) · {event.sourceType}</p>
      {event.channels.map(c => <div key={c.sector} className="mt-3 text-sm space-y-1"><p className="font-medium text-foreground">{c.sector} · Olası etki: {c.direction}</p><p className="text-muted-foreground">{c.mechanism}</p><p className="text-muted-foreground"><strong>Ters senaryo / belirsizlik:</strong> {c.counterScenario}</p></div>)}
      <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-sm text-blue-500 underline">Kaynağı oku · {event.sourceHost}</a>
    </details>)}
    {report && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer min-h-[44px]">Kapsam ve yöntem</summary><ul className="list-disc pl-4 space-y-2">{report.limitations.map(line => <li key={line}>{line}</li>)}</ul><p className="mt-3">Analiz zamanı: {new Date(report.generatedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Türkiye saati)</p></details>}
  </section>;
}
