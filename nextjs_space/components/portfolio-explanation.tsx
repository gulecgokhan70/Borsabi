import Link from 'next/link';
import { formatCurrency } from '@/lib/constants';
import type { PortfolioExplanation as Explanation } from '@/lib/portfolio-explanation';

const signed = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`;
export function PortfolioExplanation({ data }: { data: Explanation }) {
  const incomplete = data.missingBreakdowns > 0 || Math.abs(data.unexplained) >= 0.01;
  return <section className="glass-card rounded-xl p-4 space-y-3" aria-labelledby="portfolio-explanation-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="portfolio-explanation-title" className="font-semibold">Portföyüm neden değişti?</h2>
      <span className="text-xs text-muted-foreground">Başlangıçtan bugüne · TL</span>
    </div>
    <p className="text-sm">Başlangıçtaki {formatCurrency(data.initialBalance)} sanal portföyün, son değerlemeye göre {formatCurrency(data.currentValue)} oldu. Net değişim: <strong>{signed(data.netChange)}</strong>.</p>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div><dt className="text-muted-foreground">Satılan miktarlardan net sonuç</dt><dd className="font-semibold">{signed(data.realizedNet)}</dd></div>
      <div><dt className="text-muted-foreground">Açık pozisyonların net sonucu</dt><dd className="font-semibold">{signed(data.openNet)}</dd></div>
    </dl>
    {data.hasStalePrices && <p className="text-xs text-muted-foreground">Bazı varlıklarda son bilinen fiyat kullanılıyor; bu sonuç güncel olmayabilir.</p>}
    <details className="border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
      <summary className="cursor-pointer min-h-[44px] flex items-center text-sm text-blue-500">Fiyat, kur ve komisyon katkısını gör</summary>
      <dl className="space-y-2 text-sm">
        {[[incomplete ? 'Ayrıştırılabilen fiyat etkisi' : 'Fiyat etkisi', data.priceEffect], [incomplete ? 'Ayrıştırılabilen kur etkisi' : 'Kur etkisi', data.fxEffect], ['Ödenen toplam komisyon', -data.commissions], ...(incomplete ? [['Ayrıştırılamayan fark', data.unexplained]] : [])].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-mono shrink-0">{signed(Number(value))}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground mt-3">Fiyat etkisi, varlığın kendi para birimindeki değişimidir. Kur etkisi, doların TL karşılığındaki değişimdir. Komisyonlar net sonuca zaten dahildir; tekrar düşülmez. Açık pozisyonlar için gelecekteki satış komisyonu dahil değildir.</p>
      {incomplete && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Bazı eski kayıtların fiyat/kur ayrımı eksik veya hesap ile kayıtlar arasında fark var. Ayrıştırılamayan tutar bir kazanç türüne atanmadı.</p>}
      {!!data.contributors.length && <ul className="mt-3 divide-y divide-black/[0.06] dark:divide-white/[0.06]">
        {data.contributors.map(item => <li key={item.symbol} className="py-2 flex flex-wrap justify-between gap-2 text-sm">
          <span>{item.symbol}</span><span>{item.incomplete ? 'Katkı ayrımı eksik' : signed(item.net)}</span>
        </li>)}
      </ul>}
      <Link href="/trade-log" className="inline-flex min-h-[44px] items-center text-sm text-blue-500 underline">İşlem günlüğünü incele</Link>
    </details>
  </section>;
}
