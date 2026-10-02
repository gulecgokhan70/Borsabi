'use client';
import { useEffect, useState } from 'react';
import { bistDataStatus, bistSummary, type QuoteInfo } from '@/lib/market-data-status';
import { formatQuoteTime } from '@/lib/quote-metadata';

export function QuoteTime({ info = {}, className = '' }: { info?: QuoteInfo; className?: string }) {
  return <p className={`text-[11px] text-muted-foreground break-words ${className}`}>Fiyat zamanı: {formatQuoteTime(info.priceAsOf)} · {info.priceSource || 'Kaynak bilinmiyor'}</p>;
}

export function BistDataNotice({ info, rows }: { info?: QuoteInfo; rows?: QuoteInfo[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const status = now === null ? null : bistDataStatus(info || bistSummary(rows || [], now), now);
  return <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs space-y-1" aria-label="BIST seans ve veri durumu">
    <p>{status?.session || 'Seans bilgisi yükleniyor'} · {status?.data || 'Veriler yaklaşık 15 dakika gecikmeli'}</p>
    <details className="text-muted-foreground"><summary className="cursor-pointer py-1">Veri saatleri</summary><p>{status?.detail || 'Normal açılış 10:00; gecikmeli açılış verileri 10:15 civarında beklenir.'} Fiyat zamanı ile son kontrol zamanı farklıdır. Veriler 10:15 sonrasında da gecikmelidir.</p></details>
  </div>;
}
