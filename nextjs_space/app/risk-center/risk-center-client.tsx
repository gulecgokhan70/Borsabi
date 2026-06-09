'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, RefreshCw, AlertTriangle, AlertCircle, Info,
  TrendingUp, TrendingDown, Wallet, PieChart, BarChart3,
  Target, Activity, CheckCircle2, XCircle
} from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/constants';
import { useRouter } from 'next/navigation';

interface RiskData {
  summary: {
    portfolioValue: number;
    balance: number;
    totalPositionValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    todayPnL: number;
    todayPnLPercent: number;
    weekPnL: number;
    weekPnLPercent: number;
    openPositionCount: number;
    totalExposure: number;
    cashRatio: number;
    riskScore: number;
    riskLevel: string;
  };
  stats: {
    totalTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    maxRiskPerTrade: number;
    dailyLossLimit: number;
  };
  positions: Array<{
    id: string;
    symbol: string;
    name: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    positionValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    portfolioWeight: number;
    stopLoss: number | null;
    takeProfit: number | null;
    stopLossRisk: number | null;
    riskLevel: string;
    hasStopLoss: boolean;
  }>;
  warnings: Array<{ type: string; message: string }>;
}

export function RiskCenterClient() {
  const router = useRouter();
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/risk-center');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Risk center fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      default: return '#22C55E';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'critical': return 'Kritik';
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      default: return 'Düşük';
    }
  };

  const getWarningIcon = (type: string) => {
    switch (type) {
      case 'danger': return <XCircle className="w-4 h-4 text-[#EF4444]" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
      default: return <Info className="w-4 h-4 text-[#3B82F6]" />;
    }
  };

  const getWarningBg = (type: string) => {
    switch (type) {
      case 'danger': return 'bg-[#EF4444]/10 border-[#EF4444]/30';
      case 'warning': return 'bg-[#F59E0B]/10 border-[#F59E0B]/30';
      default: return 'bg-[#3B82F6]/10 border-[#3B82F6]/30';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <RefreshCw className="w-8 h-8 text-[#3B82F6] animate-spin mb-4" />
        <p className="text-[#94A3B8]">Risk analizi yapılıyor...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-32">
        <Shield className="w-12 h-12 text-[#64748B] mx-auto mb-3" />
        <p className="text-[#94A3B8]">Risk verileri yüklenemedi</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-[#3B82F6] text-white rounded-lg text-sm">
          Tekrar Dene
        </button>
      </div>
    );
  }

  const { summary, stats, positions, warnings } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#EF4444]" />
            </div>
            Risk Merkezi
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">Portföy riskinizi kontrol altında tutun</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Güncelle
        </button>
      </div>

      {/* Risk Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Score circle */}
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" strokeWidth="8" stroke="#334155" fill="none" />
                <circle
                  cx="50" cy="50" r="42" strokeWidth="8" fill="none"
                  stroke={getRiskColor(summary.riskLevel)}
                  strokeDasharray={`${(summary.riskScore / 100) * 264} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{summary.riskScore}</span>
                <span className="text-[10px] uppercase" style={{ color: getRiskColor(summary.riskLevel) }}>
                  {getRiskLabel(summary.riskLevel)}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Risk Skoru</h3>
              <p className="text-sm text-[#94A3B8] mt-1">
                {summary.riskScore < 50 ? 'Portföyünüz güvenli bölgede.' :
                 summary.riskScore < 65 ? 'Orta seviye risk. Dikkatli olun.' :
                 summary.riskScore < 80 ? 'Yüksek risk! Pozisyonlarınızı gözden geçirin.' :
                 'Kritik risk seviyesi! Hemen önlem alın.'}
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0F172A] rounded-lg p-3">
              <p className="text-xs text-[#64748B]">Portföy Değeri</p>
              <p className="text-lg font-bold text-white">{formatCurrency(summary.portfolioValue)}</p>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <p className="text-xs text-[#64748B]">Toplam K/Z</p>
              <p className={`text-lg font-bold ${summary.totalPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {formatCurrency(summary.totalPnL)}
              </p>
              <p className={`text-xs ${summary.totalPnLPercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {formatPercent(summary.totalPnLPercent)}
              </p>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <p className="text-xs text-[#64748B]">Nakit Oranı</p>
              <p className="text-lg font-bold text-white">%{formatNumber(summary.cashRatio, 1)}</p>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <p className="text-xs text-[#64748B]">Açık Pozisyon</p>
              <p className="text-lg font-bold text-white">{summary.openPositionCount}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            Uyarılar ({warnings.length})
          </h3>
          {warnings.map((w, idx) => (
            <div key={idx} className={`${getWarningBg(w.type)} border rounded-xl p-4 flex items-start gap-3`}>
              {getWarningIcon(w.type)}
              <p className="text-sm text-[#CBD5E1]">{w.message}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* PnL Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-sm font-medium text-[#94A3B8]">Günlük K/Z</span>
          </div>
          <p className={`text-2xl font-bold ${summary.todayPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatCurrency(summary.todayPnL)}
          </p>
          <p className={`text-sm ${summary.todayPnLPercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatPercent(summary.todayPnLPercent)}
          </p>
          <div className="mt-3 h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.abs(summary.todayPnLPercent) / 3 * 100)}%`,
                backgroundColor: summary.todayPnLPercent >= 0 ? '#22C55E' : '#EF4444',
              }}
            />
          </div>
          <p className="text-[10px] text-[#64748B] mt-1">Günlük limit: %3</p>
        </div>

        <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm font-medium text-[#94A3B8]">Haftalık K/Z</span>
          </div>
          <p className={`text-2xl font-bold ${summary.weekPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatCurrency(summary.weekPnL)}
          </p>
          <p className={`text-sm ${summary.weekPnLPercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatPercent(summary.weekPnLPercent)}
          </p>
          <div className="mt-3 h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.abs(summary.weekPnLPercent) / 6 * 100)}%`,
                backgroundColor: summary.weekPnLPercent >= 0 ? '#22C55E' : '#EF4444',
              }}
            />
          </div>
          <p className="text-[10px] text-[#64748B] mt-1">Haftalık limit: %6</p>
        </div>

        <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-[#22C55E]" />
            <span className="text-sm font-medium text-[#94A3B8]">İşlem İstatistikleri</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-[#64748B]">Toplam İşlem</span>
              <span className="text-sm font-medium text-white">{stats.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#64748B]">Kazanç Oranı</span>
              <span className={`text-sm font-medium ${stats.winRate >= 50 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                %{formatNumber(stats.winRate, 1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#64748B]">Ort. Kazanç</span>
              <span className="text-sm font-medium text-[#22C55E]">{formatCurrency(stats.avgWin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#64748B]">Ort. Kayıp</span>
              <span className="text-sm font-medium text-[#EF4444]">{formatCurrency(stats.avgLoss)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#64748B]">Kâr Faktörü</span>
              <span className={`text-sm font-medium ${stats.profitFactor >= 1.5 ? 'text-[#22C55E]' : stats.profitFactor >= 1 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                {formatNumber(stats.profitFactor, 2)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Position Risk Table */}
      {positions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden"
        >
          <div className="p-5 border-b border-[#334155]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-[#3B82F6]" />
              Pozisyon Risk Analizi
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  {['Hisse', 'Değer', 'K/Z', 'Ağırlık', 'Stop Loss', 'Risk'].map((h) => (
                    <th key={h} className="text-left text-[10px] uppercase text-[#94A3B8] px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-[#334155]/50 hover:bg-[#0F172A]/30">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(pos.symbol)}`)}>{pos.symbol}</p>
                      <p className="text-xs text-[#64748B]">{pos.quantity} adet</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{formatCurrency(pos.positionValue)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`text-sm font-medium ${pos.unrealizedPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {formatCurrency(pos.unrealizedPnL)}
                      </p>
                      <p className={`text-xs ${pos.unrealizedPnLPercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {formatPercent(pos.unrealizedPnLPercent)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, pos.portfolioWeight)}%`,
                              backgroundColor: pos.portfolioWeight > 20 ? '#EF4444' : pos.portfolioWeight > 10 ? '#F59E0B' : '#22C55E',
                            }}
                          />
                        </div>
                        <span className="text-xs text-[#94A3B8]">%{formatNumber(pos.portfolioWeight, 1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {pos.hasStopLoss ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                          <span className="text-xs text-[#22C55E]">{formatCurrency(pos.stopLoss ?? 0)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                          <span className="text-xs text-[#EF4444]">Yok!</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: `${getRiskColor(pos.riskLevel)}15`,
                          color: getRiskColor(pos.riskLevel),
                        }}
                      >
                        {getRiskLabel(pos.riskLevel)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Risk Rules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#F59E0B]" />
          Risk Yönetimi Kuralları
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { rule: 'İşlem Başına Risk', value: `Max %${stats.maxRiskPerTrade}`, icon: Target },
            { rule: 'Günlük Zarar Limiti', value: `Max %${stats.dailyLossLimit}`, icon: Activity },
            { rule: 'Haftalık Zarar Limiti', value: 'Max %6', icon: BarChart3 },
            { rule: 'Minimum R/G Oranı', value: '1:2', icon: TrendingUp },
            { rule: 'Stop Loss Zorunluluğu', value: 'Her işlemde', icon: Shield },
            { rule: 'Altın Kural', value: 'Önce sermayeyi koru', icon: Wallet },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-[#0F172A]/50 rounded-lg p-3">
              <item.icon className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#94A3B8]">{item.rule}</p>
                <p className="text-sm font-medium text-white">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Golden Rule */}
      <div className="text-center py-6 space-y-2">
        <p className="text-sm text-[#F59E0B] font-medium">
          "İşlem açmak zorunda değilsin. En iyi işlem bazen işlem yapmamaktır."
        </p>
        <p className="text-xs text-[#64748B]">
          ⚠️ Bu platform eğitim ve simülasyon amaçlıdır. Yatırım tavsiyesi içermez.
        </p>
      </div>
    </div>
  );
}
