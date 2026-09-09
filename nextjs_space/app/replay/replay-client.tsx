'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { BIST_ALL_ASSETS, CRYPTO_ASSETS, formatCurrency } from '@/lib/constants';
import { commissionLabel } from '@/lib/commission';
import { replayDate, type replayView } from '@/lib/replay';
import { SymbolSearch } from '@/components/symbol-search';
type Practice = ReturnType<typeof replayView> & { id: string; version: number; commissionRate: number };
const groups = [{ label: 'BIST', items: BIST_ALL_ASSETS }, { label: 'Kripto', items: CRYPTO_ASSETS }];
const dayOf = (s: Practice) => s.practiceDate ?? replayDate(s.bars[0].time);
export function ReplayClient() {
  const [state, setState] = useState<Practice | null>(null), [symbol, setSymbol] = useState('BTC-USD'), [date, setDate] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [qty, setQty] = useState(''), [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [bounds, setBounds] = useState({ min: '', max: '' });
  const locked = useRef(false);
  const accept = useCallback((d: Practice | { empty: true; commissionRate: number }) => {
    setRate(d.commissionRate);
    if ('empty' in d) { setState(null); return; }
    setState(d); setSymbol(d.symbol); setDate(dayOf(d));
  }, []);
  const load = useCallback(async () => {
    const r = await fetch('/api/replay', { cache: 'no-store' });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Pratik alınamadı.'); accept(d);
  }, [accept]);
  const refresh = useCallback(async () => {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Pratik alınamadı.'); }
    finally { locked.current = false; setBusy(false); }
  }, [load]);
  useEffect(() => {
    const yesterday = replayDate(Date.now() - 86400000);
    setBounds({ min: replayDate(Date.now() - 29 * 86400000), max: yesterday });
    setDate(yesterday); refresh();
  }, [refresh]);
  async function send(action?: string) {
    if (locked.current || (action && !state)) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const r = await fetch('/api/replay', { method: action ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action
        ? { id: state!.id, version: state!.version, action, quantity: ['BUY', 'SELL'].includes(action) ? Number(qty) : undefined, note }
        : { symbol, date }) });
      const d = await r.json();
      if (!r.ok) { if (r.status === 409) await load(); throw new Error(d.error); }
      accept(d); if (!action) { setQty(''); setNote(''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Sonuç doğrulanamadı; son durumu yükleyin.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const money = (v: number) => formatCurrency(v, state?.currency ?? 'TRY');
  const changed = !!state && (symbol !== state.symbol || date !== dayOf(state));
  return <div className="space-y-5">
    <h2 className="text-xl font-bold">Adım adım pratik</h2>
    <p className="text-sm text-muted-foreground">Geçmiş günü, sonraki fiyatları görmeden mum mum ilerletin ve alım-satım kararlarını kendiniz verin. Pratik bakiyeniz portföyünüzden ayrıdır: kriptoda USD, BIST’te TL kullanılır.</p>
    <fieldset disabled={busy} className="glass-card p-4 rounded-xl space-y-3 min-w-0">
      <legend className="text-sm font-semibold px-1">Yeni pratik ayarları</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><p className="text-sm mb-1">Sembol</p><SymbolSearch value={symbol} onChange={setSymbol} groups={groups} placeholder="Hisse veya kripto yazın..." /></div>
        <label className="text-sm">Geçmiş gün<input aria-label="Geçmiş gün" type="date" min={bounds.min} max={bounds.max} value={date} onChange={e => setDate(e.target.value)} className="block w-full min-w-0 glass-inner rounded p-3 min-h-[44px]" /></label>
      </div>
      <p className="text-xs text-muted-foreground">Son 30 gündeki tamamlanmış günlerden veri bulunan birini seçin. {rate != null ? `Profil komisyonunuz: alış ve satışta ${commissionLabel(rate)}.` : 'Profil komisyonu yükleniyor…'}</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => send()} disabled={!symbol || !date || rate == null} className="min-h-[44px] px-4 py-3 rounded bg-[#3B82F6] text-white disabled:opacity-50">Yeni pratik başlat</button>
        <button onClick={refresh} className="min-h-[44px] px-4 py-3 rounded glass-inner">Son durumu yükle</button>
      </div>
    </fieldset>
    {error && <p role="alert" className="text-amber-500">{error}</p>}
    {state && <>
      <section aria-label="Yüklü pratik" className="glass-inner rounded-lg p-3 space-y-1">
        <p className="text-sm font-semibold">Yüklü pratik: {state.symbol} · {new Date(`${dayOf(state)}T12:00:00+03:00`).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
        <p className="text-xs text-muted-foreground">{state.source} · Son görülen mum: {new Date(state.bars.at(-1)!.time).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
        {changed && <p role="status" className="text-sm text-amber-500">Yeni seçim henüz başlamadı. Aşağıda önceki pratik görünüyor; seçiminiz için “Yeni pratik başlat”a dokunun.</p>}
      </section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['Pratik nakdi', state.cash], ['Pozisyon değeri', state.equity - state.cash], ['Net sonuç', state.pnl], ['Toplam komisyon', state.fees]].map(([label, value]) => <div key={String(label)} className="glass-card p-4 rounded-xl"><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono">{money(Number(value))}</p></div>)}</div>
      <div className="glass-card p-3 rounded-xl h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={state.bars}><XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} /><YAxis domain={['auto', 'auto']} width={75} /><Tooltip formatter={(v: number) => money(v)} labelFormatter={t => new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} /><Line dataKey="close" stroke="#3B82F6" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
      <p className="text-xs text-muted-foreground">İşlemler görünen son mumun kapanış fiyatıyla yapılır. Profil komisyonu: {commissionLabel(state.commissionRate)}. Profilde oranı değiştirirseniz sonraki işlemler yeni oranla yapılır; geçmiş komisyonlar korunur. Kalan mum: {state.stepsRemaining}.</p>
      <fieldset disabled={busy || state.finished || changed} className="glass-card p-4 rounded-xl space-y-3">
        <p>Açık miktar: {state.quantity} adet</p>
        <label className="block text-sm">Miktar<input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} className="block w-full glass-inner p-3 rounded" /></label>
        <label className="block text-sm">İşlem gerekçem<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} className="block w-full glass-inner p-3 rounded" /></label>
        <div className="flex flex-wrap gap-2">{[['BUY', 'Sanal al'], ['SELL', 'Sanal sat'], ['NEXT', 'Sonraki mum'], ['FINISH', 'Bitir ve değerlendir']].map(([action, text]) => <button key={action} onClick={() => send(action)} disabled={action === 'NEXT' && !state.stepsRemaining} className="min-h-[44px] px-4 rounded-lg glass-inner disabled:opacity-50">{text}</button>)}</div>
      </fieldset>
      {state.assessment && <section className="glass-card rounded-xl p-4 space-y-2"><h3 className="font-semibold">Pratik değerlendirmesi</h3>{state.assessment.map(t => <p key={t} className="text-sm">{t}</p>)}</section>}
      <details className="glass-card p-4 rounded-xl"><summary className="min-h-[44px]">Karar günlüğü ({state.trades.length})</summary>{state.trades.map((t, i) => <p key={i} className="py-2 border-t border-white/10 text-sm">{t.side === 'BUY' ? 'Alış' : 'Satış'} · {t.quantity} adet · {money(t.price)} · Komisyon {money(t.commission)} ({commissionLabel(t.commissionRate ?? t.commission / (t.quantity * t.price))}) · {t.note || 'Not yok'}</p>)}</details>
    </>}
  </div>;
}
