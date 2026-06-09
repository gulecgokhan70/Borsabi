'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, Activity, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, DollarSign, PieChart, Zap
} from 'lucide-react';
import { BIST_INDICES, BIST_TOP_STOCKS, CRYPTO_ASSETS, formatCurrency, formatPercent, formatNumber } from '@/lib/constants';
import { PriceChart } from '@/components/price-chart';
import { TradeModal } from '@/components/trade-modal';

const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

export function DashboardClient() {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const [indices, setIndices] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [bistOpen, setBistOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<any>(null);

  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [indRes, stockRes, cryptoRes, portRes] = await Promise.allSettled([
        fetch(`/api/market?symbols=${BIST_INDICES.map((i: any) => i?.symbol).join(',')}`).then((r: any) => r?.json?.()),
        fetch(`/api/market?symbols=${BIST_TOP_STOCKS.slice(0, 10).map((s: any) => s?.symbol).join(',')}`).then((r: any) => r?.json?.()),
        fetch(`/api/market?symbols=${CRYPTO_ASSETS.slice(0, 8).map((c: any) => c?.symbol).join(',')}`).then((r: any) => r?.json?.()),
        fetch('/api/portfolio').then((r: any) => r?.json?.()),
      ]);
      if (indRes?.status === 'fulfilled') {
        setIndices(indRes?.value?.data ?? []);
        if (indRes?.value?.marketOpen !== undefined) setBistOpen(indRes.value.marketOpen);
      }
      if (stockRes?.status === 'fulfilled') setStocks(stockRes?.value?.data ?? []);
      if (cryptoRes?.status === 'fulfilled') setCryptos(cryptoRes?.value?.data ?? []);
      if (portRes?.status === 'fulfilled') setPortfolio(portRes?.value ?? null);
      setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
    } catch (e: any) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Otomatik yenileme - 30 saniye
  useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const gainers = [...(stocks ?? [])].filter((s: any) => (s?.changePercent ?? 0) > 0).sort((a: any, b: any) => (b?.changePercent ?? 0) - (a?.changePercent ?? 0)).slice(0, 5);
  const losers = [...(stocks ?? [])].filter((s: any) => (s?.changePercent ?? 0) < 0).sort((a: any, b: any) => (a?.changePercent ?? 0) - (b?.changePercent ?? 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Merhaba, {session?.user?.name ?? 'Trader'} 👋</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">Piyasa özeti ve portföy durumunuz</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span>Canlı{lastUpdate ? ` • ${lastUpdate}` : ''}</span>
          </div>
          <button onClick={fetchData} disabled={loading} className="p-2.5 rounded-lg bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-white hover:bg-[#334155] transition-colors">
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
        <div className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs text-[#94A3B8]">Bakiye</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">{formatCurrency(portfolio?.balance)}</p>
        </div>
        <div className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-xs text-[#94A3B8]">Yatırım</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">{formatCurrency(portfolio?.totalInvested)}</p>
        </div>
        <div className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-4 h-4 ${(portfolio?.totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`} />
            <span className="text-xs text-[#94A3B8]">Toplam K/Z</span>
          </div>
          <p className={`text-lg font-bold font-mono ${(portfolio?.totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatCurrency(portfolio?.totalPnl)}
          </p>
        </div>
        <div className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs text-[#94A3B8]">Kazanç Oranı</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">{formatNumber(portfolio?.winRate, 1)}%</p>
        </div>
      </motion.div>

      {/* Indices */}
      <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(indices ?? []).map((idx: any) => (
          <div key={idx?.symbol} onClick={() => router.push(`/stock/${encodeURIComponent(idx?.symbol)}`)} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155] cursor-pointer hover:border-[#3B82F6]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-white">{idx?.name ?? idx?.symbol}</p>
                <p className="text-xs text-[#94A3B8]">{idx?.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold font-mono text-white">{formatNumber(idx?.price)}</p>
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

      {/* BIST stocks & Crypto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BIST */}
        <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
            <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-white">BIST Hisseleri</h2>
          </div>
          <div className="divide-y divide-[#334155]/50">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" /></div>
            ) : (
              (stocks ?? []).slice(0, 8).map((s: any) => (
                <button key={s?.symbol} onClick={() => router.push(`/stock/${encodeURIComponent(s?.symbol)}`)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#334155]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      (s?.changePercent ?? 0) >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {(s?.changePercent ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{s?.symbol?.replace?.('.IS', '') ?? s?.symbol}</p>
                      <p className="text-[10px] text-[#94A3B8] truncate max-w-[120px]">{s?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-white">{formatNumber(s?.price)}</p>
                    <p className={`text-xs font-mono ${(s?.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {formatPercent(s?.changePercent)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>

        {/* Crypto */}
        <motion.div {...fadeIn} transition={{ delay: 0.3 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
            <Activity className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-white">Kripto Piyasası</h2>
          </div>
          <div className="divide-y divide-[#334155]/50">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#F59E0B]" /></div>
            ) : (
              (cryptos ?? []).slice(0, 8).map((c: any) => (
                <button key={c?.symbol} onClick={() => router.push(`/stock/${encodeURIComponent(c?.symbol)}`)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#334155]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      (c?.changePercent ?? 0) >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {(c?.changePercent ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{c?.symbol?.replace?.('-USD', '') ?? c?.symbol}</p>
                      <p className="text-[10px] text-[#94A3B8]">{c?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-white">${formatNumber(c?.price)}</p>
                    <p className={`text-xs font-mono ${(c?.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {formatPercent(c?.changePercent)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Gainers/Losers */}
      {((gainers?.length ?? 0) > 0 || (losers?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div {...fadeIn} transition={{ delay: 0.4 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
              <TrendingUp className="w-4 h-4 text-[#22C55E]" />
              <h2 className="text-sm font-semibold text-white">En Çok Yükselen</h2>
            </div>
            <div className="divide-y divide-[#334155]/50">
              {(gainers ?? []).map((s: any, i: number) => (
                <div key={s?.symbol ?? i} onClick={() => router.push(`/stock/${encodeURIComponent(s?.symbol)}`)} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-[#334155]/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#22C55E] w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-white">{s?.symbol?.replace?.('.IS', '')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-white">{formatNumber(s?.price)}</span>
                    <span className="text-xs font-mono font-semibold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">{formatPercent(s?.changePercent)}</span>
                  </div>
                </div>
              ))}
              {(gainers?.length ?? 0) === 0 && <p className="text-xs text-[#94A3B8] p-4 text-center">Veri yok</p>}
            </div>
          </motion.div>

          <motion.div {...fadeIn} transition={{ delay: 0.5 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
              <TrendingDown className="w-4 h-4 text-[#EF4444]" />
              <h2 className="text-sm font-semibold text-white">En Çok Düşen</h2>
            </div>
            <div className="divide-y divide-[#334155]/50">
              {(losers ?? []).map((s: any, i: number) => (
                <div key={s?.symbol ?? i} onClick={() => router.push(`/stock/${encodeURIComponent(s?.symbol)}`)} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-[#334155]/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#EF4444] w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-white">{s?.symbol?.replace?.('.IS', '')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-white">{formatNumber(s?.price)}</span>
                    <span className="text-xs font-mono font-semibold text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">{formatPercent(s?.changePercent)}</span>
                  </div>
                </div>
              ))}
              {(losers?.length ?? 0) === 0 && <p className="text-xs text-[#94A3B8] p-4 text-center">Veri yok</p>}
            </div>
          </motion.div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center py-4">
        <p className="text-[10px] text-[#64748B]">⚠️ Bu platform eğitim ve simülasyon amaçlıdır. Yatırım tavsiyesi içermez.</p>
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
