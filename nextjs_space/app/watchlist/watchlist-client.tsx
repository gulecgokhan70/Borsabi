'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Plus, Loader2, TrendingUp, TrendingDown, RefreshCw, Search, X, Star, Bell, BellRing, AlertTriangle } from 'lucide-react';
import { BIST_STOCKS, BIST_FUNDS, CRYPTO_ASSETS, formatCurrency, formatPercent, formatNumber, isIndexSymbol } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';
import { PriceChart } from '@/components/price-chart';
import { toast } from 'sonner';
import { useHaptic } from '@/hooks/use-haptic';

const ALL_ASSETS = [
  ...BIST_STOCKS.map((s: any) => ({ ...s, type: 'BIST' })),
  ...BIST_FUNDS.map((s: any) => ({ ...s, type: 'BIST' })),
  ...CRYPTO_ASSETS.map((c: any) => ({ ...c, type: 'CRYPTO' })),
];

// Bildirim eşiği (%)
const ALERT_THRESHOLD = 3;

export function WatchlistClient() {
  const router = useRouter();
  const haptic = useHaptic();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [tradeModal, setTradeModal] = useState<any>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; symbol: string; name: string; message: string; type: 'up' | 'down' | 'alert'; time: Date }>>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const prevPricesRef = useRef<Record<string, any>>({});

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      const items = data?.data ?? [];
      setWatchlist(items);

      if ((items?.length ?? 0) > 0) {
        const symbols = items.map((w: any) => w?.symbol).filter(Boolean).join(',');
        const priceRes = await fetch(`/api/market?symbols=${symbols}`);
        const priceData = await priceRes.json();
        const priceMap: Record<string, any> = {};
        (priceData?.data ?? []).forEach((p: any) => { if (p?.symbol) priceMap[p.symbol] = p; });

        // Fiyat değişikliği kontrolü - bildirim oluştur
        const prev = prevPricesRef.current;
        if (Object.keys(prev).length > 0) {
          Object.entries(priceMap).forEach(([sym, cur]: [string, any]) => {
            const old = prev[sym];
            if (!old || !cur) return;
            const oldPrice = old?.price ?? 0;
            const curPrice = cur?.price ?? 0;
            if (oldPrice <= 0 || curPrice <= 0) return;
            const changeFromLast = ((curPrice - oldPrice) / oldPrice) * 100;
            const absChange = Math.abs(cur?.changePercent ?? 0);

            // %3+ değişim veya son kontrolden beri %1+ ani değişim
            if (absChange >= ALERT_THRESHOLD || Math.abs(changeFromLast) >= 1) {
              const item = items.find((w: any) => w?.symbol === sym);
              const cleanName = sym.replace('.IS', '').replace('-USD', '');
              const direction = (cur?.changePercent ?? 0) >= 0 ? 'up' : 'down';
              const msg = absChange >= ALERT_THRESHOLD
                ? `${cleanName} gün içinde %${absChange.toFixed(1)} ${direction === 'up' ? 'yükseldi' : 'düştü'}!`
                : `${cleanName} son dakika %${Math.abs(changeFromLast).toFixed(2)} ${changeFromLast > 0 ? 'artış' : 'düşüş'}`;

              // Aynı sembol için 5 dk içinde tekrar bildirim gönderme
              setNotifications(prev => {
                const recent = prev.find(n => n.symbol === sym && Date.now() - n.time.getTime() < 300000);
                if (recent) return prev;
                return [{ id: `${sym}-${Date.now()}`, symbol: sym, name: item?.name ?? cleanName, message: msg, type: (direction === 'up' ? 'up' : 'down') as 'up' | 'down', time: new Date() }, ...prev].slice(0, 20);
              });

              // Haptic + Toast bildirim
              if (absChange >= ALERT_THRESHOLD) {
                haptic.warning();
                toast(direction === 'up' ? '🚀 Sert Yükseliş!' : '🚨 Sert Düşüş!', {
                  description: msg,
                  duration: 5000,
                });
              } else {
                haptic.medium();
              }
            }
          });
        }

        prevPricesRef.current = priceMap;
        setPrices(priceMap);
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [haptic]);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  // Otomatik yenileme - 30 saniye
  useEffect(() => {
    const interval = setInterval(() => { fetchWatchlist(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  const toggleWatchlist = async (symbol: string, name: string, type: string) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, name, type }),
      });
      const data = await res.json();
      if (data?.added) toast.success(data?.message ?? 'Eklendi');
      if (data?.removed) toast.info(data?.message ?? 'Kaldırıldı');
      fetchWatchlist();
    } catch (e: any) { toast.error('Hata oluştu'); }
  };

  const filteredAssets = ALL_ASSETS.filter((a: any) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (a?.symbol?.toLowerCase?.()?.includes?.(q) || a?.name?.toLowerCase?.()?.includes?.(q) || a?.shortName?.toLowerCase?.()?.includes?.(q));
  });

  const watchlistSymbols = new Set(watchlist.map((w: any) => w?.symbol));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">İzleme Listesi</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Favori hisselerinizi takip edin</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#3B82F6] text-white text-xs sm:text-sm font-semibold hover:bg-[#2563EB] transition-colors">
            <Plus className="w-4 h-4" /> Ekle
          </button>
          <button onClick={() => { setShowNotifs(!showNotifs); haptic.light(); }} className="relative p-2 rounded-lg glass-card text-muted-foreground hover:text-foreground transition-colors">
            {notifications.length > 0 ? <BellRing className="w-4 h-4 text-[#F59E0B]" /> : <Bell className="w-4 h-4" />}
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center">{notifications.length > 9 ? '9+' : notifications.length}</span>
            )}
          </button>
          <button onClick={fetchWatchlist} disabled={loading} className="p-2 rounded-lg glass-card text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Hisse / Kripto Ekle</h3>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={searchQ} onChange={(e: any) => setSearchQ(e?.target?.value ?? '')} placeholder="Ara..." className="w-full pl-10 pr-3 py-2 glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-[#3B82F6]" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-none">
            {filteredAssets.map((a: any) => {
              const isInList = watchlistSymbols.has(a?.symbol);
              return (
                <button key={a?.symbol} onClick={() => toggleWatchlist(a?.symbol, a?.name, a?.type)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isInList ? 'bg-[#3B82F6]/10' : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${a?.type === 'CRYPTO' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>{a?.type}</span>
                    <span className="text-sm text-foreground truncate font-medium">{a?.shortName ?? a?.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">{a?.name}</span>
                  </div>
                  <Star className={`w-4 h-4 flex-shrink-0 ml-2 ${isInList ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-400 dark:text-slate-500'}`} />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Bildirimler paneli */}
      <AnimatePresence>
        {showNotifs && (
          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }}
            className="glass-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08] gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <BellRing className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />
                <h3 className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">Bildirimler</h3>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] font-semibold whitespace-nowrap hidden sm:inline">
                  %{ALERT_THRESHOLD}+ değişim
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Temizle</button>
                )}
                <button onClick={() => setShowNotifs(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto scrollbar-none">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Henüz bildirim yok</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">İzleme listenizdeki hisselerde önemli fiyat değişikliği olduğunda burada görünecek</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                      onClick={() => router.push(`/stock/${encodeURIComponent(n.symbol)}`)}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        n.type === 'up' ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'
                      }`}>
                        {n.type === 'up' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground">{n.time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watchlist items */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" /></div>
      ) : (watchlist?.length ?? 0) === 0 ? (
        <div className="text-center py-16">
          <Eye className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Henüz izleme listeniz boş</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">"Ekle" butonuyla favori hisselerinizi ekleyin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {watchlist.map((w: any, i: number) => {
            const priceData = prices?.[w?.symbol];
            const change = priceData?.changePercent ?? 0;
            return (
              <motion.div key={w?.id ?? i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass-card rounded-xl p-4 transition-colors ${Math.abs(change) >= ALERT_THRESHOLD ? (change >= 0 ? 'border-[#22C55E]/30 ring-1 ring-[#22C55E]/10' : 'border-[#EF4444]/30 ring-1 ring-[#EF4444]/10') : 'hover:border-[#3B82F6]/30'}`}>
                {Math.abs(change) >= ALERT_THRESHOLD && (
                  <div className={`flex items-center gap-1 mb-2 px-2 py-1 rounded-md text-[10px] font-semibold w-fit ${
                    change >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                  }`}>
                    <AlertTriangle className="w-3 h-3" />
                    {change >= 0 ? 'Sert Yükseliş' : 'Sert Düşüş'} ({formatPercent(change)})
                  </div>
                )}
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 cursor-pointer min-w-0 flex-1" onClick={() => router.push(`/stock/${encodeURIComponent(w?.symbol)}`)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${change >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                      {change >= 0 ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground hover:text-[#3B82F6] transition-colors truncate">{w?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{w?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold text-foreground">{formatNumber(priceData?.price ?? 0)}</p>
                      <p className={`text-xs font-mono ${change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatPercent(change)}</p>
                    </div>
                    <button onClick={() => toggleWatchlist(w?.symbol, w?.name, w?.type)} className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-slate-400 dark:text-slate-500 hover:text-[#EF4444] transition-colors" title="Kaldır">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <PriceChart symbol={w?.symbol} height="h-24" />
                {!isIndexSymbol(w?.symbol) && (
                  <button
                    onClick={() => setTradeModal({ symbol: w?.symbol, name: w?.name, price: priceData?.price ?? 0, marketType: w?.type })}
                    className="w-full mt-3 py-2 text-xs font-semibold bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6]/20 transition-colors"
                  >İşlem Yap</button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {tradeModal && (
        <TradeModal
          isOpen={true}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal?.symbol}
          name={tradeModal?.name}
          price={tradeModal?.price}
          marketType={tradeModal?.marketType}
          onSuccess={fetchWatchlist}
        />
      )}
    </div>
  );
}
