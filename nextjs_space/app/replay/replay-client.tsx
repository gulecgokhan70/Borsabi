'use client';
import { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/constants';
export function ReplayClient() {
  const [state, setState] = useState<any>(null), [symbol, setSymbol] = useState('BTC-USD'), [date, setDate] = useState('');
  const [qty, setQty] = useState(''), [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => { setDate(new Date(Date.now() - 86400000).toISOString().slice(0, 10)); refresh(); }, []);
  async function refresh() { try { const r = await fetch('/api/replay'); const d = await r.json(); if (!r.ok) throw new Error(d.error); setState(d.empty ? null : d); } catch (e) { setError(e instanceof Error ? e.message : 'Pratik alınamadı.'); } }
  async function send(action?: string) {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try {
      const r = await fetch('/api/replay', { method: action ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action
        ? { id: state.id, version: state.version, action, quantity: ['BUY', 'SELL'].includes(action) ? Number(qty) : undefined, note }
        : { symbol, date }) });
      const d = await r.json(); if (!r.ok) { if (r.status === 409) await refresh(); throw new Error(d.error); } setState(d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sonuç doğrulanamadı; son durumu yükleyin.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const money = (v: number) => formatCurrency(v, state?.currency ?? 'TRY');
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Geçmiş piyasada pratik</h1>
    <p className="text-sm text-muted-foreground">Geçmiş bir günü, sonraki fiyatları görmeden adım adım oynayın. Bu pratiğin bakiyesi portföyünüzden ayrıdır. Kripto pratiği USD, BIST pratiği TL ile yapılır.</p>
    <fieldset disabled={busy} className="glass-card p-4 rounded-xl flex flex-wrap gap-3">
      <label className="text-sm">Sembol<input value={symbol} onChange={e => setSymbol(e.target.value)} className="block glass-inner rounded p-3 w-40" placeholder="THYAO.IS / BTC-USD" /></label>
      <label className="text-sm">Geçmiş gün<input type="date" value={date} onChange={e => setDate(e.target.value)} className="block glass-inner rounded p-3" /></label>
      <button onClick={() => send()} className="min-h-[44px] self-end px-4 py-3 rounded bg-[#3B82F6] text-white">Yeni pratik başlat</button>
      <button onClick={refresh} className="min-h-[44px] self-end px-4 py-3 rounded glass-inner">Son durumu yükle</button>
    </fieldset>
    {error && <p role="alert" className="text-amber-500">{error}</p>}
    {state && <>
      <p className="text-sm">{state.symbol} · {state.source} · Son görülen mum: {new Date(state.bars.at(-1).time).toLocaleString('tr-TR')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['Pratik nakdi', state.cash], ['Pozisyon değeri', state.equity - state.cash], ['Net sonuç', state.pnl], ['Toplam komisyon', state.fees]].map(([label, value]) => <div key={String(label)} className="glass-card p-4 rounded-xl"><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono">{money(Number(value))}</p></div>)}</div>
      <div className="glass-card p-3 rounded-xl h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={state.bars}><XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} /><YAxis domain={['auto', 'auto']} width={75} /><Tooltip formatter={(v: number) => money(v)} labelFormatter={t => new Date(t).toLocaleString('tr-TR')} /><Line dataKey="close" stroke="#3B82F6" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
      <p className="text-xs text-muted-foreground">İşlemler görünen son mumun kapanış fiyatıyla yapılır. Her yönde %0,2 komisyon uygulanır. Kalan mum: {state.stepsRemaining}. Geçmiş veriler bölünme/düzeltme içerebilir.</p>
      <fieldset disabled={busy || state.finished} className="glass-card p-4 rounded-xl space-y-3">
        <p>Açık miktar: {state.quantity} adet</p>
        <label className="block text-sm">Miktar<input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} className="block w-full glass-inner p-3 rounded" /></label>
        <label className="block text-sm">İşlem gerekçem<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} className="block w-full glass-inner p-3 rounded" /></label>
        <div className="flex flex-wrap gap-2">{[['BUY', 'Sanal al'], ['SELL', 'Sanal sat'], ['NEXT', 'Sonraki mum'], ['FINISH', 'Bitir ve değerlendir']].map(([action, text]) => <button key={action} onClick={() => send(action)} disabled={action === 'NEXT' && !state.stepsRemaining} className="min-h-[44px] px-4 rounded-lg glass-inner disabled:opacity-50">{text}</button>)}</div>
      </fieldset>
      {state.assessment && <section className="glass-card rounded-xl p-4 space-y-2"><h2 className="font-semibold">Pratik değerlendirmesi</h2>{state.assessment.map((t: string) => <p key={t} className="text-sm">{t}</p>)}</section>}
      <details className="glass-card p-4 rounded-xl"><summary className="min-h-[44px]">Karar günlüğü ({state.trades.length})</summary>{state.trades.map((t: any, i: number) => <p key={i} className="py-2 border-t border-white/10 text-sm">{t.side === 'BUY' ? 'Alış' : 'Satış'} · {t.quantity} adet · {money(t.price)} · Komisyon {money(t.commission)} · {t.note || 'Not yok'}</p>)}</details>
    </>}
  </div>;
}
