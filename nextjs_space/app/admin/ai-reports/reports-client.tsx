'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { reportReasons } from '@/lib/ai-report';
type Report = { id: string; content: string; comment: string | null; reason: keyof typeof reportReasons; source: string; createdAt: string };
const statuses = { OPEN: 'Bekleyen', REVIEWED: 'İncelendi', DISMISSED: 'İşlem gerektirmiyor' };
export function ReportsClient() {
  const [status, setStatus] = useState('OPEN'), [page, setPage] = useState(1), [version, setVersion] = useState(0);
  const [reports, setReports] = useState<Report[]>([]), [total, setTotal] = useState(0), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/admin/ai-reports?status=${status}&page=${page}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (!controller.signal.aborted) { setReports(data.reports); setTotal(data.total); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Bildirimler alınamadı.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page, version]);
  async function review(id: string, nextStatus: string) {
    setSaving(id); setError('');
    try {
      const response = await fetch('/api/admin/ai-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: nextStatus }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setVersion(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.'); }
    finally { setSaving(''); }
  }
  return <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
    <Link className="inline-flex min-h-[44px] items-center text-blue-500" href="/profile">← Profile dön</Link>
    <h1 className="text-2xl font-bold">AI içerik bildirimleri</h1>
    <p className="text-sm text-muted-foreground">Bildirilen yanıt ve açıklama kullanıcı tarafından gönderilir; özgün bir sunucu kaydı olarak doğrulanmış değildir. “İncelendi” işareti yalnızca inceleme durumunu değiştirir; gerekli içerik veya filtre düzeltmesini ayrıca uygulayın.</p>
    <label className="block">Durum<select className="ml-2 bg-background border rounded-lg min-h-[44px] px-3" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {loading ? <p role="status">Yükleniyor…</p> : reports.length === 0 ? <p>Bu durumda bildirim bulunmuyor.</p> : reports.map(report => <article className="glass-card rounded-xl p-4 space-y-3" key={report.id}>
      <h2 className="font-semibold">{reportReasons[report.reason]} · {report.source}</h2><p className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString('tr-TR')}</p>
      <details><summary className="min-h-[44px] cursor-pointer">Bildirilen yanıtı göster</summary><p className="whitespace-pre-wrap break-words max-h-80 overflow-auto">{report.content}</p></details>
      {report.comment && <p className="whitespace-pre-wrap break-words">Açıklama: {report.comment}</p>}
      <div className="flex flex-wrap gap-2">{Object.entries(statuses).filter(([key]) => key !== status).map(([key, label]) => <button className="glass-inner rounded-lg min-h-[44px] px-3 disabled:opacity-50" disabled={!!saving} onClick={() => review(report.id, key)} key={key}>{label}</button>)}</div>
    </article>)}
    <div className="flex justify-between items-center gap-3"><button disabled={loading || page === 1} className="min-h-[44px] disabled:opacity-40" onClick={() => setPage(p => p - 1)}>Önceki</button><span>{page}. sayfa · {total} bildirim</span><button disabled={loading || page * 20 >= total} className="min-h-[44px] disabled:opacity-40" onClick={() => setPage(p => p + 1)}>Sonraki</button></div>
  </main>;
}
