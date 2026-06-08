'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Loader2, TrendingUp, TrendingDown, Target, Award, BarChart3, DollarSign } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/constants';

export function TradeLogClient() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">İşlem Günlüğü</h1>
        <p className="text-sm text-[#94A3B8]">Tüm alış/satış işlemlerinizin kaydı ve performans istatistikleri</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-[#3B82F6]" /><span className="text-xs text-[#94A3B8]">Toplam İşlem</span></div>
            <p className="text-lg font-bold font-mono text-white">{stats?.totalTrades ?? 0}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-[#22C55E]" /><span className="text-xs text-[#94A3B8]">Kazanç Oranı</span></div>
            <p className="text-lg font-bold font-mono text-white">{formatNumber(stats?.winRate, 1)}%</p>
            <p className="text-xs text-[#94A3B8]">{stats?.winCount ?? 0}K / {stats?.lossCount ?? 0}Z</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="flex items-center gap-2 mb-2"><DollarSign className={`w-4 h-4 ${(stats?.totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`} /><span className="text-xs text-[#94A3B8]">Toplam K/Z</span></div>
            <p className={`text-lg font-bold font-mono ${(stats?.totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatCurrency(stats?.totalPnl)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-[#F59E0B]" /><span className="text-xs text-[#94A3B8]">Ort. K/Z</span></div>
            <div className="flex gap-3">
              <span className="text-xs"><span className="text-[#22C55E] font-mono">{formatCurrency(stats?.avgWin)}</span></span>
              <span className="text-xs"><span className="text-[#EF4444] font-mono">{formatCurrency(stats?.avgLoss)}</span></span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Transactions table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#1E293B] rounded-xl border border-[#334155]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
          <ScrollText className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-white">İşlem Geçmişi</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" /></div>
        ) : (transactions?.length ?? 0) === 0 ? (
          <div className="p-8 text-center">
            <ScrollText className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
            <p className="text-sm text-[#94A3B8]">Henüz işlem yapılmamış</p>
            <p className="text-xs text-[#64748B] mt-1">Dashboard'dan hisse seçerek ilk işleminizi yapın</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[#94A3B8] border-b border-[#334155]">
                <th className="text-left px-4 py-2">Tarih</th>
                <th className="text-left px-4 py-2">Sembol</th>
                <th className="text-center px-4 py-2">Tür</th>
                <th className="text-right px-4 py-2">Miktar</th>
                <th className="text-right px-4 py-2">Fiyat</th>
                <th className="text-right px-4 py-2">Toplam</th>
                <th className="text-right px-4 py-2">Komisyon</th>
                <th className="text-right px-4 py-2">K/Z</th>
                <th className="text-left px-4 py-2">Not</th>
              </tr></thead>
              <tbody className="divide-y divide-[#334155]/50">
                {transactions.map((t: any) => (
                  <tr key={t?.id} className="hover:bg-[#334155]/20">
                    <td className="px-4 py-2.5 text-xs text-[#94A3B8]">{t?.createdAt ? new Date(t.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-white">{t?.symbol?.replace?.('.IS', '')?.replace?.('-USD', '')}</p>
                      <p className="text-[10px] text-[#64748B]">{t?.name}</p>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        t?.type === 'BUY' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                      }`}>
                        {t?.type === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t?.type === 'BUY' ? 'Alış' : 'Satış'}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5 font-mono text-white">{t?.quantity}</td>
                    <td className="text-right px-4 py-2.5 font-mono text-white">{formatNumber(t?.price)}</td>
                    <td className="text-right px-4 py-2.5 font-mono text-white">{formatCurrency(t?.total)}</td>
                    <td className="text-right px-4 py-2.5 font-mono text-xs text-[#F59E0B]">{formatCurrency(t?.commission)}</td>
                    <td className={`text-right px-4 py-2.5 font-mono font-semibold ${t?.pnl != null ? ((t?.pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]') : 'text-[#64748B]'}`}>
                      {t?.pnl != null ? formatCurrency(t?.pnl) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#94A3B8] max-w-[120px] truncate">{t?.note ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="text-[10px] text-[#64748B] text-center pb-4">⚠️ Bu platform simülasyon amaçlıdır. Yatırım tavsiyesi içermez.</p>
    </div>
  );
}
