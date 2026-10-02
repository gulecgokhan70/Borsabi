'use client';
import { useState } from 'react';
type Position = { id: string; symbol: string; type: string; updatedAt: string; stopLoss: number | null; takeProfit: number | null; trailingStopPercent: number | null; autoExit: boolean };
export function PositionOrderEditor({ position, onChange }: { position: Position; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(position);
  const [stop, setStop] = useState(''), [profit, setProfit] = useState(''), [trailing, setTrailing] = useState('');
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  function open() {
    setSnapshot(position); setStop(String(position.stopLoss ?? '')); setProfit(String(position.takeProfit ?? ''));
    setTrailing(String(position.trailingStopPercent ?? '')); setEnabled(position.autoExit); setError(''); setMessage(''); setEditing(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const number = (s: string) => s.trim() ? Number(s.replace(',', '.')) : null;
    const stopLoss = number(stop), takeProfit = number(profit), trailingStopPercent = number(trailing);
    if ([stopLoss, takeProfit, trailingStopPercent].some(n => n !== null && (!Number.isFinite(n) || n <= 0)) ||
      (trailingStopPercent !== null && trailingStopPercent >= 100) || (stopLoss !== null && takeProfit !== null && stopLoss >= takeProfit)) {
      setError('Pozitif değerler girin. Zarar durdur, kâr al seviyesinden düşük; iz süren stop %100’den küçük olmalı.'); return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/positions/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: snapshot.id, updatedAt: snapshot.updatedAt, stopLoss, takeProfit, trailingStopPercent, autoExit: enabled }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Emir kaydedilemedi.');
      setEditing(false); setMessage('Emir ayarları güncellendi.'); onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'Bağlantı kurulamadı. Tekrar deneyin.'); }
    finally { setBusy(false); }
  }
  const currency = snapshot.type === 'CRYPTO' ? 'USD' : 'TL';
  return <section className="mt-3 text-sm">
    {!editing ? <button onClick={open} className="glass-inner rounded-lg px-3 min-h-[44px] text-[#3B82F6]">Emri düzenle</button> :
      <form onSubmit={save} className="glass-inner rounded-xl p-3 space-y-3" aria-label={`${snapshot.symbol} emir ayarları`}>
        <p className="font-semibold">Sanal satış emrini düzenle</p>
        <p className="text-xs text-muted-foreground">Boş bıraktığınız eşik kaldırılır. Bu ayarlar açık pozisyonun tamamı için geçerlidir.</p>
        {([['Zarar durdur', stop, setStop, currency], ['Kâr al', profit, setProfit, currency], ['İz süren stop', trailing, setTrailing, '%']] as const).map(([label, value, setter, unit]) =>
          <label key={label} className="block">{label} ({unit})<input inputMode="decimal" value={value} onChange={e => setter(e.target.value)} disabled={busy} className="block w-full mt-1 p-3 rounded-lg bg-background border border-border" /></label>)}
        <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => setEnabled(e.target.checked)} />Otomatik sanal satış</label>
        <p className="text-xs text-muted-foreground">Açıksa yeni eşik zaten aşılmış olduğunda sonraki kontrolde satış gerçekleşebilir. İşlem fiyatı eşik fiyatından farklı olabilir. Yeni iz süren stop son kayıtlı fiyattan başlar; mevcut stopun izlediği en yüksek fiyat korunur.</p>
        {error && <p role="alert" className="text-red-500">{error}</p>}
        <div className="flex gap-3"><button disabled={busy} type="submit" className="rounded-lg bg-[#3B82F6] text-white px-4 min-h-[44px]">{busy ? 'Kaydediliyor…' : 'Kaydet'}</button><button disabled={busy} type="button" onClick={() => setEditing(false)} className="px-3 min-h-[44px]">Vazgeç</button></div>
      </form>}
    {message && <p role="status" className="mt-2 text-muted-foreground">{message}</p>}
  </section>;
}
