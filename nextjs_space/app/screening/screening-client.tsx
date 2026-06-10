'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, Loader2, TrendingUp, Target, ShieldAlert, Zap, ArrowUpRight, ArrowDownRight, Crosshair, BarChart3, Activity, Newspaper, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { formatNumber, formatPercent, getScoreCategory, SCORE_LABELS } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';
import type { NewsImpact, StockWarning } from '@/lib/news-analysis';

function formatTimeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  return `${Math.floor(diff / 3600)} sa önce`;
}

export function ScreeningClient() {
  const router = useRouter();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<any>(null);
  const [marketOpen, setMarketOpen] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isFresh, setIsFresh] = useState(true);
  const [newsImpact, setNewsImpact] = useState<NewsImpact | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [showNewsDetail, setShowNewsDetail] = useState(false);

  // Haber analizi çek
  useEffect(() => {
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const res = await fetch('/api/news-analysis');
        const data = await res.json();
        if (data?.impact) setNewsImpact(data.impact);
      } catch {} finally { setNewsLoading(false); }
    };
    fetchNews();
  }, []);

  const getStockWarning = (symbol: string): StockWarning | null => {
    if (!newsImpact) return null;
    const clean = symbol?.replace('.IS', '').replace('-USD', '').toUpperCase();
    return newsImpact.stockWarnings.find(w => w.symbol.toUpperCase() === clean) ?? null;
  };

  const adjustScore = (score: number, symbol: string): number => {
    const w = getStockWarning(symbol);
    if (!w) return score;
    return Math.max(0, Math.min(100, score + Math.min(10, Math.max(-10, w.impact))));
  };

  const fetchScreening = useCallback(async () => {
    if (!cachedAt) setLoading(true); // Only show loader on first load
    try {
      const res = await fetch('/api/screening');
      const data = await res.json();
      setResults(data?.data ?? []);
      if (data?.marketOpen !== undefined) setMarketOpen(data.marketOpen);
      if (data?.cachedAt) setCachedAt(data.cachedAt);
      if (data?.fresh !== undefined) setIsFresh(data.fresh);

    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [cachedAt]);

  useEffect(() => {
    fetchScreening();
    const interval = setInterval(() => { fetchScreening(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 65) return '#3B82F6';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Hisse Tarama Motoru</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">BIST hisseleri için 5 kategori puanlama + Sapan/Dip-Bip/Formasyon tespiti</p>
            {cachedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full glass-inner text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${isFresh ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`} />
                {formatTimeAgo(cachedAt)}
              </span>
            )}
          </div>
        </div>
        <button onClick={fetchScreening} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Tara
        </button>
      </div>

      {!marketOpen && !loading && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
          <span className="text-[#F59E0B] text-lg">🔔</span>
          <p className="text-[#F59E0B] text-sm font-medium">Borsa şu an kapalı — son kapanış verileri üzerinden tarama yapılmıştır. Yarın açılışta tekrar tarayın.</p>
        </div>
      )}

      {/* Haber Analiz Banneri */}
      {newsImpact && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-[#8B5CF6]" />
                <span className="text-sm font-bold text-foreground">AI Haber Analizi</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  newsImpact.overallSentiment === 'olumlu' ? 'bg-[#22C55E]/15 text-[#22C55E]' :
                  newsImpact.overallSentiment === 'olumsuz' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                  newsImpact.overallSentiment === 'karışık' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                  'bg-slate-500/15 text-slate-400'
                }`}>
                  {newsImpact.overallSentiment === 'olumlu' ? '📈 Olumlu' :
                   newsImpact.overallSentiment === 'olumsuz' ? '📉 Olumsuz' :
                   newsImpact.overallSentiment === 'karışık' ? '⚖️ Karışık' : '➖ Nötr'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  newsImpact.riskLevel === 'Yüksek' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                  newsImpact.riskLevel === 'Orta' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                  'bg-[#22C55E]/15 text-[#22C55E]'
                }`}>
                  Risk: {newsImpact.riskLevel}
                </span>
              </div>
              <button onClick={() => setShowNewsDetail(!showNewsDetail)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                {showNewsDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showNewsDetail ? 'Gizle' : 'Detay'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{newsImpact.summary}</p>

            {/* Kritik Uyarılar */}
            {newsImpact.criticalWarnings.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {newsImpact.criticalWarnings.map((w, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {w}
                  </span>
                ))}
              </div>
            )}

            {/* Hisse Uyarıları - her zaman göster */}
            {newsImpact.stockWarnings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {newsImpact.stockWarnings.map((sw, i) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                    sw.warning === 'GİR' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30' :
                    sw.warning === 'GİRME' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30' :
                    'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
                  }`} title={sw.reason}>
                    📰 {sw.symbol}: {sw.warning}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Genişletilmiş Detay: Sektör Etkileri */}
          <AnimatePresence>
            {showNewsDetail && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  {newsImpact.sectorImpacts.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-foreground mb-2">Sektör Etkileri</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {newsImpact.sectorImpacts.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 glass-inner rounded-lg p-2">
                            <span className="text-sm">{s.direction === 'yukarı' ? '📈' : s.direction === 'aşağı' ? '📉' : '➖'}</span>
                            <div>
                              <span className="text-xs font-semibold text-foreground">{s.sector}</span>
                              <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {newsImpact.stockWarnings.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-foreground mb-2">Hisse Detayları</p>
                      <div className="space-y-1">
                        {newsImpact.stockWarnings.map((sw, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={`font-bold w-14 ${
                              sw.warning === 'GİR' ? 'text-[#22C55E]' : sw.warning === 'GİRME' ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                            }`}>{sw.symbol}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              sw.warning === 'GİR' ? 'bg-[#22C55E]/10 text-[#22C55E]' : sw.warning === 'GİRME' ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                            }`}>{sw.warning}</span>
                            <span className="text-muted-foreground flex-1">{sw.reason}</span>
                            <span className={`font-mono text-[10px] ${sw.impact >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{sw.impact > 0 ? '+' : ''}{sw.impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
      {newsLoading && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6]" />
          <span className="text-xs text-muted-foreground">AI haber analizi yükleniyor...</span>
        </div>
      )}

      {/* Score legend */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(SCORE_LABELS ?? {}).map(([key, val]: any) => (
          <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: val?.color }} />
            <span className="text-xs text-muted-foreground">{val?.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Hisseler taranıyor...</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Teknik göstergeler, mum formasyonları, Sapan/Dip-Bip ve grafik formasyonları hesaplanıyor</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(results ?? []).map((stock: any, i: number) => {
            const newsWarning = getStockWarning(stock?.symbol);
            const adjustedScore = adjustScore(stock?.score ?? 0, stock?.symbol);
            const scoreColor = getScoreColor(adjustedScore);
            return (
              <motion.div
                key={stock?.symbol ?? i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-xl p-4 hover:border-[#3B82F6]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Left: Name & score */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold" style={{ backgroundColor: `${scoreColor}15`, color: scoreColor }}>
                        <span className="text-lg">{adjustedScore}</span>
                        <span className="text-[7px] opacity-70">{newsWarning ? '📰 PUAN' : 'PUAN'}</span>
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-foreground" style={{ backgroundColor: scoreColor }}>
                        {stock?.quality ?? '-'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-foreground cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(stock?.yahooSymbol ?? stock?.symbol)}`)}>{stock?.symbol}</p>
                        <span className={`text-xs font-mono font-semibold ${(stock?.change ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {(stock?.change ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                          {formatPercent(stock?.change)}
                        </span>
                        {stock?.dayTradeUygun && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold">
                            ⚡ Day
                          </span>
                        )}
                        {stock?.swingUygun && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 font-semibold">
                            🌊 Swing
                          </span>
                        )}
                        {stock?.sapanDetected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold">
                            🎯 Sapan
                          </span>
                        )}
                        {stock?.dipBipDetected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 font-semibold">
                            ⚡ Dip-Bip
                          </span>
                        )}
                        {newsWarning && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                            newsWarning.warning === 'GİR' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30' :
                            newsWarning.warning === 'GİRME' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30' :
                            'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
                          }`} title={newsWarning.reason}>
                            📰 {newsWarning.warning}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{stock?.name}</p>
                      <p className="text-sm font-mono font-semibold text-foreground mt-0.5">{formatNumber(stock?.price)} TL</p>
                    </div>
                  </div>

                  {/* Center: Puan dağılımı + Indicators */}
                  <div className="flex-1 min-w-0">
                    {/* Puan bars */}
                    <div className="grid grid-cols-5 gap-1 mb-2">
                      {[
                        { label: 'Hac', puan: stock?.hacimPuan ?? 0 },
                        { label: 'Trn', puan: stock?.trendPuan ?? 0 },
                        { label: 'Mom', puan: stock?.momentumPuan ?? 0 },
                        { label: 'For', puan: stock?.formasyonPuan ?? 0 },
                        { label: 'R/Ö', puan: stock?.riskOdulPuan ?? 0 },
                      ].map((p: any, pIdx: number) => (
                        <div key={pIdx} className="text-center">
                          <div className="h-1.5 glass-inner rounded-full overflow-hidden mb-0.5">
                            <div className="h-full rounded-full" style={{ width: `${(p.puan / 20) * 100}%`, backgroundColor: p.puan >= 16 ? '#22C55E' : p.puan >= 10 ? '#3B82F6' : '#F59E0B' }} />
                          </div>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500">{p.label} {p.puan}</span>
                        </div>
                      ))}
                    </div>
                    {/* Formations */}
                    {(stock?.formations?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(stock.formations ?? []).map((f: string, fIdx: number) => (
                          <span key={fIdx} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30">
                            📐 {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Mum Formasyonları */}
                    {(stock?.candlePatterns?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(stock.candlePatterns ?? []).map((cp: any, cpIdx: number) => (
                          <span key={cpIdx} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                            cp.type === 'bullish' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
                            : cp.type === 'bearish' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                            : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
                          }`}>
                            🕯️ {cp.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Indicators row */}
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">RSI</p>
                        <p className={`text-xs font-mono font-semibold ${(stock?.rsi ?? 50) < 30 ? 'text-[#22C55E]' : (stock?.rsi ?? 50) > 70 ? 'text-[#EF4444]' : 'text-foreground'}`}>
                          {stock?.rsi ?? '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">MACD</p>
                        <p className={`text-xs font-mono font-semibold ${(stock?.macd?.histogram ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {stock?.macd?.histogram ?? '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">EMA20</p>
                        <p className="text-xs font-mono text-foreground">{formatNumber(stock?.ema20)}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">EMA50</p>
                        <p className="text-xs font-mono text-foreground">{formatNumber(stock?.ema50)}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">VWAP</p>
                        <p className="text-xs font-mono text-foreground">{formatNumber(stock?.vwap)}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">R/G</p>
                        <p className="text-xs font-mono text-[#3B82F6]">1:{stock?.riskReward ?? '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Levels & action */}
                  <div className="flex items-center gap-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Giriş</p>
                        <p className="text-xs font-mono text-[#3B82F6]">{formatNumber(stock?.entry)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Stop</p>
                        <p className="text-xs font-mono text-[#EF4444]">{formatNumber(stock?.stop)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Hedef</p>
                        <p className="text-xs font-mono text-[#22C55E]">{formatNumber(stock?.target)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTradeModal({ symbol: stock?.yahooSymbol ?? stock?.symbol, name: stock?.name, price: stock?.price ?? 0, marketType: 'BIST' })}
                      className="px-4 py-2 text-xs font-semibold bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6]/20 transition-colors whitespace-nowrap"
                    >
                      İşlem Yap
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {(results?.length ?? 0) === 0 && (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tarama sonucu bulunamadı</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pb-4">⚠️ Tarama sonuçları yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır.</p>

      {tradeModal && (
        <TradeModal
          isOpen={true}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal?.symbol}
          name={tradeModal?.name}
          price={tradeModal?.price}
          marketType={tradeModal?.marketType}
          onSuccess={fetchScreening}
        />
      )}
    </div>
  );
}
