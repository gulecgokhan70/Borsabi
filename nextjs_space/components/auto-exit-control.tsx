'use client';
import { useState } from 'react';
export function AutoExitControl({ position, onChange }: { position: { id: string; autoExit: boolean }; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/positions/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: position.id, enabled: !position.autoExit }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error); onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı'); }
    finally { setBusy(false); }
  }
  return <div className="text-xs mt-3">
    <button onClick={toggle} disabled={busy} aria-pressed={position.autoExit} className="min-h-[44px] px-3 rounded-lg glass-inner">Otomatik simülasyon satışı: {position.autoExit ? 'Açık — kapat' : 'Kapalı — aç'}</button>
    <p className="text-muted-foreground mt-1">Açıldığında mevcut zarar kes/kâr al seviyeleriyle tüm pozisyon satılabilir. İlk gözlenen geçerli fiyat kullanılır; eşik fiyatı garanti edilmez.</p>
    {error && <p role="alert">{error}</p>}
  </div>;
}
