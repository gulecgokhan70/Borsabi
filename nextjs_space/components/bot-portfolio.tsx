'use client';
import Link from 'next/link';
import { PositionSummary } from '@/app/bot-lab/position-summary';
import type { AutoState, AutoConfig, AutoEvent } from '@/lib/bot-lab/auto-engine';
import { assetHref, assetLabel } from '@/lib/bot-lab/catalog';
const money = (v: number) => v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
export function BotPortfolio({ bots }: { bots: { id: string; market: string; config: AutoConfig; state: AutoState; events: { id: string; data: AutoEvent }[] }[] }) {
  return <section className="glass-card rounded-2xl p-5 space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Bot işlemleri</h2><Link href="/bot-lab" className="text-blue-600 underline">Botları yönet</Link></div>
    {!bots.length && <p className="text-sm text-muted-foreground">Ortak portföye bağlı bot yok. Mevcut botları yukarıdaki bütçe ayarından taşıyabilirsiniz.</p>}
    {bots.map(b => <div key={b.id} className="border-t pt-4 space-y-3"><h3 className="font-semibold">Bot · {b.market === 'BIST' ? 'Hisse' : 'Kripto'}</h3>
      <PositionSummary holdings={b.state.holdings} config={b.config} clock={Date.now()} />
      <details><summary className="cursor-pointer py-2">Bot işlem geçmişi · son 20 kayıt</summary>{b.events.map(({ id, data: e }) => <div key={id} className="border-t py-3 text-sm space-y-1"><p className="font-medium">Bot · {e.transfer ? 'Pozisyon aktarımı' : e.action === 'BUY' ? 'Alış' : 'Satış'} · <Link href={assetHref(e.symbol!)} className="text-blue-600 underline">{assetLabel(e.symbol!)}</Link></p><p>{new Date(e.time).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p><p>{e.quantity?.toLocaleString('tr-TR', { maximumFractionDigits: 8 })} adet · İşlem tutarı {money(e.quantity! * e.price!)} · Komisyon {money(e.fee || 0)}</p>{e.pnl !== undefined && <p>Net sonuç: {money(e.pnl)}</p>}<p className="text-muted-foreground">{e.reason}</p></div>)}</details>
    </div>)}
  </section>;
}
