'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TransactionSummary } from '@/lib/transaction-summary';
import { formatCurrency, formatNumber } from '@/lib/constants';
type SummaryData = { end: string; summary: TransactionSummary & { winRate: number }; suggestions: { text: string; href: string; action: string }[] };
export function LearningSummary() {
  const [days, setDays] = useState(7), [retry, setRetry] = useState(0);
  const [data, setData] = useState<SummaryData | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    fetch(`/api/learning-summary?days=${days}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Özet alınamadı.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, retry]);
  const s = data?.summary;
  return <section aria-label="Öğrenme özeti" className="glass-card rounded-2xl p-4 space-y-4">
    <div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="text-lg font-semibold">Öğrenme özetim</h2><div className="flex gap-2">{[7, 30].map(value => <button key={value} aria-pressed={days === value} onClick={() => setDays(value)} className={`min-h-[44px] px-3 rounded-lg ${days === value ? 'bg-blue-600 text-white' : 'glass-inner'}`}>Son {value} gün</button>)}</div></div>
    {loading && <p role="status">İşlem kayıtlarınız özetleniyor…</p>}
    {error && <div role="alert"><p>{error}</p><button className="min-h-[44px] text-blue-500" onClick={() => setRetry(value => value + 1)}>Tekrar dene</button></div>}
    {s && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Alış / satış', `${s.buyCount} / ${s.sellCount}`], ['Gerçekleşen net K/Z', formatCurrency(s.totalPnl)], ['Dönemde kesilen komisyon', formatCurrency(s.totalCommission)], ['Kayıtlı satışlarda kazanç', s.totalTrades ? `%${formatNumber(s.winRate, 1)}` : 'Henüz satış yok']].map(([label, value]) => <div className="glass-inner rounded-xl p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono font-semibold mt-2 break-words">{value}</p></div>)}</div>
      <p className="text-sm">Karar notu: <strong>{s.withNote}/{s.total}</strong> işlem · Alış anında zarar kes kaydı: <strong>{s.buysWithStop}/{s.buyCount}</strong></p>
      {!!s.attributedSales && <p className="text-sm">Ayrıştırılabilen {s.attributedSales} satışta fiyat etkisi: {formatCurrency(s.pricePnl)} · Kur etkisi: {formatCurrency(s.fxPnl)}</p>}
      {s.attributedSales < s.sellCount && <p className="text-xs text-muted-foreground">{s.sellCount - s.attributedSales} satış için fiyat/kur ayrımı mevcut değil; eksik geçmiş tahmin edilmedi.</p>}
      <ul className="space-y-2">{data!.suggestions.map(item => <li key={item.action} className="glass-inner rounded-xl p-3"><p className="text-sm">{item.text}</p><Link href={item.href} className="inline-flex min-h-[44px] items-center text-sm text-blue-500">{item.action} →</Link></li>)}</ul>
      <p className="text-xs text-muted-foreground">Bu özet kayıtlı sanal işlemlerden hesaplanır. Net K/Z, satış kayıtlarında alış ve satış komisyonlarını zaten içerir; dönem komisyonu ayrıca düşülmez. Açık pozisyonların değişimi dahil değildir. Güncelleme: {new Date(data!.end).toLocaleString('tr-TR')}.</p>
    </>}
  </section>;
}
