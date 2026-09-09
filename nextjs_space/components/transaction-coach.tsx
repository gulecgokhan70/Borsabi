'use client';
import { useState } from 'react';
import { formatCurrency } from '@/lib/constants';
import { ReportAIResponse } from '@/components/report-ai-response';
export function TransactionCoach({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { const r = await fetch('/api/trade-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }
    catch (e) { setError(e instanceof Error ? e.message : 'Değerlendirme alınamadı.'); } finally { setBusy(false); }
  }
  return <div className="text-xs sm:max-w-xs">
    <button disabled={busy} onClick={load} className="min-h-[44px] px-3 glass-inner rounded-lg">{busy ? 'Değerlendiriliyor…' : 'İşlem koçu'}</button>
    {error && <p role="alert">{error}</p>}
    {data && <details open className="space-y-2 mt-2"><summary className="cursor-pointer">İşlem değerlendirmesi</summary>
      <dl className="grid grid-cols-2 gap-2">
        {[['Nakit değişimi', data.facts.cashChangeTry], ['Bu işlem komisyonu', data.facts.commissionTry], ['Fiyat etkisi', data.facts.pricePnlTry], ['Kur etkisi', data.facts.fxPnlTry], ['Satılan payın alış komisyonu', data.facts.buyCommissionTry], ['Gerçekleşen net K/Z', data.facts.pnlTry], ['Planlanan stop riski (komisyonsuz)', data.facts.plannedRiskTry]].map(([label, value]) => <div key={String(label)} className="contents"><dt>{label}</dt><dd>{value == null ? 'Kayıt yok / uygulanmaz' : formatCurrency(Number(value))}</dd></div>)}
      </dl>
      <p className="whitespace-pre-wrap">{data.commentary}</p>
      <ReportAIResponse content={data.commentary || ''} source="trade-coach" />
      <p className="text-muted-foreground">Kaynak: {data.source.label} · {new Date(data.source.asOf).toLocaleString('tr-TR')}</p>
      <p className="text-muted-foreground">Tutarlar işlem kaydına dayanır; AI açıklaması hata içerebilir.</p>
    </details>}
  </div>;
}
