'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, Plus, Loader2, TrendingUp, TrendingDown, RefreshCw, Search, X, Star } from 'lucide-react';
import { BIST_STOCKS, CRYPTO_ASSETS, formatCurrency, formatPercent, formatNumber } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';
import { PriceChart } from '@/components/price-chart';
import { toast } from 'sonner';

const ALL_ASSETS = [
  ...BIST_STOCKS.map((s: any) => ({ ...s, type: 'BIST' })),
  ...CRYPTO_ASSETS.map((c: any) => ({ ...c, type: 'CRYPTO' })),
];

export function WatchlistClient() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [tradeModal, setTradeModal] = useState<any>(null);

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
        setPrices(priceMap);
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">İzleme Listesi</h1>
          <p className="text-sm text-[#94A3B8]">Favori hisselerinizi takip edin ve hızlı işlem yapın</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors">
            <Plus className="w-4 h-4" /> Ekle
          </button>
          <button onClick={fetchWatchlist} disabled={loading} className="p-2 rounded-lg bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Hisse / Kripto Ekle</h3>
            <button onClick={() => setShowAdd(false)} className="text-[#94A3B8] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input type="text" value={searchQ} onChange={(e: any) => setSearchQ(e?.target?.value ?? '')} placeholder="Ara..." className="w-full pl-10 pr-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#3B82F6]" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-none">
            {filteredAssets.map((a: any) => {
              const isInList = watchlistSymbols.has(a?.symbol);
              return (
                <button key={a?.symbol} onClick={() => toggleWatchlist(a?.symbol, a?.name, a?.type)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isInList ? 'bg-[#3B82F6]/10' : 'hover:bg-[#334155]/30'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${a?.type === 'CRYPTO' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>{a?.type}</span>
                    <span className="text-sm text-white">{a?.shortName ?? a?.symbol}</span>
                    <span className="text-xs text-[#94A3B8]">{a?.name}</span>
                  </div>
                  <Star className={`w-4 h-4 ${isInList ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#64748B]'}`} />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Watchlist items */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" /></div>
      ) : (watchlist?.length ?? 0) === 0 ? (
        <div className="text-center py-16">
          <Eye className="w-10 h-10 text-[#64748B] mx-auto mb-3" />
          <p className="text-sm text-[#94A3B8]">Henüz izleme listeniz boş</p>
          <p className="text-xs text-[#64748B] mt-1">"Ekle" butonuyla favori hisselerinizi ekleyin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {watchlist.map((w: any, i: number) => {
            const priceData = prices?.[w?.symbol];
            const change = priceData?.changePercent ?? 0;
            return (
              <motion.div key={w?.id ?? i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 hover:border-[#3B82F6]/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push(`/stock/${encodeURIComponent(w?.symbol)}`)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${change >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                      {change >= 0 ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white hover:text-[#3B82F6] transition-colors">{w?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}</p>
                      <p className="text-[10px] text-[#94A3B8]">{w?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold text-white">{formatNumber(priceData?.price ?? 0)}</p>
                      <p className={`text-xs font-mono ${change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatPercent(change)}</p>
                    </div>
                    <button onClick={() => toggleWatchlist(w?.symbol, w?.name, w?.type)} className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-[#64748B] hover:text-[#EF4444] transition-colors" title="Kaldır">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <PriceChart symbol={w?.symbol} height="h-24" />
                <button
                  onClick={() => setTradeModal({ symbol: w?.symbol, name: w?.name, price: priceData?.price ?? 0, marketType: w?.type })}
                  className="w-full mt-3 py-2 text-xs font-semibold bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6]/20 transition-colors"
                >İşlem Yap</button>
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
