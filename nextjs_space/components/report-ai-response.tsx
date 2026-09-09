'use client';
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { reportReasons, type ReportSource } from '@/lib/ai-report';

export function ReportAIResponse({ content, source }: { content: string; source: ReportSource }) {
  return <ReportAIResponseForm key={`${source}:${content}`} content={content} source={source} />;
}

function ReportAIResponseForm({ content, source }: { content: string; source: ReportSource }) {
  const [open, setOpen] = useState(false), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<keyof typeof reportReasons>('inaccurate');
  const [comment, setComment] = useState(''), [error, setError] = useState('');
  if (!content.trim()) return null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ai-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, content: content.slice(0, 12_000), reason, comment }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bildirim gönderilemedi.');
      setSent(true); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bağlantı kurulamadı.'); }
    finally { setBusy(false); }
  }
  if (sent) return <p role="status" className="text-xs mt-3 text-muted-foreground">Bildiriminiz inceleme için kaydedildi.</p>;
  return <div className="mt-2 text-xs">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-[44px] inline-flex items-center gap-2 text-muted-foreground"><Flag className="w-3.5 h-3.5" />Yanıtı bildir</button>
    {open && <form onSubmit={submit} className="glass-inner rounded-xl p-3 space-y-3">
      <label className="block">Bildirim nedeni<select value={reason} onChange={event => setReason(event.target.value as keyof typeof reportReasons)} className="block mt-1 w-full min-h-[44px] bg-background border rounded-lg px-2">{Object.entries(reportReasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block">Açıklama (isteğe bağlı)<textarea value={comment} maxLength={1000} rows={3} onChange={event => setComment(event.target.value)} className="block mt-1 w-full bg-background border rounded-lg p-2" /></label>
      <p className="text-muted-foreground">Bu yanıtın ilk 12.000 karakteri ve açıklamanız, hesabınızla ilişkilendirilerek inceleme ekibine iletilir.</p>
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <button disabled={busy} className="min-h-[44px] px-4 bg-blue-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Gönderiliyor…' : 'Bildirimi gönder'}</button>
    </form>}
  </div>;
}
