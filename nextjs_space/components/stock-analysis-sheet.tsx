'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { formatQuoteTime } from '@/lib/quote-metadata';

const words = (value: unknown) => typeof value === 'string' ? value : '';
export function StockAnalysisSheet({ symbol, name, analysis, generatedAt, loading, error, onGenerate, formatPrice }: {
  symbol: string; name: string; analysis: any; generatedAt: string | null;
  loading: boolean; error: string; onGenerate: () => void; formatPrice: (value: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const trend = analysis?.trend;
  const outlook = trend === 'YUKARI' ? 'Pozitif görünüm' : trend === 'AŞAĞI' ? 'Negatif görünüm' : trend === 'YATAY' ? 'Yatay görünüm' : 'Görünüm belirtilmedi';
  const color = trend === 'YUKARI' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'AŞAĞI' ? 'text-red-500' : 'text-muted-foreground';
  const sections = [
    ['Haberlerin olası etkisi', typeof analysis?.haber_etkisi === 'string' ? analysis.haber_etkisi : analysis?.haber_etkisi?.ozet],
    ['Fiyatın yönü', analysis?.teknik_analiz?.trend_analizi],
    ['Hareketin gücü', analysis?.teknik_analiz?.momentum],
    ['İşlem hacmi', analysis?.teknik_analiz?.hacim_analizi],
    ['Destek ve direnç', analysis?.teknik_analiz?.destek_direnc],
    ['Kısa vadeli senaryo', analysis?.strateji?.kisa_vade],
    ['Orta vadeli senaryo', analysis?.strateji?.orta_vade],
  ].filter(([, text]) => words(text));
  return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (value && !analysis && !loading) onGenerate(); }}>
    <section aria-label="Hisse analiz özeti" className="py-5 md:py-8">
      <p className="text-sm text-muted-foreground mb-2">{generatedAt ? `AI analizi · ${formatQuoteTime(generatedAt)}` : 'BorsaBi AI analizi'}</p>
      <p className="text-lg leading-relaxed line-clamp-3">{words(analysis?.genel_gorunum) || 'Fiyat hareketini, teknik göstergeleri ve haberleri birlikte incele.'}</p>
      <Dialog.Trigger className="inline-flex min-h-[44px] items-center gap-2 font-semibold mt-3">Analizi gör <ArrowRight className="w-4 h-4" /></Dialog.Trigger>
    </section>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
      <Dialog.Content aria-describedby={undefined} className="stock-focus fixed inset-0 z-[91] flex flex-col bg-white dark:bg-[#0d0d0d] text-foreground pt-[env(safe-area-inset-top)]">
        <div className="shrink-0 px-4 py-2"><Dialog.Close aria-label="Analizi kapat" className="w-11 h-11 grid place-items-center"><ArrowLeft className="w-6 h-6" /></Dialog.Close></div>
        <article className="w-full max-w-3xl mx-auto flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 md:px-8 pb-8">
          <Dialog.Title className="text-2xl font-semibold tracking-tight mb-1">{name} analizi</Dialog.Title>
          <p className="text-sm text-muted-foreground mb-9">{generatedAt ? `Oluşturulma: ${formatQuoteTime(generatedAt)}` : 'Teknik veriler ve haberler üzerinden değerlendirme'}</p>
          {loading ? <div role="status" className="py-12 flex items-center gap-3 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Analiz hazırlanıyor…</div>
            : error ? <div role="alert" className="space-y-3"><p>{error}</p><button onClick={onGenerate} className="min-h-[44px] text-indigo-600 dark:text-indigo-400 font-medium">Tekrar dene</button></div>
            : analysis ? <div className="space-y-8">
              <div><p className={`font-semibold text-lg mb-4 ${color}`}>{outlook}</p><p className="text-xl leading-relaxed font-medium">{words(analysis.genel_gorunum)}</p></div>
              {sections.map(([title, content]) => <section key={title}><h2 className="font-semibold text-lg mb-3">{title}</h2><p className="text-base leading-7 whitespace-pre-line">{words(content)}</p></section>)}
              {Array.isArray(analysis.haber_etkisi?.onemli_gelismeler) && <ul className="list-disc pl-5 space-y-3">{analysis.haber_etkisi.onemli_gelismeler.filter((item: unknown) => words(item)).map((item: string, index: number) => <li key={index} className="leading-7">{item}</li>)}</ul>}
              {analysis.onemli_seviyeler && <section><h2 className="font-semibold text-lg mb-4">Önemli seviyeler</h2><dl className="grid grid-cols-2 gap-5">{[['Destek 1', 'destek1'], ['Destek 2', 'destek2'], ['Direnç 1', 'direnc1'], ['Direnç 2', 'direnc2']].map(([label, key]) => {
                const value = analysis.onemli_seviyeler[key];
                return typeof value === 'number' && Number.isFinite(value) && value > 0 ? <div key={key}><dt className="text-muted-foreground text-sm">{label}</dt><dd className="font-medium mt-1">{formatPrice(value)}</dd></div> : null;
              })}</dl></section>}
              {Array.isArray(analysis.riskler) && analysis.riskler.length > 0 && <section><h2 className="text-lg font-semibold mb-3">Dikkat edilmesi gerekenler</h2><ul className="list-disc pl-5 space-y-3">{analysis.riskler.filter((item: unknown) => words(item)).map((item: string, index: number) => <li key={index} className="leading-7">{item}</li>)}</ul></section>}
              <details className="text-sm text-muted-foreground"><summary className="min-h-[44px] cursor-pointer">Model değerlendirmesi ve terimler</summary><p className="leading-6">EMA: son fiyatlara ağırlık veren ortalama. RSI: fiyat hareketinin gücü. MACD: iki ortalamanın farkı. Destek ve direnç: fiyatın tepki verebileceği seviyeler.</p><p className="mt-3">Modelin sinyal etiketi: {words(analysis.sinyal) || 'Yok'}. Modelin kendi güven puanı: {typeof analysis.guven_skoru === 'number' ? `${analysis.guven_skoru}/100` : 'Yok'}. Bu puan ölçülmüş tahmin başarısı değildir.</p></details>
              <button onClick={onGenerate} className="min-h-[44px] inline-flex items-center gap-2 text-muted-foreground text-sm"><RefreshCw className="w-4 h-4" /> Analizi yenile</button>
            </div> : <p>Analiz henüz oluşturulmadı.</p>}
          <p className="text-xs text-muted-foreground leading-5 mt-8">AI tarafından oluşturulan yorumdur; veriler gecikmeli olabilir. Eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
        </article>
        <div className="shrink-0 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><Link href={`/ai-assistant?symbol=${encodeURIComponent(symbol)}`} className="max-w-3xl mx-auto min-h-[48px] rounded-full bg-foreground text-background font-semibold flex items-center justify-center gap-2"><Sparkles className="w-5 h-5" /> Analizi derinleştir</Link></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
