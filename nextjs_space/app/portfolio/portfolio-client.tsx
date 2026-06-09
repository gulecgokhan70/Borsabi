'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, DollarSign, RefreshCw, Loader2, BarChart3, PieChart, Target, ShieldAlert, Banknote } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber, COMMISSION_RATE } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';

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

  useEffect(() => {
    const interval = setInterval(() => { fetchPortfolio(); }, 60000);
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
  const totalPositionValue = portfolio?.totalPositionValue ?? 0;
  const totalInvested = portfolio?.totalInvested ?? 0;
  const unrealizedPnl = portfolio?.unrealizedPnl ?? 0;
  const totalPortfolioValue = balance + totalPositionValue;

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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-[#94A3B8]">Nakit Bakiye</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatCurrency(balance)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
          <div className="flex items-center gap-2 mb-2"><Banknote className="w-4 h-4 text-[#8B5CF6]" /><span className="text-xs text-[#94A3B8]">Pozisyon Değeri</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatCurrency(totalPositionValue)}</p>
          {totalInvested > 0 && <p className={`text-xs font-mono ${unrealizedPnl >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)} açık K/Z</p>}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-4 border border-[#3B82F6]/30">
          <div className="flex items-center gap-2 mb-2"><PieChart className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-[#94A3B8]">Toplam Portföy</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatCurrency(totalPortfolioValue)}</p>
          <p className={`text-xs font-mono font-semibold ${totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{totalReturn >= 0 ? '+' : ''}{formatPercent(totalReturnPct)}</p>
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1E293B] rounded-xl p-3 border border-[#334155] text-center">
          <p className="text-xs text-[#94A3B8] mb-1">Açık Pozisyon</p>
          <p className="text-xl font-bold font-mono text-white">{positions?.length ?? 0}</p>
        </div>
        <div className="bg-[#1E293B] rounded-xl p-3 border border-[#334155] text-center">
          <p className="text-xs text-[#94A3B8] mb-1">Toplam İşlem</p>
          <p className="text-xl font-bold font-mono text-white">{portfolio?.totalTrades ?? 0}</p>
        </div>
        <div className="bg-[#1E293B] rounded-xl p-3 border border-[#334155] text-center">
          <p className="text-xs text-[#94A3B8] mb-1">Kazanç Oranı</p>
          <p className="text-xl font-bold font-mono text-white">{formatNumber(portfolio?.winRate ?? 0, 1)}%</p>
        </div>
      </div>

      {/* Open Positions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
          <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-white">Açık Pozisyonlar</h2>
        </div>
        {(positions?.length ?? 0) === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#94A3B8]">Henüz açık pozisyonunuz yok</p>
            <p className="text-xs text-[#64748B] mt-1">Dashboard'dan bir hisseye tıklayarak işlem yapabilirsiniz</p>
          </div>
        ) : (
          <div className="divide-y divide-[#334155]/50">
            {positions.map((p: any) => {
              const pnl = p?.pnl ?? (((p?.currentPrice ?? 0) - (p?.entryPrice ?? 0)) * (p?.quantity ?? 0) - (p?.commission ?? 0));
              const pnlPct = p?.pnlPercent ?? ((p?.entryPrice ?? 0) > 0 ? ((pnl / ((p?.entryPrice ?? 0) * (p?.quantity ?? 0))) * 100) : 0);
              const totalValue = p?.totalValue ?? ((p?.currentPrice ?? 0) * (p?.quantity ?? 0));
              return (
                <div key={p?.id} className="px-4 py-3 hover:bg-[#334155]/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${pnl >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                        {pnl >= 0 ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#F87171]" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(p?.symbol)}`)}>
                          {p?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}
                        </p>
                        <p className="text-[10px] text-[#94A3B8]">{p?.name} • {p?.quantity} adet</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTradeModal({ symbol: p?.symbol, name: p?.name, price: p?.currentPrice ?? p?.entryPrice, marketType: p?.type, side: 'SELL', maxQty: p?.quantity })}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#EF4444]/20 text-[#F87171] rounded-lg hover:bg-[#EF4444]/30 transition-colors"
                    >Sat</button>
                  </div>

                  {/* Fiyat ve Değer bilgileri */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-[#0F172A]/50 rounded-lg p-2">
                      <p className="text-[#64748B] mb-0.5">Giriş Fiyatı</p>
                      <p className="font-mono font-medium text-white">{formatCurrency(p?.entryPrice)}</p>
                    </div>
                    <div className="bg-[#0F172A]/50 rounded-lg p-2">
                      <p className="text-[#64748B] mb-0.5">Güncel Fiyat</p>
                      <p className="font-mono font-medium text-white">{formatCurrency(p?.currentPrice)}</p>
                    </div>
                    <div className="bg-[#0F172A]/50 rounded-lg p-2">
                      <p className="text-[#64748B] mb-0.5">Toplam Değer</p>
                      <p className="font-mono font-bold text-[#3B82F6]">{formatCurrency(totalValue)}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${pnl >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                      <p className="text-[#94A3B8] mb-0.5">Kâr / Zarar</p>
                      <p className={`font-mono font-bold ${pnl >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </p>
                      <p className={`font-mono text-[10px] ${pnl >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                        {pnl >= 0 ? '+' : ''}{formatPercent(pnlPct)}
                      </p>
                    </div>
                  </div>

                  {/* Stop Loss / Take Profit */}
                  {(p?.stopLoss || p?.takeProfit) && (
                    <div className="flex gap-3 mt-2 text-[10px]">
                      {p?.stopLoss && <span className="px-2 py-0.5 rounded bg-[#EF4444]/10 text-[#F87171]">SL: {formatNumber(p.stopLoss)}</span>}
                      {p?.takeProfit && <span className="px-2 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E]">TP: {formatNumber(p.takeProfit)}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Closed positions */}
      {(closedPositions?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
            <ShieldAlert className="w-4 h-4 text-[#94A3B8]" />
            <h2 className="text-sm font-semibold text-white">Kapanan Pozisyonlar (Son 10)</h2>
          </div>
          <div className="divide-y divide-[#334155]/50">
            {closedPositions.slice(0, 10).map((p: any) => (
              <div key={p?.id} className="px-4 py-3 hover:bg-[#334155]/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(p?.pnl ?? 0) >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                    {(p?.pnl ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#F87171]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(p?.symbol)}`)}>
                      {p?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">
                      {formatNumber(p?.entryPrice)} → {formatNumber(p?.currentPrice)} • {p?.closedAt ? new Date(p.closedAt).toLocaleDateString('tr-TR') : '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-semibold ${(p?.pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                    {(p?.pnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(p?.pnl)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="text-center py-2">
        <p className="text-[10px] text-[#64748B]">⚠️ Komisyon oranı: Alış %0.2, Satış %0.2 | Bu platform simülasyon amaçlıdır, yatırım tavsiyesi değildir</p>
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
