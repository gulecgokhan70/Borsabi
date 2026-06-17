'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, DollarSign, RefreshCw, Loader2, BarChart3, PieChart, Target, ShieldAlert, Banknote, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart as RechartsPie, Pie, Cell, Legend, Line, ComposedChart } from 'recharts';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';

const DIST_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

export function PortfolioClient() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bistComparison, setBistComparison] = useState<any[]>([]);
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

  // BIST 100 vs Portföy karşılaştırma verisi
  useEffect(() => {
    if (!portfolio?.equityCurve || portfolio.equityCurve.length < 2) return;
    const fetchBist = async () => {
      try {
        const res = await fetch('/api/market/history?symbol=XU100.IS&period=1mo&interval=1d');
        const json = await res.json();
        const bistData = json?.data ?? [];
        if (bistData.length < 2) return;
        const ec = portfolio.equityCurve as { date: string; balance: number }[];
        const ecStart = ec[0].balance;
        const bistStart = bistData[0].close;
        const combined: any[] = [];
        const bistMap = new Map<string, number>();
        bistData.forEach((b: any) => {
          const d = b.date?.slice(0, 10) ?? '';
          bistMap.set(d, ((b.close - bistStart) / bistStart) * 100);
        });
        ec.forEach((p) => {
          const d = p.date?.slice(0, 10) ?? '';
          const portPct = ((p.balance - ecStart) / ecStart) * 100;
          const bistPct = bistMap.get(d);
          if (bistPct !== undefined) {
            combined.push({ date: d.slice(5), portfolio: +portPct.toFixed(2), bist100: +bistPct.toFixed(2) });
          }
        });
        if (combined.length > 1) setBistComparison(combined);
      } catch (e) { console.error('BIST comparison fetch error:', e); }
    };
    fetchBist();
  }, [portfolio?.equityCurve]);

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
  const totalPositionValue = portfolio?.totalPositionValue ?? 0;
  const totalInvested = portfolio?.totalInvested ?? 0;
  const unrealizedPnl = portfolio?.unrealizedPnl ?? 0;
  const totalPortfolioValue = balance + totalPositionValue;
  const totalReturn = totalPortfolioValue - initialBalance;
  const totalReturnPct = initialBalance > 0 ? (totalReturn / initialBalance) * 100 : 0;

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4 border border-[#3B82F6]/20 bg-gradient-to-br from-[#3B82F6]/5 to-[#8B5CF6]/5 dark:from-[#141414] dark:to-[#0A0A0A] dark:border-[#3B82F6]/30">
          <div className="flex items-center gap-2 mb-2"><PieChart className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-muted-foreground">Toplam Portföy</span></div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(totalPortfolioValue)}</p>
          <p className={`text-xs font-mono font-semibold ${totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{formatPercent(totalReturnPct)}</p>
        </motion.div>
      </div>

      {/* Grafik bölümü */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bakiye Eğrisi */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <Activity className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-foreground">Toplam Portföy Değeri</h2>
          </div>
          <div style={{ height: 220 }} className="px-2 py-3">
            {(portfolio?.equityCurve?.length ?? 0) > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolio.equityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={totalReturn >= 0 ? '#22C55E' : '#EF4444'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={totalReturn >= 0 ? '#22C55E' : '#EF4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={70} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94A3B8' }}
                    formatter={(value: number) => [`₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, 'Portföy Değeri']}
                  />
                  <Area type="monotone" dataKey="balance" stroke={totalReturn >= 0 ? '#22C55E' : '#EF4444'} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">İşlem yapıldıkça grafik oluşacak</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Portföy Dağılımı Donut */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <PieChart className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="text-sm font-semibold text-foreground">Portföy Dağılımı</h2>
          </div>
          <div style={{ height: 220 }} className="px-2 py-3">
            {(portfolio?.distribution?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={portfolio.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {(portfolio.distribution ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, name]}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">Pozisyon açıldıkça dağılım görünecek</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Portföy vs BIST 100 Karşılaştırma */}
      {bistComparison.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="glass-card rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <BarChart3 className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-foreground">Portföy vs BIST 100 Performansı</h2>
          </div>
          <div style={{ height: 220 }} className="px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bistComparison} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'portfolio' ? 'Portföyüm' : 'BIST 100']}
                />
                <Area type="monotone" dataKey="portfolio" stroke="#3B82F6" strokeWidth={2} fill="url(#compGrad)" dot={false} />
                <Line type="monotone" dataKey="bist100" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <defs>
                  <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 pb-3">
            <div className="flex items-center gap-2 text-xs"><div className="w-3 h-0.5 bg-[#3B82F6] rounded"></div><span className="text-muted-foreground">Portföyüm</span></div>
            <div className="flex items-center gap-2 text-xs"><div className="w-3 h-0.5 bg-[#F59E0B] rounded" style={{ borderTop: '1px dashed #F59E0B' }}></div><span className="text-muted-foreground">BIST 100</span></div>
          </div>
        </motion.div>
      )}

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
                        <p className="text-[10px] text-muted-foreground">{p?.name} • {p?.quantity} adet • {p?.openedAt ? new Date(p.openedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</p>
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
                        {formatPercent(pnlPct)}
                      </p>
                    </div>
                  </div>

                  {/* Stop Loss / Take Profit / Trailing */}
                  {(p?.stopLoss || p?.takeProfit || p?.trailingStopPercent) && (
                    <div className="flex gap-2 mt-2 text-[10px] flex-wrap">
                      {p?.stopLoss && <span className="px-2 py-0.5 rounded bg-[#EF4444]/10 text-[#F87171]">SL: {formatNumber(p.stopLoss)}</span>}
                      {p?.takeProfit && <span className="px-2 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E]">TP: {formatNumber(p.takeProfit)}</span>}
                      {p?.trailingStopPercent && <span className="px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">📈 İz: %{p.trailingStopPercent}{p?.trailingStopHighest ? ` (↑${formatNumber(p.trailingStopHighest)})` : ''}</span>}
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
                      {formatNumber(p?.entryPrice)} → {formatNumber(p?.currentPrice)} • {p?.openedAt ? new Date(p.openedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) : ''} → {p?.closedAt ? new Date(p.closedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) : '-'}
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
