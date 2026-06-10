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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Portföy Yönetimi</h1>
          <p className="text-sm text-muted-foreground">Pozisyonlarınızı yönetin ve performansınızı takip edin</p>
        </div>
        <button onClick={fetchPortfolio} disabled={loading} className="p-2.5 rounded-lg glass-card text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-muted-foreground">Nakit Bakiye</span></div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(balance)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2"><Banknote className="w-4 h-4 text-[#8B5CF6]" /><span className="text-xs text-muted-foreground">Pozisyon Değeri</span></div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(totalPositionValue)}</p>
          {totalInvested > 0 && <p className={`text-xs font-mono ${unrealizedPnl >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)} açık K/Z</p>}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4 border border-[#3B82F6]/20 bg-gradient-to-br from-[#3B82F6]/5 to-[#8B5CF6]/5 dark:from-[#1E293B] dark:to-[#0F172A] dark:border-[#3B82F6]/30">
          <div className="flex items-center gap-2 mb-2"><PieChart className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-muted-foreground">Toplam Portföy</span></div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(totalPortfolioValue)}</p>
          <p className={`text-xs font-mono font-semibold ${totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{totalReturn >= 0 ? '+' : ''}{formatPercent(totalReturnPct)}</p>
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3 border border-black/[0.08] dark:border-white/[0.08] text-center">
          <p className="text-xs text-muted-foreground mb-1">Açık Pozisyon</p>
          <p className="text-xl font-bold font-mono text-foreground">{positions?.length ?? 0}</p>
        </div>
        <div className="glass-card rounded-xl p-3 border border-black/[0.08] dark:border-white/[0.08] text-center">
          <p className="text-xs text-muted-foreground mb-1">Toplam İşlem</p>
          <p className="text-xl font-bold font-mono text-foreground">{portfolio?.totalTrades ?? 0}</p>
        </div>
        <div className="glass-card rounded-xl p-3 border border-black/[0.08] dark:border-white/[0.08] text-center">
          <p className="text-xs text-muted-foreground mb-1">Kazanç Oranı</p>
          <p className="text-xl font-bold font-mono text-foreground">{formatNumber(portfolio?.winRate ?? 0, 1)}%</p>
        </div>
      </div>

      {/* Open Positions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
          <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-foreground">Açık Pozisyonlar</h2>
        </div>
        {(positions?.length ?? 0) === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Henüz açık pozisyonunuz yok</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Dashboard'dan bir hisseye tıklayarak işlem yapabilirsiniz</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {positions.map((p: any) => {
              const pnl = p?.pnl ?? (((p?.currentPrice ?? 0) - (p?.entryPrice ?? 0)) * (p?.quantity ?? 0) - (p?.commission ?? 0));
              const pnlPct = p?.pnlPercent ?? ((p?.entryPrice ?? 0) > 0 ? ((pnl / ((p?.entryPrice ?? 0) * (p?.quantity ?? 0))) * 100) : 0);
              const totalValue = p?.totalValue ?? ((p?.currentPrice ?? 0) * (p?.quantity ?? 0));
              return (
                <div key={p?.id} className="px-4 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${pnl >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                        {pnl >= 0 ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#F87171]" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(p?.symbol)}`)}>
                          {p?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p?.name} • {p?.quantity} adet</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTradeModal({ symbol: p?.symbol, name: p?.name, price: p?.currentPrice ?? p?.entryPrice, marketType: p?.type, side: 'SELL', maxQty: p?.quantity })}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#EF4444]/20 text-[#F87171] rounded-lg hover:bg-[#EF4444]/30 transition-colors"
                    >Sat</button>
                  </div>

                  {/* Fiyat ve Değer bilgileri */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="glass-inner rounded-lg p-2">
                      <p className="text-slate-400 dark:text-slate-500 mb-0.5">Giriş Fiyatı</p>
                      <p className="font-mono font-medium text-foreground">{formatCurrency(p?.entryPrice)}</p>
                    </div>
                    <div className="glass-inner rounded-lg p-2">
                      <p className="text-slate-400 dark:text-slate-500 mb-0.5">Güncel Fiyat</p>
                      <p className="font-mono font-medium text-foreground">{formatCurrency(p?.currentPrice)}</p>
                    </div>
                    <div className="glass-inner rounded-lg p-2">
                      <p className="text-slate-400 dark:text-slate-500 mb-0.5">Toplam Değer</p>
                      <p className="font-mono font-bold text-[#3B82F6]">{formatCurrency(totalValue)}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${pnl >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                      <p className="text-muted-foreground mb-0.5">Kâr / Zarar</p>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Kapanan Pozisyonlar (Son 10)</h2>
          </div>
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {closedPositions.slice(0, 10).map((p: any) => (
              <div key={p?.id} className="px-4 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(p?.pnl ?? 0) >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                    {(p?.pnl ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#F87171]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(p?.symbol)}`)}>
                      {p?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
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
        <p className="text-[10px] text-slate-400 dark:text-slate-500">⚠️ Komisyon oranı: Alış %0.2, Satış %0.2 | Bu platform simülasyon amaçlıdır, yatırım tavsiyesi değildir</p>
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
