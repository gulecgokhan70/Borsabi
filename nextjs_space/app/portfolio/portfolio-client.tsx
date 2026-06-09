'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, DollarSign, RefreshCw, Loader2, BarChart3, PieChart, Target, ShieldAlert } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber, COMMISSION_RATE } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';
import { PriceChart } from '@/components/price-chart';

export function PortfolioClient() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<any>(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  // Otomatik yenileme - 30 saniye
  useEffect(() => {
    const interval = setInterval(() => { fetchPortfolio(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  if (loading && !portfolio) return (
    <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" /></div>
  );

  const positions = portfolio?.positions ?? [];
  const closedPositions = portfolio?.closedPositions ?? [];
  const balance = portfolio?.balance ?? 100000;
  const initialBalance = portfolio?.initialBalance ?? 100000;
  const totalReturn = balance - initialBalance;
  const totalReturnPct = initialBalance > 0 ? (totalReturn / initialBalance) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Portföy Yönetimi</h1>
          <p className="text-sm text-[#94A3B8]">Pozisyonlarınızı yönetin ve performansınızı takip edin</p>
        </div>
        <button onClick={fetchPortfolio} disabled={loading} className="p-2.5 rounded-lg bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-[#94A3B8]">Mevcut Bakiye</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatCurrency(balance)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2"><DollarSign className={`w-4 h-4 ${totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`} /><span className="text-xs text-[#94A3B8]">Toplam Getiri</span></div>
          <p className={`text-lg font-bold font-mono ${totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatCurrency(totalReturn)}</p>
          <p className={`text-xs font-mono font-semibold ${totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{totalReturn >= 0 ? '+' : ''}{formatPercent(totalReturnPct)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-[#8B5CF6]" /><span className="text-xs text-[#94A3B8]">Açık Pozisyon</span></div>
          <p className="text-lg font-bold font-mono text-white">{positions?.length ?? 0}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-[#F59E0B]" /><span className="text-xs text-[#94A3B8]">Kazanç Oranı</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatNumber(portfolio?.winRate ?? 0, 1)}%</p>
          <p className="text-xs font-medium text-[#CBD5E1]">{portfolio?.totalTrades ?? 0} işlem</p>
        </motion.div>
      </div>

      {/* Open Positions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
          <PieChart className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-white">Açık Pozisyonlar</h2>
        </div>
        {(positions?.length ?? 0) === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#94A3B8]">Henüz açık pozisyonunuz yok</p>
            <p className="text-xs text-[#64748B] mt-1">Dashboard’dan bir hisseye tıklayarak işlem yapabilirsiniz</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[#94A3B8] border-b border-[#334155]">
                <th className="text-left px-4 py-2">Sembol</th>
                <th className="text-right px-4 py-2">Miktar</th>
                <th className="text-right px-4 py-2">Giriş</th>
                <th className="text-right px-4 py-2">Mevcut</th>
                <th className="text-right px-4 py-2">K/Z</th>
                <th className="text-right px-4 py-2">SL / TP</th>
                <th className="text-right px-4 py-2">İşlem</th>
              </tr></thead>
              <tbody className="divide-y divide-[#334155]/50">
                {positions.map((p: any) => {
                  const pnl = ((p?.currentPrice ?? 0) - (p?.entryPrice ?? 0)) * (p?.quantity ?? 0) - (p?.commission ?? 0);
                  const pnlPct = (p?.entryPrice ?? 0) > 0 ? ((pnl / ((p?.entryPrice ?? 0) * (p?.quantity ?? 0))) * 100) : 0;
                  return (
                    <tr key={p?.id} className="hover:bg-[#334155]/20">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(p?.symbol)}`)}>{p?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}</p>
                        <p className="text-[10px] text-[#94A3B8]">{p?.name}</p>
                      </td>
                      <td className="text-right px-4 py-2.5 font-mono text-white">{p?.quantity}</td>
                      <td className="text-right px-4 py-2.5 font-mono text-white">{formatNumber(p?.entryPrice)}</td>
                      <td className="text-right px-4 py-2.5 font-mono text-white">{formatNumber(p?.currentPrice)}</td>
                      <td className={`text-right px-4 py-2.5 font-mono font-semibold ${pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {formatCurrency(pnl)}<br /><span className="text-xs">{formatPercent(pnlPct)}</span>
                      </td>
                      <td className="text-right px-4 py-2.5 text-xs">
                        {p?.stopLoss ? <span className="text-[#EF4444]">SL: {formatNumber(p.stopLoss)}</span> : <span className="text-[#64748B]">-</span>}
                        {p?.takeProfit && <><br /><span className="text-[#22C55E]">TP: {formatNumber(p.takeProfit)}</span></>}
                      </td>
                      <td className="text-right px-4 py-2.5">
                        <button
                          onClick={() => setTradeModal({ symbol: p?.symbol, name: p?.name, price: p?.currentPrice ?? p?.entryPrice, marketType: p?.type, side: 'SELL', maxQty: p?.quantity })}
                          className="px-3 py-1 text-xs font-semibold bg-[#EF4444]/10 text-[#EF4444] rounded-md hover:bg-[#EF4444]/20 transition-colors"
                        >Sat</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Closed positions */}
      {(closedPositions?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
            <ShieldAlert className="w-4 h-4 text-[#94A3B8]" />
            <h2 className="text-sm font-semibold text-white">Kapanan Pozisyonlar</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[#94A3B8] border-b border-[#334155]">
                <th className="text-left px-4 py-2">Sembol</th>
                <th className="text-right px-4 py-2">Giriş</th>
                <th className="text-right px-4 py-2">Çıkış</th>
                <th className="text-right px-4 py-2">K/Z</th>
                <th className="text-right px-4 py-2">Tarih</th>
              </tr></thead>
              <tbody className="divide-y divide-[#334155]/50">
                {closedPositions.slice(0, 10).map((p: any) => (
                  <tr key={p?.id} className="hover:bg-[#334155]/20">
                    <td className="px-4 py-2.5 font-medium text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(p?.symbol)}`)}>{p?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}</td>
                    <td className="text-right px-4 py-2.5 font-mono text-white">{formatNumber(p?.entryPrice)}</td>
                    <td className="text-right px-4 py-2.5 font-mono text-white">{formatNumber(p?.currentPrice)}</td>
                    <td className={`text-right px-4 py-2.5 font-mono font-semibold ${(p?.pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {formatCurrency(p?.pnl)}
                    </td>
                    <td className="text-right px-4 py-2.5 text-xs text-[#94A3B8]">
                      {p?.closedAt ? new Date(p.closedAt).toLocaleDateString('tr-TR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="text-center py-2">
        <p className="text-[10px] text-[#64748B]">⚠️ Komisyon oranı: Alış %0.2, Satış %0.2 | Bu platform simülasyon amaçlıdır</p>
      </div>

      {tradeModal && (
        <TradeModal
          isOpen={true}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal?.symbol}
          name={tradeModal?.name}
          price={tradeModal?.price}
          marketType={tradeModal?.marketType}
          side={tradeModal?.side}
          maxQuantity={tradeModal?.maxQty}
          onSuccess={fetchPortfolio}
        />
      )}
    </div>
  );
}
