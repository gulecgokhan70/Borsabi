'use client';
import { useEffect, useRef, useState } from 'react';
import type { Timeframe } from '@/lib/trading-engine/types';
type Summary = { finalCapital: number; totalReturn: number; maxDrawdown: number; totalTrades: number; winRate: number; totalCommission: number; profitFactor: number | null };
type Result = { mode: string; currency: string; summary?: Summary; finalCapital?: number; totalReturn?: number;
  capitalNote?: string; assumptions?: string[]; warnings?: string[];
  windows?: { trainEnd: number; testStart: number; testEnd: number; stopMultiplier: number; rewardRatio: number; test: { summary: Summary } }[] };
export function EngineBacktestPanel({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }) {
  const currency = symbol.endsWith('.IS') ? 'TRY' : 'USD';
  const [capital, setCapital] = useState(currency === 'TRY' ? '100000' : '1000');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Result | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const run = async (walkForward: boolean) => {
    if (pending.current) return;
    const value = Number(capital);
    if (!Number.isFinite(value) || value < 100 || value > 100000000) { setError('Sermaye 100–100.000.000 aralığında olmalı.'); return; }
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/trading-engine/backtest', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, timeframe, initialCapital: value, walkForward }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Test tamamlanamadı.');
      if (!controller.signal.aborted) setResult(body);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Test tamamlanamadı.'); }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  const number = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return <details className="glass-inner rounded-xl p-3">
    <summary className="cursor-pointer text-sm font-medium">Geçmiş veriyle test et · Pro</summary>
    <div className="space-y-3 mt-3 text-sm">
      <p className="text-xs text-muted-foreground">Backtest geçmiş fiyatlarla simülasyondur. Walk-forward, kuralları geçmiş bölümde seçip sonraki bölümde dener. Sonuçlar {currency}; TL/dolar geçmiş dönüşümü yapılmaz.</p>
      <label className="block">Sanal başlangıç sermayesi ({currency})
        <input className="glass-inner rounded-lg p-2 block mt-1 w-full" type="number" min="100" max="100000000" value={capital} onChange={e => setCapital(e.target.value)} disabled={busy} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="glass-btn rounded-lg px-3 py-2" disabled={busy} onClick={() => void run(false)}>Backtest çalıştır</button>
        <button className="glass-btn rounded-lg px-3 py-2" disabled={busy} onClick={() => void run(true)}>Walk-forward çalıştır</button>
      </div>
      <div aria-live="polite">
        {busy && <p>Geçmiş mumlar test ediliyor…</p>}
        {error && <p role="alert" className="text-red-500">{error}</p>}
        {result && <>
          <p>Son sermaye: {number(result.summary?.finalCapital ?? result.finalCapital ?? 0)} {result.currency} · Getiri: %{number(result.summary?.totalReturn ?? result.totalReturn ?? 0)}</p>
          {result.summary && <p>İşlem: {result.summary.totalTrades} · Kazançlı işlem: %{number(result.summary.winRate)} · En büyük gerileme: %{number(result.summary.maxDrawdown)} · Komisyon: {number(result.summary.totalCommission)} {result.currency}</p>}
          {result.windows && <div className="overflow-x-auto"><table className="w-full text-xs text-left"><caption className="text-left py-2">Geçmişten seçilen parametreler ve sonraki test sonuçları</caption><thead><tr><th className="p-2">Test başlangıcı</th><th className="p-2">ATR stop</th><th className="p-2">Hedef oranı</th><th className="p-2">Getiri</th></tr></thead><tbody>{result.windows.map(w => <tr key={w.testStart}><td className="p-2">{new Date(w.testStart).toLocaleDateString('tr-TR')}</td><td className="p-2">{w.stopMultiplier}×</td><td className="p-2">{w.rewardRatio}×</td><td className="p-2">%{number(w.test.summary.totalReturn)}</td></tr>)}</tbody></table></div>}
          {[...(result.assumptions ?? []), ...(result.warnings ?? []), ...(result.capitalNote ? [result.capitalNote] : [])].map((note, n) => <p key={n} className="text-xs text-muted-foreground">{note}</p>)}
        </>}
      </div>
    </div>
  </details>;
}
