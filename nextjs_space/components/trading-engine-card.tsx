'use client';
import { useEffect, useState } from 'react';
import type { EngineDecision, Timeframe } from '@/lib/trading-engine/types';
import { EngineBacktestPanel } from './trading-engine-backtest';
const regimes: Record<string, string> = { TREND_UP: 'Yükselen trend', TREND_DOWN: 'Düşen trend', RANGE: 'Yatay piyasa',
  HIGH_VOLATILITY: 'Yüksek oynaklık', LOW_VOLATILITY: 'Düşük oynaklık', UNCERTAIN: 'Belirsiz' };
const strategies: Record<string, string> = { TREND_FOLLOWING: 'Trend takibi', MOMENTUM: 'Momentum', MEAN_REVERSION: 'Ortalamaya dönüş', BREAKOUT: 'Kırılım' };
export function TradingEngineCard({ symbol }: { symbol: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [decision, setDecision] = useState<EngineDecision | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setDecision(null); setError(''); setLoading(true);
    void fetch(`/api/trading-engine?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => { const body = await res.json(); if (!res.ok) throw new Error(body.error || 'Analiz alınamadı.'); return body; })
      .then(body => { if (!controller.signal.aborted) setDecision(body); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Analiz alınamadı.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [symbol, timeframe, revision]);
  return <section className="glass-card rounded-2xl p-4 space-y-3" aria-label="İşlem motoru analizi">
    <div className="flex flex-wrap justify-between gap-2 items-center">
      <h2 className="font-semibold">İşlem Motoru V2</h2>
      <select aria-label="Analiz zaman aralığı" className="glass-inner rounded-lg p-2 text-sm" value={timeframe} onChange={e => setTimeframe(e.target.value as Timeframe)}>
        <option value="1d">Günlük</option><option value="1h">1 saat</option><option value="15m">15 dakika</option>
      </select>
    </div>
    <div aria-live="polite">
      {loading && <p className="text-sm text-muted-foreground">Kapanmış mumlar analiz ediliyor…</p>}
      {error && <div className="text-sm"><p role="alert">{error}</p><button className="glass-btn rounded-lg px-3 py-2 mt-2" onClick={() => setRevision(n => n + 1)}>Tekrar dene</button></div>}
      {decision && <>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Piyasa rejimi</dt><dd>{regimes[decision.analysis.regime.regime]}</dd></div>
          <div><dt className="text-muted-foreground">Sinyal puanı</dt><dd>{decision.signal.score}/100</dd></div>
          <div><dt className="text-muted-foreground">Kural güveni</dt><dd>%{Math.round(decision.signal.confidence * 100)}</dd></div>
          <div><dt className="text-muted-foreground">Durum</dt><dd>{decision.signal.direction === 'LONG' ? 'Alım koşulları oluştu' : 'Yeni alım onayı yok'}</dd></div>
        </dl>
        {decision.signal.strategy && <p className="text-sm">Strateji: {strategies[decision.signal.strategy] ?? decision.signal.strategy}</p>}
        <p className="text-xs text-muted-foreground">{decision.analysis.status !== 'READY' ? 'Geçerli ve yeterli geçmiş veri yok; sinyal engellendi.' : decision.signal.reasons.join(' ')}</p>
        {decision.signal.warnings.map((warning, n) => <p key={n} className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>)}
        {decision.analysis.lastClosedAt && <p className="text-xs text-muted-foreground">Son kapanmış mum: {new Date(decision.analysis.lastClosedAt).toLocaleString('tr-TR')}</p>}
      </>}
    </div>
    <p className="text-xs text-muted-foreground">Rejim, piyasanın hareket türüdür. Güven puanı kazanma olasılığı değildir. Bu analiz emir göndermez; yatırım tavsiyesi değildir.</p>
    <EngineBacktestPanel key={symbol + ':' + timeframe} symbol={symbol} timeframe={timeframe} />
  </section>;
}
