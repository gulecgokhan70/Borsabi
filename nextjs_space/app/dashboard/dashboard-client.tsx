'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, Activity, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, DollarSign, PieChart, Zap,
  Newspaper, AlertTriangle, ChevronRight, Moon, Sun as SunIcon, Shield, Flame,
  Download, X, Smartphone
} from 'lucide-react';
import { BIST_INDICES, BIST_TOP_STOCKS, CRYPTO_ASSETS, formatCurrency, formatPercent, formatNumber } from '@/lib/constants';
import { PriceChart, MiniSparkline } from '@/components/price-chart';
import { TradeModal } from '@/components/trade-modal';
import { useHaptic } from '@/hooks/use-haptic';

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'Az önce';
  if (diff < 60) return `${diff} sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  return `${Math.floor(diff / 3600)} sa önce`;
}

const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

export function DashboardClient() {
  const router = useRouter();
  const haptic = useHaptic();
  const { data: session } = useSession() || {};
  const [indices, setIndices] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [bistOpen, setBistOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<any>(null);
  const [stockSort, setStockSort] = useState<'alpha' | 'change' | 'price'>('alpha');

  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [marketAlerts, setMarketAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [newsImpact, setNewsImpact] = useState<any>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  // PWA Install prompt
  const deferredPromptRef = useRef<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Zaten yüklüyse veya daha önce kapatıldıysa gösterme
    if (typeof window === 'undefined') return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (isStandalone || dismissed) return;

    const handler = (e: any) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari için (beforeinstallprompt desteklemez)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari && !isStandalone) {
      setTimeout(() => setShowInstallBanner(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const result = await deferredPromptRef.current.userChoice;
      if (result.outcome === 'accepted') {
        haptic.success();
      }
      deferredPromptRef.current = null;
    }
    setShowInstallBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [indRes, stockRes, cryptoRes, portRes] = await Promise.allSettled([
        fetch(`/api/market?symbols=${BIST_INDICES.map((i: any) => i?.symbol).join(',')}`).then((r: any) => r?.json?.()),
        fetch(`/api/market?symbols=${BIST_TOP_STOCKS.slice(0, 20).map((s: any) => s?.symbol).join(',')}`).then((r: any) => r?.json?.()),
        fetch(`/api/market?symbols=${CRYPTO_ASSETS.map((c: any) => c?.symbol).join(',')}`).then((r: any) => r?.json?.()),
        fetch('/api/portfolio').then((r: any) => r?.json?.()),
      ]);
      if (indRes?.status === 'fulfilled') {
        setIndices(indRes?.value?.data ?? []);
        if (indRes?.value?.marketOpen !== undefined) setBistOpen(indRes.value.marketOpen);
      }
      if (stockRes?.status === 'fulfilled') setStocks(stockRes?.value?.data ?? []);
      if (cryptoRes?.status === 'fulfilled') setCryptos(cryptoRes?.value?.data ?? []);
      if (portRes?.status === 'fulfilled') setPortfolio(portRes?.value ?? null);
      setLastUpdate(Date.now());
    } catch (e: any) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch market alerts + AI news analysis
  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      try {
        setAlertsLoading(true);
        setNewsLoading(true);
        const [alertRes, newsRes] = await Promise.allSettled([
          fetch('/api/market-alerts').then(r => r.json()),
          fetch('/api/news-analysis').then(r => r.json()),
        ]);
        if (!cancelled) {
          if (alertRes.status === 'fulfilled') setMarketAlerts(alertRes.value?.alerts || []);
          if (newsRes.status === 'fulfilled' && newsRes.value?.impact) setNewsImpact(newsRes.value.impact);
        }
      } catch (e) {
        console.error('Market alerts error:', e);
      } finally {
        if (!cancelled) { setAlertsLoading(false); setNewsLoading(false); }
      }
    }
    loadAlerts();
    const interval = setInterval(loadAlerts, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Otomatik yenileme - 60 saniye
  useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Tick every 30s to update relative time display
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const gainers = [...(stocks ?? [])].filter((s: any) => (s?.changePercent ?? 0) > 0).sort((a: any, b: any) => (b?.changePercent ?? 0) - (a?.changePercent ?? 0)).slice(0, 5);
  const losers = [...(stocks ?? [])].filter((s: any) => (s?.changePercent ?? 0) < 0).sort((a: any, b: any) => (a?.changePercent ?? 0) - (b?.changePercent ?? 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Ana Ekrana Ekle Bildirimi */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="glass-card rounded-xl p-4 border border-[#3B82F6]/20 bg-gradient-to-r from-[#3B82F6]/10 to-[#8B5CF6]/10 relative overflow-hidden"
          >
            <button onClick={dismissInstallBanner} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">📲 Ana Ekrana Ekle</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {deferredPromptRef.current
                    ? 'BorsaBi\'yi ana ekranınıza ekleyerek hızlı erişim sağlayın.'
                    : 'Paylaş (⎋) butonuna basıp "Ana Ekrana Ekle" seçeneğini kullanın.'}
                </p>
              </div>
              {deferredPromptRef.current && (
                <button onClick={handleInstallClick} className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-xs font-semibold hover:bg-[#2563EB] transition-colors flex items-center gap-1.5 flex-shrink-0">
                  <Download className="w-3.5 h-3.5" /> Yükle
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Merhaba, {session?.user?.name ?? 'Trader'} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Piyasa özeti ve portföy durumunuz</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <span className={`w-2 h-2 rounded-full ${lastUpdate && (Date.now() - lastUpdate) > 120000 ? 'bg-[#F59E0B]' : 'bg-[#22C55E] animate-pulse'}`} />
            <span>{lastUpdate ? `${formatTimeAgo(lastUpdate)} güncellendi` : 'Yükleniyor...'}</span>
          </div>
          <button onClick={fetchData} disabled={loading} className="p-2.5 rounded-lg glass-card text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!bistOpen && !loading && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
          <span className="text-[#F59E0B] text-lg">🔔</span>
          <p className="text-[#F59E0B] text-sm font-medium">BIST şu an kapalı — son kapanış fiyatları gösteriliyor.</p>
        </div>
      )}

      {/* Portfolio summary cards */}
      <motion.div {...fadeIn} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs text-muted-foreground">Bakiye</span>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(portfolio?.balance)}</p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-xs text-muted-foreground">Yatırım</span>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(portfolio?.totalInvested)}</p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-4 h-4 ${((portfolio?.unrealizedPnl ?? 0) + (portfolio?.realizedPnl ?? 0)) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`} />
            <span className="text-xs text-muted-foreground">Toplam K/Z</span>
          </div>
          <p className={`text-lg font-bold font-mono ${((portfolio?.unrealizedPnl ?? 0) + (portfolio?.realizedPnl ?? 0)) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatCurrency((portfolio?.unrealizedPnl ?? 0) + (portfolio?.realizedPnl ?? 0))}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs text-muted-foreground">Kazanç Oranı</span>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{formatNumber(portfolio?.winRate, 1)}%</p>
        </div>
      </motion.div>

      {/* Piyasa Uyarıları + AI Analiz */}
      <motion.div {...fadeIn} transition={{ delay: 0.05 }}>
        <div className="glass-card rounded-xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
          {/* Header with AI Sentiment */}
          <button
            onClick={() => setAlertsExpanded(!alertsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                <Newspaper className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Piyasa Uyarıları</h2>
              {/* AI Sentiment Badge */}
              {newsImpact && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                  newsImpact.overallSentiment === 'olumlu' ? 'bg-[#22C55E]/15 text-[#22C55E]' :
                  newsImpact.overallSentiment === 'olumsuz' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                  newsImpact.overallSentiment === 'karışık' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                  'bg-slate-500/15 text-slate-400'
                }`}>
                  {newsImpact.overallSentiment === 'olumlu' ? '📈 Olumlu' :
                   newsImpact.overallSentiment === 'olumsuz' ? '📉 Olumsuz' :
                   newsImpact.overallSentiment === 'karışık' ? '⚖️ Karışık' : '➖ Nötr'}
                </span>
              )}
              {/* Risk Badge */}
              {newsImpact && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                  newsImpact.riskLevel === 'Yüksek' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                  newsImpact.riskLevel === 'Orta' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                  'bg-[#22C55E]/15 text-[#22C55E]'
                }`}>
                  Risk: {newsImpact.riskLevel}
                </span>
              )}
              {!alertsLoading && marketAlerts.length > 0 && (
                <span className="text-[10px] font-bold bg-[#EF4444]/10 text-[#EF4444] px-1.5 py-0.5 rounded-full">
                  {marketAlerts.length}
                </span>
              )}
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${alertsExpanded ? 'rotate-90' : ''}`} />
          </button>

          {/* Loading */}
          {(alertsLoading || newsLoading) && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6] mr-2" />
              <span className="text-xs text-muted-foreground">AI ile haberler analiz ediliyor...</span>
            </div>
          )}

          {/* Collapsible Content */}
          <AnimatePresence initial={false}>
            {alertsExpanded && !alertsLoading && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                {/* AI Summary + Critical Warnings */}
                {newsImpact && (
                  <div className="px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="text-[#8B5CF6] font-semibold">🤖 AI:</span> {newsImpact.summary}
                    </p>
                    {newsImpact.criticalWarnings?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {newsImpact.criticalWarnings.map((w: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />
                            <p className="text-[11px] font-medium text-[#EF4444]">{w}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {newsImpact.stockWarnings?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {newsImpact.stockWarnings.map((sw: any, i: number) => (
                          <span
                            key={i}
                            onClick={(e) => { e.stopPropagation(); router.push(`/stock/${encodeURIComponent(sw.symbol + '.IS')}`); }}
                            className={`text-[10px] px-2 py-1 rounded-lg font-bold border cursor-pointer transition-all hover:scale-105 ${
                              sw.warning === 'GİR' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/20' :
                              sw.warning === 'GİRME' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30 hover:bg-[#EF4444]/20' :
                              'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/20'
                            }`}
                            title={sw.reason}
                          >
                            {sw.warning === 'GİR' ? '📈' : sw.warning === 'GİRME' ? '📉' : '⚠️'} {sw.symbol}: {sw.warning}
                            <span className="ml-1 font-mono text-[9px] opacity-80">{sw.impact > 0 ? '+' : ''}{sw.impact}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {newsImpact.sectorImpacts?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {newsImpact.sectorImpacts.map((s: any, i: number) => (
                          <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${
                            s.direction === 'yukarı' ? 'bg-[#22C55E]/8 text-[#22C55E] border-[#22C55E]/20' :
                            s.direction === 'aşağı' ? 'bg-[#EF4444]/8 text-[#EF4444] border-[#EF4444]/20' :
                            'bg-slate-500/8 text-slate-400 border-slate-500/20'
                          }`}>
                            {s.direction === 'yukarı' ? '▲' : s.direction === 'aşağı' ? '▼' : '●'} {s.sector}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Full News List */}
                <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {marketAlerts.length === 0 ? (
                    <div className="text-center py-6">
                      <Shield className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Şu an önemli bir piyasa uyarısı yok.</p>
                    </div>
                  ) : (
                    marketAlerts.map((alert: any) => (
                      <div key={alert.id} className="px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            alert.direction === 'pozitif' ? 'bg-[#22C55E]/10' :
                            alert.direction === 'negatif' ? 'bg-[#EF4444]/10' : 'bg-[#F59E0B]/10'
                          }`}>
                            {alert.direction === 'pozitif' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> :
                             alert.direction === 'negatif' ? <TrendingDown className="w-4 h-4 text-[#EF4444]" /> :
                             <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                alert.impact === 'yüksek' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                                alert.impact === 'orta' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'
                              }`}>
                                {alert.impact === 'yüksek' ? '🔴 Yüksek' : alert.impact === 'orta' ? '🟡 Orta' : '🔵 Düşük'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.summary}</p>
                            {(alert.affectedSectors?.length > 0 || alert.affectedSymbols?.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {alert.affectedSectors?.map((s: string) => (
                                  <span key={s} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground">{s}</span>
                                ))}
                                {alert.affectedSymbols?.map((s: string) => (
                                  <span key={s} onClick={() => router.push(`/stock/${encodeURIComponent(s + '.IS')}`)} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] cursor-pointer hover:bg-[#3B82F6]/20 transition-colors">{s}</span>
                                ))}
                              </div>
                            )}
                            {alert.actionSuggestion && (
                              <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03]">
                                <Flame className="w-3 h-3 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                <p className="text-[10px] text-foreground/80 leading-relaxed">{alert.actionSuggestion}</p>
                              </div>
                            )}
                            <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1.5">{alert.source}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed Teaser */}
          {!alertsExpanded && !alertsLoading && !newsLoading && (
            <div className="px-4 py-2.5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors" onClick={() => setAlertsExpanded(true)}>
              {newsImpact ? (
                <p className="text-[11px] text-muted-foreground truncate"><span className="text-[#8B5CF6]">🤖</span> {newsImpact.summary?.slice(0, 80)}...</p>
              ) : marketAlerts.length > 0 ? (
                <p className="text-[11px] text-muted-foreground truncate">{marketAlerts[0].title}</p>
              ) : null}
              <p className="text-[10px] text-[#3B82F6] font-medium mt-1">📰 {marketAlerts.length > 0 ? `${marketAlerts.length} haber detayını gör` : 'Detayları gör'} →</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Indices */}
      <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(indices ?? []).map((idx: any) => (
          <div key={idx?.symbol} onClick={() => router.push(`/stock/${encodeURIComponent(idx?.symbol)}`)} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08] cursor-pointer hover:border-[#3B82F6]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{idx?.name ?? idx?.symbol}</p>
                <p className="text-xs text-muted-foreground">{idx?.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold font-mono text-foreground">{formatNumber(idx?.price)}</p>
                <p className={`text-xs font-mono font-semibold ${(idx?.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {(idx?.changePercent ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                  {formatPercent(idx?.changePercent)}
                </p>
              </div>
            </div>
            <PriceChart symbol={idx?.symbol} height="h-32" />
          </div>
        ))}
      </motion.div>

      {/* Gecikme uyarısı */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 mx-auto w-fit">
        <span className="text-[#F59E0B] text-xs">⏱</span>
        <p className="text-[11px] font-medium text-[#F59E0B]">BİST verileri 15 dakika gecikmeli gelmektedir.</p>
      </div>

      {/* BIST stocks & Crypto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BIST */}
        <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="glass-card rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
              <h2 className="text-sm font-semibold text-foreground">BIST Hisseleri</h2>
            </div>
            <div className="flex glass-inner rounded-lg p-0.5">
              <button onClick={() => setStockSort('alpha')} className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${stockSort === 'alpha' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500'}`}>A-Z</button>
              <button onClick={() => setStockSort('change')} className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${stockSort === 'change' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500'}`}>%Değişim</button>
              <button onClick={() => setStockSort('price')} className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${stockSort === 'price' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500'}`}>Fiyat</button>
            </div>
          </div>
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" /></div>
            ) : (
              [...(stocks ?? [])].sort((a: any, b: any) => {
                if (stockSort === 'change') return Math.abs(b?.changePercent ?? 0) - Math.abs(a?.changePercent ?? 0);
                if (stockSort === 'price') return (b?.price ?? 0) - (a?.price ?? 0);
                return (a?.symbol ?? '').localeCompare(b?.symbol ?? '');
              }).slice(0, 10).map((s: any) => (
                <div key={s?.symbol} className="flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => router.push(`/stock/${encodeURIComponent(s?.symbol)}`)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      (s?.changePercent ?? 0) >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {(s?.changePercent ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-foreground">{s?.symbol?.replace?.('.IS', '') ?? s?.symbol}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{s?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold text-foreground">{formatNumber(s?.price)}</p>
                      <p className={`text-xs font-mono ${(s?.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {formatPercent(s?.changePercent)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTradeModal({ symbol: s?.symbol, name: s?.name, price: s?.price ?? 0, marketType: 'BIST' }); }}
                      className="px-2 py-1.5 text-[10px] font-semibold bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6]/20 transition-colors whitespace-nowrap"
                    >
                      İşlem
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Crypto */}
        <motion.div {...fadeIn} transition={{ delay: 0.3 }} className="glass-card rounded-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <Activity className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-foreground">Kripto Piyasası</h2>
          </div>
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#F59E0B]" /></div>
            ) : (
              (cryptos ?? []).filter((c: any) => (c?.price ?? 0) > 0).slice(0, 8).map((c: any) => (
                <div key={c?.symbol} className="flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => router.push(`/stock/${encodeURIComponent(c?.symbol)}`)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      (c?.changePercent ?? 0) >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {(c?.changePercent ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-foreground">{c?.symbol?.replace?.('-USD', '') ?? c?.symbol}</p>
                      <p className="text-[10px] text-muted-foreground">{c?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold text-foreground">${formatNumber(c?.price)}</p>
                      <p className={`text-xs font-mono ${(c?.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {formatPercent(c?.changePercent)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTradeModal({ symbol: c?.symbol, name: c?.name, price: c?.price ?? 0, marketType: 'CRYPTO' }); }}
                      className="px-2 py-1.5 text-[10px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg hover:bg-[#F59E0B]/20 transition-colors whitespace-nowrap"
                    >
                      İşlem
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Gainers/Losers */}
      {((gainers?.length ?? 0) > 0 || (losers?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div {...fadeIn} transition={{ delay: 0.4 }} className="glass-card rounded-xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
              <TrendingUp className="w-4 h-4 text-[#22C55E]" />
              <h2 className="text-sm font-semibold text-foreground">En Çok Yükselen</h2>
            </div>
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {(gainers ?? []).map((s: any, i: number) => (
                <div key={s?.symbol ?? i} onClick={() => router.push(`/stock/${encodeURIComponent(s?.symbol)}`)} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#22C55E] w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground">{s?.symbol?.replace?.('.IS', '')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-foreground">{formatNumber(s?.price)}</span>
                    <span className="text-xs font-mono font-semibold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">{formatPercent(s?.changePercent)}</span>
                  </div>
                </div>
              ))}
              {(gainers?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-4 text-center">Veri yok</p>}
            </div>
          </motion.div>

          <motion.div {...fadeIn} transition={{ delay: 0.5 }} className="glass-card rounded-xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
              <TrendingDown className="w-4 h-4 text-[#EF4444]" />
              <h2 className="text-sm font-semibold text-foreground">En Çok Düşen</h2>
            </div>
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {(losers ?? []).map((s: any, i: number) => (
                <div key={s?.symbol ?? i} onClick={() => router.push(`/stock/${encodeURIComponent(s?.symbol)}`)} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#EF4444] w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground">{s?.symbol?.replace?.('.IS', '')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-foreground">{formatNumber(s?.price)}</span>
                    <span className="text-xs font-mono font-semibold text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">{formatPercent(s?.changePercent)}</span>
                  </div>
                </div>
              ))}
              {(losers?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-4 text-center">Veri yok</p>}
            </div>
          </motion.div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center py-4">
        <p className="text-[10px] text-slate-400 dark:text-slate-500">⚠️ Bu platform eğitim ve simülasyon amaçlıdır. Yatırım tavsiyesi içermez.</p>
      </div>

      {/* Trade Modal */}
      {tradeModal && (
        <TradeModal
          isOpen={true}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal?.symbol}
          name={tradeModal?.name}
          price={tradeModal?.price}
          marketType={tradeModal?.marketType}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
