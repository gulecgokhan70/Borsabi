'use client';

import Link from 'next/link';
import type { AutoConfig, Holding } from '@/lib/bot-lab/auto-engine';
import { assetHref, assetLabel } from '@/lib/bot-lab/catalog';
import { quoteAgeLabel } from '@/lib/bot-lab/priority';

const money = (value: number) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const signedMoney = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`;
const tone = (value: number) => value > 0 ? 'text-emerald-700 dark:text-emerald-400' : value < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';

export function PositionSummary({ holdings, config, clock }: {
  holdings: Record<string, Holding>;
  config: Pick<AutoConfig, 'stopLoss' | 'takeProfit'>;
  clock: number;
}) {
  const positions = Object.entries(holdings).map(([symbol, holding]) => {
    const cost = holding.quantity * holding.entry + holding.entryFee;
    const value = holding.quantity * holding.mark;
    return { symbol, holding, cost, value, pnl: value - cost };
  });
  if (!positions.length) return <div className="space-y-2"><h3 className="font-semibold">Açık sanal pozisyonlar</h3><p className="text-sm text-muted-foreground">Açık pozisyon yok. İlk alımdan sonra tutarlar ve karşılaştırma grafiği burada görünür.</p></div>;
  const totalCost = positions.reduce((sum, p) => sum + p.cost, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const maximum = Math.max(1, ...positions.flatMap(p => [p.cost, p.value]));
  return <div className="space-y-4">
    <h3 className="font-semibold">Açık sanal pozisyonlar</h3>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl glass-inner p-3"><dt className="text-xs text-muted-foreground">Toplam yatırılan</dt><dd className="font-semibold mt-1">{money(totalCost)}</dd></div>
      <div className="rounded-xl glass-inner p-3"><dt className="text-xs text-muted-foreground">Son bilinen değer</dt><dd className="font-semibold mt-1">{money(totalValue)}</dd></div>
      <div className="rounded-xl glass-inner p-3"><dt className="text-xs text-muted-foreground">Açık pozisyon kâr/zararı</dt><dd className={`font-semibold mt-1 ${tone(totalValue - totalCost)}`}>{signedMoney(totalValue - totalCost)}</dd></div>
    </dl>
    <figure className="rounded-xl border p-3 space-y-4" aria-label="Açık pozisyonların yatırılan tutar ve son bilinen değer karşılaştırması">
      <figcaption className="font-medium text-sm">Yatırılan tutar ve son değer</figcaption>
      {positions.map(p => <div key={p.symbol} className="space-y-2 text-sm">
        <Link href={assetHref(p.symbol)} prefetch={false} className="font-semibold text-blue-600 dark:text-blue-400 underline">{assetLabel(p.symbol)}</Link>
        {([['Yatırılan', p.cost, 'bg-blue-500'], ['Son değer', p.value, 'bg-violet-500']] as const).map(([label, value, color]) => <div key={label}>
          <div className="flex justify-between flex-wrap gap-x-3 text-xs mb-1"><span>{label}</span><span className="tabular-nums">{money(value)}</span></div>
          <div aria-hidden="true" className="h-3 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${value / maximum * 100}%` }} /></div>
        </div>)}
      </div>)}
      <p className="text-xs text-muted-foreground">Çubuklar sıfırdan başlar ve aynı TL ölçeğini kullanır. Açık pozisyonları karşılaştırır; geçmiş getiri grafiği değildir.</p>
    </figure>
    <p className="text-xs text-muted-foreground">Yatırılan tutara alış komisyonu dahildir. Kâr/zarar henüz gerçekleşmemiştir; satış masrafları dahil değildir. Son değer, aşağıdaki fiyat zamanlarına dayanır.</p>
    {positions.map(({ symbol, holding: h, cost, value, pnl }) => <article key={symbol} className="rounded-xl border p-3 text-sm space-y-3" aria-label={`${assetLabel(symbol)} pozisyonu`}>
      <div><Link href={assetHref(symbol)} prefetch={false} className="font-semibold text-blue-600 dark:text-blue-400 underline">{assetLabel(symbol)}</Link><p className="text-muted-foreground">{h.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 8 })} adet</p></div>
      <dl className="space-y-2">
        <div className="flex justify-between flex-wrap gap-x-3"><dt>Yatırılan tutar</dt><dd className="font-semibold tabular-nums">{money(cost)}</dd></div>
        <div className="flex justify-between flex-wrap gap-x-3"><dt>Son bilinen değer</dt><dd className="font-semibold tabular-nums">{money(value)}</dd></div>
        <div className="flex justify-between flex-wrap gap-x-3"><dt>Kâr/Zarar</dt><dd className={`font-semibold tabular-nums ${tone(pnl)}`}>{signedMoney(pnl)}{cost > 0 && ` (${pnl > 0 ? '+' : ''}${(pnl / cost * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%)`}</dd></div>
      </dl>
      <details className="border-t pt-2"><summary className="cursor-pointer py-1">Alış ve fiyat ayrıntıları</summary><div className="space-y-1 pt-2">
        <p>Birim alış fiyatı: {money(h.entry)}</p><p>Alış komisyonu: {money(h.entryFee)}</p><p>Son birim fiyat: {money(h.mark)}</p>
        <p>Zarar sınırı: {money(h.entry * (1 - config.stopLoss))} · Hedef: {money(h.entry * (1 + config.takeProfit))}</p>
      </div></details>
      <p className="text-xs text-muted-foreground">Fiyat zamanı: {h.quoteTime ? new Date(h.quoteTime).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'Bilinmiyor'} · {quoteAgeLabel(h.quoteTime, clock)}</p>
      <p className="text-xs text-muted-foreground">Kaynak: {h.source || 'Eski kayıtta belirtilmemiş'}</p>
    </article>)}
  </div>;
}
