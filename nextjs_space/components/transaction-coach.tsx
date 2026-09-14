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
      <section className="glass-inner rounded-lg p-3 space-y-2">
        <h3 className="font-semibold">İşlem anındaki gerekçem ve planım</h3>
        {!data.decisionHistory?.linked && <p>Bu eski satışın alış kayıtlarıyla bağlantısı yok. Gerekçe eşleştirmesi tahmin edilmedi.</p>}
        {data.decisionHistory?.linked && !data.decisionHistory.purchases.length && <p>Bağlantılı alış kaydı bulunamadı.</p>}
        {data.decisionHistory?.purchases.map((purchase: any) => <div key={purchase.id} className="border-b border-black/10 dark:border-white/10 pb-2">
          <p>{new Date(purchase.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Türkiye saati) · {purchase.quantity} adet</p>
          <p className="whitespace-pre-wrap break-words">{purchase.note?.trim() || 'Bu alışta gerekçe yazılmamış.'}</p>
          <p>Zarar kes: {purchase.stopLoss ?? 'Kayıt yok'} · Kâr al: {purchase.takeProfit ?? 'Kayıt yok'} ({data.facts.currency === 'USD' ? 'USD' : 'TL'})</p>
        </div>)}
        {data.decisionHistory?.hasMore && <p>İlk 20 alış gösteriliyor; diğer kayıtlar işlem günlüğünde.</p>}
        <p>Notlar aynı pozisyonun alışlarına aittir. Kısmi satışta tek bir alışın getirisi olarak yorumlanmaz; eski bağlantısız alışlar burada yer almayabilir.</p>
      </section>
      <dl className="grid grid-cols-2 gap-2">
        {[['Nakit değişimi', data.facts.cashChangeTry], ['Bu işlem komisyonu', data.facts.commissionTry], ['Fiyat etkisi', data.facts.pricePnlTry], ['Kur etkisi', data.facts.fxPnlTry], ['Satılan payın alış komisyonu', data.facts.buyCommissionTry], ['Gerçekleşen net K/Z', data.facts.pnlTry], ['Planlanan stop riski (komisyonsuz)', data.facts.plannedRiskTry]].filter(([label]) => label !== 'Kur etkisi' || data.facts.currency === 'USD').map(([label, value]) => <div key={String(label)} className="contents"><dt>{label}</dt><dd>{value == null ? 'Kayıt yok / uygulanmaz' : formatCurrency(Number(value))}</dd></div>)}
      </dl>
      <p>Net sonuç alış ve satış komisyonlarını zaten içerir; komisyonları bir kez daha düşme. Planladığın koşullar gerçekleşti mi, kararın gerekçenle uyumlu muydu?</p>
      <p className="whitespace-pre-wrap">{data.commentary}</p>
      <ReportAIResponse content={data.commentary || ''} source="trade-coach" />
      <p className="text-muted-foreground">Kaynak: {data.source.label} · {new Date(data.source.asOf).toLocaleString('tr-TR')}</p>
      <p className="text-muted-foreground">Tutarlar işlem kaydına dayanır; AI açıklaması hata içerebilir.</p>
    </details>}
  </div>;
}
