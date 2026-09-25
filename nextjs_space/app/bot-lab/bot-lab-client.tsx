'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { botCatalog, assetHref, assetLabel } from '@/lib/bot-lab/catalog';
import { Bot, Pause, Play } from 'lucide-react';
import { PositionSummary } from './position-summary';
import { INITIAL, Market } from '@/lib/bot-lab/engine';
import { AutoConfig, AutoState, AutoEvent, universe } from '@/lib/bot-lab/auto-engine';
import { PRIORITY_LIMIT, quoteAgeLabel } from '@/lib/bot-lab/priority';
type Row = { id: string; market: Market; symbol: string; running: boolean; state: AutoState; config: AutoConfig; message: string; checkedAt: string | null; events: { id: string; data: AutoEvent }[] };
const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const date = (n: number | string | null) => n ? new Date(n).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'Henüz yok';
const input = 'w-full rounded-xl border border-black/10 dark:border-white/10 bg-background p-3';
const button = 'rounded-xl px-4 py-3 min-h-[44px] border border-black/10 dark:border-white/10 disabled:opacity-40';
export function BotLabClient() {
  const [bots, setBots] = useState<Row[]>([]), [market, setMarket] = useState<Market>('BIST');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState(universe.BIST.map(v => v.symbol));
  const [commission, setCommission] = useState(0.1), [profileCommission, setProfileCommission] = useState(0);
  const [order, setOrder] = useState(5), [daily, setDaily] = useState(2), [stop, setStop] = useState(2), [target, setTarget] = useState(4);
  const [friction, setFriction] = useState(0.1), [maxPositions, setMaxPositions] = useState(3);
  const [online, setOnline] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [clock, setClock] = useState(0);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const generationId = ++generation.current;
    setClock(Date.now());
    try {
      const response = await fetch('/api/bot-lab', { cache: 'no-store' });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (generationId !== generation.current) return;
      setBots(body.bots); setOnline(body.workerOnline); setProfileCommission(body.commission * 100);
    } catch (e) { if (generationId === generation.current) setError(e instanceof Error ? e.message : 'Bağlantı kurulamadı.'); }
    finally { if (generationId === generation.current) setLoading(false); }
  }, []);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => { invalidate(); clearInterval(timer); }; }, [load, invalidate]);
  async function request(method: string, body: unknown) {
    setBusy(true); setError(''); generation.current++;
    try {
      const response = await fetch('/api/bot-lab', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  }
  const fields = [
    { title: 'İşlem başına portföy (%)', value: order, set: setOrder, min: 1, max: 10, step: 1 },
    { title: 'Günlük zarar sınırı (%)', value: daily, set: setDaily, min: 0.5, max: 5, step: 0.5 },
    { title: 'Pozisyon zarar sınırı (%)', value: stop, set: setStop, min: 0.5, max: 10, step: 0.5 },
    { title: 'Kâr hedefi (%)', value: target, set: setTarget, min: 1, max: 20, step: 0.5 },
    { title: 'En fazla açık pozisyon', value: maxPositions, set: setMaxPositions, min: 1, max: 3, step: 1 },
    { title: 'Fiyat kayması / işlem (%)', value: friction, set: setFriction, min: 0, max: 1, step: 0.01 },
  ];
  return <main className="space-y-6 text-foreground max-w-5xl mx-auto pb-8">
    <header className="rounded-2xl glass-card p-5 space-y-3"><div className="flex items-center gap-3"><Bot className="text-blue-500" /><h1 className="text-2xl font-bold">Bot Laboratuvarı</h1></div>
      <p>Bot tarasın, seçsin, sanal işlemleri yönetsin.</p><p className="text-sm text-muted-foreground">Her piyasa için ayrı 100.000 sanal TL. Normal portföyünüz etkilenmez. Gerçek emir gönderilmez.</p>
      <p className="text-sm text-muted-foreground">Gecikmeli verilerle sanal deneme. Kontrol sıklığı, fiyatın güncelliği değildir.</p>
      <p role="status" className="text-sm">{online ? '● Arka plan servisi çalışıyor' : '○ Arka plan servisi doğrulanamadı; otomatik işlemler henüz çalışmıyor olabilir.'}</p>
    </header>
    {error && <div role="alert" className="p-4 rounded-xl border border-red-400 text-red-600">{error}<button className={`${button} ml-2`} onClick={() => { setError(''); load(); }}>Tekrar dene</button></div>}
    {loading ? <p role="status">Botlar yükleniyor…</p> : <>
      {bots.length < 2 && <form className="glass-card rounded-2xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); request('POST', { mode: 'auto-v2', market, scope, symbols: scope === 'all' ? [] : selected, commission: (market === 'BIST' ? profileCommission : commission) / 100, friction: friction / 100, orderFraction: order / 100, dailyLoss: daily / 100, stopLoss: stop / 100, takeProfit: target / 100, maxPositions }); }}>
        <h2 className="font-semibold text-xl">Otomatik seçimli sanal bot</h2>
        <label className="block">Piyasa<select className={`${input} mt-2`} value={market} onChange={e => { const m = e.target.value as Market; setMarket(m); setSelected(universe[m].map(v => v.symbol)); }}><option value="BIST">Borsa İstanbul</option><option value="CRYPTO">Kripto</option></select></label>
        <label className="block">Tarama kapsamı<select className={`${input} mt-2`} value={scope} onChange={e => setScope(e.target.value as 'all' | 'selected')}><option value="all">Tüm desteklenen varlıklar ({botCatalog[market].length})</option><option value="selected">Seçtiğim varlıklar</option></select></label>
        {scope === 'selected' && <fieldset><legend className="font-medium mb-2">Bot hangi varlıklar içinden seçsin?</legend><div className="flex flex-wrap gap-2">{universe[market].map(v => <div key={v.symbol} className={`${button} flex items-center gap-2 text-sm`}><label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(v.symbol)} onChange={e => setSelected(old => e.target.checked ? [...old, v.symbol] : old.filter(s => s !== v.symbol))} /><span>{assetLabel(v.symbol)}</span></label><Link href={assetHref(v.symbol)} prefetch={false} className="text-blue-600 underline" aria-label={`${assetLabel(v.symbol)} detayını aç`}>İncele</Link></div>)}</div></fieldset>}
        <p className="text-sm text-muted-foreground">Tüm kapsam: Borsabi kataloğundaki {botCatalog[market].length} varlık sırayla taranır; liste tüm dünya piyasalarını kapsamaz. En fazla {maxPositions} açık pozisyon. Mevcut grup sınırları korunur; her varlığın sektör sınıflaması henüz yoktur.</p>
        <details className="rounded-xl border p-3"><summary className="cursor-pointer font-medium">Risk ve masraf ayarları</summary><div className="grid sm:grid-cols-2 gap-4 mt-4">{fields.map(f => <label key={f.title} className="text-sm">{f.title}<input className={`${input} mt-1`} required type="number" min={f.min} max={f.max} step={f.step} value={f.value} onChange={e => f.set(e.target.valueAsNumber)} /></label>)}
          <label className="text-sm">Komisyon / işlem (%) {market === 'BIST' ? '— profilinden' : '— simülasyon varsayımı'}<input className={`${input} mt-1`} type="number" required min="0" max="1" step="0.001" disabled={market === 'BIST'} value={market === 'BIST' ? profileCommission : commission} onChange={e => setCommission(e.target.valueAsNumber)} /></label>
        </div><p className="text-xs text-muted-foreground mt-3">Masraflar alış ve satışta uygulanır. Fiyat kayması, beklenen ve gerçekleşen fiyatın farkıdır. Ayarlar oluşturma anında sabitlenir.</p></details>
        <p className="text-sm">Başlangıç: %{order} işlem bütçesi · %{daily} günlük zarar sınırı · %{stop} zarar / %{target} kâr hedefi.</p>
        <button className={`${button} bg-blue-600 text-white`} disabled={busy || (scope === 'selected' && !selected.length) || bots.some(b => b.market === market)}>{bots.some(b => b.market === market) ? 'Bu piyasanın botu mevcut' : 'Sanal botu oluştur'}</button>
      </form>}
      {bots.map(b => {
        const auto = b.config.mode === 'auto-v2';
        const active = auto ? b.running && !b.state.paused : b.running;
        return <section key={b.id} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-xl">{b.market === 'BIST' ? 'Hisse botu' : 'Kripto botu'}</h2><p className="text-sm text-muted-foreground">{auto ? 'Otomatik seçim · EMA20/50' : `Eski tek varlık botu · ${b.symbol}`} · {active ? 'Alım taraması açık' : 'Yeni alımlar kapalı'}</p></div>
            <button className={`${button} flex items-center gap-2`} disabled={busy || (auto && b.state.closeRequested)} onClick={() => request('PATCH', { id: b.id, action: active ? 'stop' : 'start' })}>{active ? <Pause size={16} /> : <Play size={16} />}{active ? 'Duraklat' : 'Başlat'}</button></div>
          <p role="status" className="rounded-xl bg-blue-500/10 p-3 text-sm">{b.message}</p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[['Son bilinen hesap değeri', money(b.state.equity)], ['Net sonuç', money(b.state.equity - INITIAL)], ['Nakit', money(b.state.cash)], ['Komisyon toplamı', money(b.state.fees)], ['En büyük düşüş', `%${b.state.drawdown.toFixed(2)}`], ['Fiyat kayması toplamı', money(b.state.frictionCost)]].map(([title, value]) => <div key={title} className="rounded-xl glass-inner p-3"><dt className="text-xs text-muted-foreground">{title}</dt><dd className="mt-1 font-semibold break-words">{value}</dd></div>)}</dl>
          <p className="text-xs text-muted-foreground">Son kontrol: {date(b.checkedAt)} (Türkiye saati). Değerleme son bilinen fiyatları kullanır; henüz yapılmamış satışın masrafları dahil değildir.</p>
          {auto && <>
            <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-medium">Veri zamanı ve tarama sıklığı</summary><div className="mt-2 space-y-2 text-muted-foreground">
              <p>Kaynak: Yahoo Finance. {b.market === 'BIST' ? 'Hisse fiyatları gecikmeli olabilir; her fiyatın zamanı aşağıda gösterilir.' : 'Kripto için doğrudan borsa canlı veri bağlantısı henüz yok.'}</p>
              <p>15 dakikalık kapanmış mumlar kullanılır. Her kontrol turunun ardından 60 saniye beklenir; veri çekme süresi buna eklenir. Mum kapanışını ve kaynak verisini beklemek ek gecikme oluşturur.</p>
              <p>Alım sinyalinin görüldüğü zamandan sonraya ait fiyat gelmeden sanal alım yapılmaz. Gecikmeli veride bu bekleme uzayabilir. Zarar/kâr çıkışları gözlenen fiyatla modellenir; kayıt saati ile fiyat saati farklı olabilir. Sonuçlar canlı işlem başarısını göstermez.</p>
            </div></details>
            <p className="text-sm text-muted-foreground">İşlem bütçesi %{b.config.orderFraction * 100} · En fazla {b.config.maxPositions} pozisyon · Komisyon %{(b.config.commission * 100).toFixed(3)} · Günlük sınır %{b.config.dailyLoss * 100}</p>
            <div className="rounded-xl border p-3 space-y-2 text-sm">
              <p className="font-semibold">{b.config.scope === 'all' ? `Tüm desteklenen varlıklar · ${botCatalog[b.market].length}` : `Seçili liste · ${b.config.symbols.length} varlık`}</p>
              {b.config.scope !== 'all' && <p className="flex flex-wrap gap-3">{b.config.symbols.map(symbol => <Link key={symbol} href={assetHref(symbol)} prefetch={false} className="text-blue-600 underline">{assetLabel(symbol)}</Link>)}</p>}
              {b.config.scope !== 'all' && <button className={button} disabled={busy} onClick={() => request('PATCH', { id: b.id, action: 'scan-all' })}>Tüm desteklenen varlıkları tara</button>}
              {b.config.scope === 'all' && <><p>Tarama gruplar halinde sürer; tam tur birkaç dakika veya daha uzun sürebilir. Açık pozisyonlar ve bekleyen emirler her kontrolde ayrıca izlenir.</p>{b.state.scan ? <><p>Ortak katalog turu: {b.state.scan.processed} / {b.state.scan.total} varlık kontrol edildi. Son grup: {b.state.scan.batchSize}.</p><progress className="w-full" aria-label="Katalog tarama ilerlemesi" value={b.state.scan.processed} max={b.state.scan.total} /><p className="text-muted-foreground">Son tamamlanan tur: {date(b.state.scan.cycleCompletedAt)}</p></> : <p>İlk katalog taraması bekleniyor.</p>}</>}
            </div>
            {b.config.scope === 'all' && <div className="rounded-xl border p-3 space-y-2 text-sm"><p className="font-semibold">Öncelikli izleme · en fazla {PRIORITY_LIMIT} aday</p><p className="text-muted-foreground">Güncel değerlendirmelerde puanı en az 40 olan adaylar her turda yeniden incelenir. Açık pozisyonlar ve bekleyen emirler önce kontrol edilir; tam katalog taraması devam eder.</p>
              {!!b.state.focus?.symbols.length ? <><p className="flex flex-wrap gap-3">{b.state.focus.symbols.map(symbol => <Link key={symbol} href={assetHref(symbol)} prefetch={false} className="text-blue-600 underline">{assetLabel(symbol)}</Link>)}</p><p className="text-muted-foreground">Son öncelikli kontrol: {date(b.state.focus.checkedAt)}</p></> : <p className="text-muted-foreground">{b.state.paused ? 'Yeni aday izleme duraklatıldı.' : 'Öncelikli izlenecek aday bekleniyor.'}</p>}</div>}
            {!!Object.keys(b.state.pending).length && <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Fiyat bekleyen sanal emirler ({Object.keys(b.state.pending).length})</summary><p className="text-xs text-muted-foreground my-2">Kaynak fiyat zamanı, sinyalin görüldüğü zamandan ileri olmalı. Süresi dolan emir uygulanmaz.</p>{Object.entries(b.state.pending).map(([symbol, pending]) => <div key={symbol} className="border-t py-3 text-sm space-y-1"><p><Link href={assetHref(symbol)} prefetch={false} className="text-blue-600 underline">{assetLabel(symbol)}</Link> · {pending.side === 'BUY' ? 'Alış' : 'Satış'}</p><p>Sinyalin görüldüğü zaman: {date(pending.after)}</p><p>Sinyal mumu kapanışı: {date(pending.signalBarTime || null)}</p><p>Sinyal fiyatının zamanı: {date(pending.signalQuoteTime || null)}</p><p>Son geçerlilik: {date(pending.expires)}</p></div>)}</details>}
            <PositionSummary holdings={b.state.holdings} config={b.config} clock={clock} />
            {!!Object.keys(b.state.holdings).length && <button className={`${button} text-red-600`} disabled={busy || b.state.closeRequested} onClick={() => { if (window.confirm('Bu botun tüm sanal pozisyonları sonraki geçerli fiyatla kapatılsın mı? Yeni alımlar da duraklatılır.')) request('PATCH', { id: b.id, action: 'close' }); }}>{b.state.closeRequested ? 'Kapatma bekleniyor' : 'Tüm sanal pozisyonları kapat'}</button>}
            <details><summary className="cursor-pointer font-semibold py-2">Adaylar ve seçim gerekçeleri ({b.state.candidates.length})</summary><p className="text-xs text-muted-foreground my-2">Her satır son değerlendirmeyi gösterir; tüm varlıklar aynı anda taranmaz. Puan kazanma olasılığı değildir. Trend, momentum (hareket gücü), hacim ve oynaklık uygunluğunu gösterir.</p>{!b.state.candidates.length && <p className="text-sm">İlk tarama bekleniyor.</p>}{b.state.candidates.map(c => <div key={c.symbol} className="border-b py-3 text-sm"><p className="font-semibold"><Link href={assetHref(c.symbol)} prefetch={false} className="text-blue-600 underline">{assetLabel(c.symbol)}</Link> · {c.score}/100 · {c.eligible ? 'Son taramada uygun' : 'Bekle'}</p><p>{c.reason}</p><p className="text-muted-foreground">Son değerlendirme: {date(c.checkedAt || null)}</p><p className="text-muted-foreground">Fiyat zamanı: {date(c.quoteTime || null)} · {quoteAgeLabel(c.quoteTime, clock)}</p><p className="text-muted-foreground">Son kapanmış mum: {date(c.barTime || null)} · Kaynak: {c.source || 'Eski kayıtta belirtilmemiş'}</p>{c.eligible && <p className="text-muted-foreground">Alım için yeni sinyal, portföy sınırları ve sonraki fiyat da gerekli.</p>}</div>)}</details>
          </>}
          <details><summary className="cursor-pointer font-semibold py-2">Karar günlüğü · son 50 kayıt</summary>{b.events.map(e => <div key={e.id} className="border-b py-3 text-sm"><p className="font-medium">{{ BUY: 'Sanal alış', SELL: 'Sanal satış', WAIT: 'Bekle', HALT: 'Zarar kilidi' }[e.data.action]} {e.data.symbol && <Link href={assetHref(e.data.symbol)} prefetch={false} className="text-blue-600 underline">{assetLabel(e.data.symbol)}</Link>} · {date(e.data.time)}</p><p>{e.data.reason}</p>{e.data.price !== undefined && <p>{e.data.quantity} adet · {money(e.data.price)} · Komisyon {money(e.data.fee || 0)}</p>}{(e.data.action === 'BUY' || e.data.action === 'SELL') && <div className="mt-2 text-xs text-muted-foreground space-y-1"><p>Sanal işlem kayıt zamanı: {date(e.data.time)}</p><p>Sinyal / karar zamanı: {date(e.data.signalAt || null)}</p>{e.data.signalBarTime && <p>Sinyal mumu kapanışı: {date(e.data.signalBarTime)}</p>}<p>Kullanılan fiyat zamanı: {date(e.data.quoteTime || null)} · {quoteAgeLabel(e.data.quoteTime, e.data.time)}</p><p>Kaynak: {e.data.source || 'Eski kayıtta belirtilmemiş'}</p>{!e.data.quoteTime && <p>Bu eski işlemin fiyat zamanı kaydedilmemiş.</p>}</div>}{e.data.pnl !== undefined && <p>İşlemin net sonucu: {money(e.data.pnl)}</p>}</div>)}</details>
        </section>;
      })}
    </>}
    <details className="text-sm rounded-xl border p-4"><summary className="cursor-pointer font-medium">Bot nasıl karar veriyor?</summary><div className="mt-3 space-y-3 text-muted-foreground"><p>Kapanmış 15 dakikalık mumlarla EMA20/50 kesişimi aranır. EMA, son fiyatlara daha fazla ağırlık veren ortalamadır. Hacim, momentum ve oynaklık filtresini geçen yeni sinyaller puanlanır. O kontrolde taranan gruptaki en yüksek puanlı uygun adaylar seçilir; bütün kataloğun eşzamanlı sıralaması değildir. İlk açılışta geçmiş sinyaller çalıştırılmaz.</p><p>Hisse ve kripto oynaklık eşikleri ayrıdır. Aynı gruptan bir pozisyon sınırı tam bir korelasyon (birlikte hareket) analizi değildir. Seçim kurallarının kazanç başarısı henüz doğrulanmadı.</p><p>Duraklat ve günlük zarar kilidi yeni alımları engeller; servis çalıştığı ve veri geldiği sürece açık pozisyonların çıkış kuralları devam eder. Ani fiyat sıçraması, gecikme ve veri kesintisinde zarar sınırında satış garanti değildir.</p><p>Yahoo Finance verisi gecikmeli olabilir. Kripto hesabı TL bazındadır; güncel USD/TL kuru yoksa işlemler bekler. Özellikle hafta sonu kesintisiz çalışma garanti edilmez. Bu sürüm ileriye dönük sanal test içindir.</p></div></details>
  </main>;
}
