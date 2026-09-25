'use client';
import { useEffect, useState } from 'react';
const money = (v: number) => v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
type Budget = { capital: number; cash: number; allocationPercent: number; perTradePercent: number; version: number; configured: boolean; limit: number; used: number; available: number; migrationCost: number };
export function BotBudget({ onSaved }: { onSaved?: () => void }) {
  const [view, setView] = useState<Budget | null>(null);
  const [capital, setCapital] = useState(100000), [allocation, setAllocation] = useState(30), [perTrade, setPerTrade] = useState(10);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function load() {
    try {
      const res = await fetch('/api/bot-lab/budget', { cache: 'no-store' }); const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setView(data); setCapital(data.capital); setAllocation(data.allocationPercent); setPerTrade(data.perTradePercent); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Bütçe alınamadı.'); }
  }
  useEffect(() => { void load(); }, []);
  const limit = capital * allocation / 100;
  const field = 'block w-full mt-1 rounded-xl border bg-background p-3';
  return <section className="glass-card rounded-2xl p-5 space-y-3">
    <h2 className="text-xl font-semibold">Ortak portföy ve bot bütçesi</h2>
    <p className="text-sm text-muted-foreground">Hisse, kripto ve manuel işlemler aynı sanal nakdi kullanır. Bot kullanım sınırı iki botun toplamı içindir.</p>
    {error && <p role="alert" className="text-red-600">{error} <button type="button" className="underline" onClick={load}>Yenile</button></p>}
    {!view ? <p>Bütçe yükleniyor…</p> : <>
      <dl className="grid grid-cols-2 gap-3 text-sm">{[['Ana portföy nakdi', view.cash], ['Bot toplam sınırı', view.limit], ['Botların kullandığı', view.used], ['Botlar için kullanılabilir', view.available]].map(([title, value]) => <div key={title}><dt className="text-muted-foreground">{title}</dt><dd className="font-semibold">{money(Number(value))}</dd></div>)}</dl>
      <details open={!view.configured}><summary className="cursor-pointer font-medium py-2">Sermaye ve kullanım yüzdelerini belirle</summary>
        <form className="space-y-3 mt-3" onSubmit={async e => {
          e.preventDefault(); setBusy(true); setError(''); setMessage('');
          try {
            const res = await fetch('/api/bot-lab/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capital, allocationPercent: allocation, perTradePercent: perTrade, version: view.version }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error);
            setView(data); setMessage('Ortak bütçe kaydedildi. Açık bot pozisyonları ana portföye bağlı.'); onSaved?.();
          } catch (e) { setError(e instanceof Error ? e.message : 'Kaydedilemedi.'); }
          finally { setBusy(false); }
        }}>
          <label className="block text-sm">Portföy sermayesi (sanal TL)<input className={field} type="number" inputMode="numeric" required min="1000" max="10000000" step="1" value={Number.isNaN(capital) ? '' : capital} onChange={e => setCapital(e.target.valueAsNumber)} /></label>
          <label className="block text-sm">Botların kullanabileceği sermaye (%)<input className={field} type="number" required min="1" max="100" step="1" value={Number.isNaN(allocation) ? '' : allocation} onChange={e => setAllocation(e.target.valueAsNumber)} /></label>
          <label className="block text-sm">Bir işlemde bot bütçesinin en fazla (%)<input className={field} type="number" required min="1" max="100" step="1" value={Number.isNaN(perTrade) ? '' : perTrade} onChange={e => setPerTrade(e.target.valueAsNumber)} /></label>
          {Number.isFinite(limit) && Number.isFinite(perTrade) && <p className="text-sm">İki bot birlikte en fazla <strong>{money(limit)}</strong>, tek alımda komisyon dahil en fazla <strong>{money(limit * perTrade / 100)}</strong> kullanabilir. Açık pozisyonların alış maliyeti bu sınıra dahildir.</p>}
          {capital !== view.capital && Number.isFinite(capital) && <p className="text-sm">Sanal sermaye farkı: {money(capital - view.capital)}. Nakit bu tutarda değişir; mevcut kazanç/zarar korunur. Sermaye eklemek kazanç sayılmaz.</p>}
          {view.migrationCost > 0 && <p className="rounded-xl border p-3 text-sm">Mevcut bot pozisyonları için nakitten {money(view.migrationCost)} düşülecek. Adet, alış maliyeti ve komisyon korunur. Eski bot nakdi ve kapanmış işlemlerin sonucu aktarılmaz; geçmiş bot günlüğünde kalır.</p>}
          <button className="rounded-xl bg-blue-600 text-white px-4 py-3 disabled:opacity-50" disabled={busy}>{busy ? 'Kaydediliyor…' : view.configured ? 'Bütçeyi güncelle' : 'Pozisyonları taşı ve ortak bütçeyi başlat'}</button>
        </form>
      </details>
      <p className="text-xs text-muted-foreground">Tutarlar ayarlar açıldığındaki durumu gösterir. Her işlemde güncel nakit ve ortak sınır yeniden kontrol edilir. Ayrılan pay nakit rezervasyonu değildir; manuel işlemler kullanılabilir nakdi azaltabilir.</p>
    </>}
    {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
  </section>;
}
