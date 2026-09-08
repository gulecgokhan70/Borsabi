'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Loader2, TrendingUp, TrendingDown, Target, Award, BarChart3, DollarSign, ArrowRight, Clock } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/constants';
import Link from 'next/link';

export function TradeLogClient() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

  useEffect(() => {
    fetch('/api/transactions')
      .then((r: any) => r?.json?.())
      .then((data: any) => {
        setTransactions(data?.transactions ?? []);
        setStats(data?.stats ?? null);
      })
      .catch((e: any) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filteredTx = transactions.filter((t: any) => {
    if (filter === 'all') return true;
    return t?.type === filter.toUpperCase();
  });

  const getPnlDisplay = (t: any) => {
    // SELL transactions have realized pnl
    if (t?.type === 'SELL' && t?.pnl != null) {
      return {
        value: t.pnl,
        percent: t.pnlPercent,
        label: 'Gerçekleşen',
        isRealized: true,
      };
    }
    // BUY transactions may have unrealized pnl from open positions
    if (t?.type === 'BUY' && t?.unrealizedPnl != null) {
      return {
        value: t.unrealizedPnl,
        percent: t.unrealizedPnlPercent,
        label: 'Açık Pozisyon',
        isRealized: false,
      };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">İşlem Günlüğü</h1>
        <p className="text-sm text-muted-foreground">Tüm alış/satış işlemlerinizin kaydı ve performans istatistikleri</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-muted-foreground">Toplam İşlem</span></div>
            <p className="text-lg font-bold font-mono text-foreground">{stats?.totalTrades ?? 0}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-[#22C55E]" /><span className="text-xs text-muted-foreground">Kazanç Oranı</span></div>
            <p className="text-lg font-bold font-mono text-foreground">{formatNumber(stats?.winRate, 1)}%</p>
            <p className="text-xs text-muted-foreground">{stats?.winCount ?? 0}K / {stats?.lossCount ?? 0}Z</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2"><DollarSign className={`w-4 h-4 ${(stats?.totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`} /><span className="text-xs text-muted-foreground">Toplam K/Z</span></div>
            <p className={`text-lg font-bold font-mono ${(stats?.totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{formatCurrency(stats?.totalPnl)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-[#22C55E]" /><span className="text-xs text-muted-foreground">Ort. Kazanç</span></div>
            <p className="text-sm font-bold font-mono text-[#22C55E]">{formatCurrency(stats?.avgWin)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-[#F87171]" /><span className="text-xs text-muted-foreground">Ort. Kayıp</span></div>
            <p className="text-sm font-bold font-mono text-[#F87171]">{formatCurrency(stats?.avgLoss)}</p>
          </motion.div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all', label: 'Tümü', count: transactions.length },
          { key: 'buy', label: 'Alış', count: transactions.filter((t: any) => t?.type === 'BUY').length },
          { key: 'sell', label: 'Satış', count: transactions.filter((t: any) => t?.type === 'SELL').length },
        ].map((f: any) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-[#3B82F6] text-white'
                : 'glass-card text-muted-foreground hover:text-foreground border border-black/[0.08] dark:border-white/[0.08]'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Transactions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
          <ScrollText className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-foreground">İşlem Geçmişi</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" /></div>
        ) : (filteredTx?.length ?? 0) === 0 ? (
          <div className="p-8 text-center">
            <ScrollText className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Henüz işlem yapılmamış</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Dashboard&#39;dan hisse seçerek ilk işleminizi yapın</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {filteredTx.map((t: any) => {
              const pnlInfo = getPnlDisplay(t);
              return (
                <div key={t?.id} className="px-4 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left: Type badge + Symbol + Date */}
                    <div className="flex items-center gap-3 sm:w-[280px]">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        t?.type === 'BUY' ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'
                      }`}>
                        {t?.type === 'BUY' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/stock/${encodeURIComponent(t?.symbol ?? '')}`} className="font-semibold text-foreground hover:text-[#3B82F6] transition-colors">
                            {t?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}
                          </Link>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            t?.type === 'BUY' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                          }`}>
                            {t?.type === 'BUY' ? 'ALIŞ' : 'SATIŞ'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{t?.createdAt ? new Date(t.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Native quote and TRY settlement */}
                    <div className="flex items-center gap-2 sm:flex-1">
                      <div className="glass-inner rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t?.quantity} adet</span>
                        <span className="text-slate-400 dark:text-slate-500">×</span>
                        <span className="text-xs font-mono text-foreground">{formatCurrency(t?.price, t?.marketType === 'CRYPTO' ? 'USD' : 'TRY')}</span>
                        <span className="text-slate-400 dark:text-slate-500">→</span>
                        <span className="text-xs font-mono font-semibold text-foreground">{formatCurrency(t?.total)}</span>
                      </div>
                      {(t?.commission > 0 || t?.marketType === 'CRYPTO') && (
                        <span className="text-[10px] text-[#F59E0B]">Kom: {formatCurrency(t?.commission)}
                          {t?.marketType === 'CRYPTO' && <span className="block text-muted-foreground">{t?.fxRate ? `İşlem kuru: ${formatCurrency(t.fxRate)} / USD` : 'Eski kayıt: kur uygulanmamış'}</span>}</span>
                      )}
                    </div>

                    {/* Right: PnL */}
                    <div className="sm:w-[180px] sm:text-right">
                      {pnlInfo ? (
                        <div>
                          <div className="flex items-center sm:justify-end gap-1.5">
                            <span className={`text-sm font-bold font-mono ${
                              pnlInfo.value >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'
                            }`}>
                              {pnlInfo.value >= 0 ? '+' : ''}{formatCurrency(pnlInfo.value)}
                            </span>
                            {pnlInfo.percent != null && (
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                pnlInfo.value >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#F87171]'
                              }`}>
                                {pnlInfo.percent >= 0 ? '+' : ''}{formatNumber(pnlInfo.percent, 1)}%
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] ${
                            pnlInfo.isRealized ? 'text-slate-400 dark:text-slate-500' : 'text-[#F59E0B]'
                          }`}>
                            {pnlInfo.isRealized ? '✓ Gerçekleşen K/Z' : '◌ Açık Pozisyon'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </div>
                  </div>
                  {t?.note && (
                    <p className="text-xs text-muted-foreground mt-1.5 ml-12 italic">&quot;{t.note}&quot;</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pb-4">⚠️ Bu platform simülasyon amaçlıdır. Yatırım tavsiyesi içermez.</p>
    </div>
  );
}
