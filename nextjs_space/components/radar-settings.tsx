'use client';
import { useEffect, useState } from 'react';
import { EventRadar } from './event-radar';
export function RadarSettings() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ enabled: boolean; running: boolean; checkedAt: number | null } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const hash = () => { if (window.location.hash === '#radar') setOpen(true); };
    hash(); window.addEventListener('hashchange', hash);
    fetch('/api/event-radar/settings', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error(); return r.json();
    }).then(setStatus).catch(() => { if (!controller.signal.aborted) setError('Radar durumu alınamadı.'); });
    return () => { controller.abort(); window.removeEventListener('hashchange', hash); };
  }, []);
  async function toggle() {
    if (!status || saving) return;
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/event-radar/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !status.enabled }) });
      if (!r.ok) throw new Error();
      const result = await r.json(); setStatus({ ...status, enabled: result.enabled });
    } catch { setError('Tercih kaydedilemedi. Tekrar deneyin.'); }
    finally { setSaving(false); }
  }
  return <section id="radar" className="glass-card rounded-xl p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><button className="text-sm min-h-[44px] text-left" aria-expanded={open} onClick={() => setOpen(!open)}>Gelişme radarı · Ayrıntılar</button>
      <button className="text-sm min-h-[44px] text-blue-500" disabled={!status || saving} aria-pressed={status?.enabled ?? false} onClick={toggle}>{status?.enabled ? 'Bildirimleri kapat' : 'Bildirimleri aç'}</button></div>
    {open && <><p className="text-xs text-muted-foreground">{status?.running ? 'Arka plan kontrolü çalışıyor. Yaklaşık 10 dakikada bir yeni gelişmeler kontrol edilir.' : 'Arka plan kontrolü henüz doğrulanamadı.'} Aynı başlık ve etki yeniden bildirilmez. Telefon bildirimi için cihaz aboneliği gerekir.</p>
      {status?.checkedAt && <p className="text-xs text-muted-foreground">Son kontrol: {new Date(status.checkedAt).toLocaleString('tr-TR')}</p>}<EventRadar /></>}
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
  </section>;
}
