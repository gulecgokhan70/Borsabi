'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Star, User, TrendingUp, Medal } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/constants';

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  elite: { bg: '#F59E0B20', text: '#F59E0B', label: 'Elite' },
  pro: { bg: '#3B82F620', text: '#3B82F6', label: 'Pro' },
  free: { bg: '#94A3B820', text: '#94A3B8', label: 'Free' },
};

const RANK_STYLES = [
  { bg: 'from-[#F59E0B] to-[#EF4444]', icon: Crown, color: '#F59E0B' },
  { bg: 'from-[#94A3B8] to-[#64748B]', icon: Medal, color: '#C0C0C0' },
  { bg: 'from-[#B45309] to-[#92400E]', icon: Medal, color: '#CD7F32' },
];

export default function LeaderboardClient() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(d => {
      setData(d.leaderboard || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#22C55E] flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Liderlik Tablosu</h1>
          <p className="text-xs text-[#94A3B8]">En başarılı traderlar</p>
        </div>
      </motion.div>

      {/* Top 3 Podium */}
      {data.length >= 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map((idx) => {
            const user = data[idx];
            const style = RANK_STYLES[idx];
            const Icon = style.icon;
            return (
              <div key={idx} className={`bg-[#1E293B] rounded-xl border border-[#334155] p-4 text-center ${idx === 0 ? 'ring-2 ring-[#F59E0B]/30' : ''}`}>
                <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${style.bg} flex items-center justify-center mb-2`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                <p className="text-lg font-bold mt-1" style={{ color: style.color }}>#{user.rank}</p>
                <p className={`text-sm font-medium ${user.totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {formatPercent(user.totalReturn)}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">{formatCurrency(user.balance)}</p>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Full List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#334155]">
          <span className="text-sm font-semibold text-white">Tüm Traderlar ({data.length})</span>
        </div>
        <div className="divide-y divide-[#334155]">
          {data.map((user: any, idx: number) => {
            const tier = TIER_COLORS[user.tier] || TIER_COLORS.free;
            return (
              <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                className="px-5 py-3 flex items-center gap-4 hover:bg-[#0F172A]/30 transition">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : idx === 1 ? 'bg-[#94A3B8]/20 text-[#C0C0C0]' : idx === 2 ? 'bg-[#B45309]/20 text-[#CD7F32]' : 'bg-[#0F172A] text-[#94A3B8]'}`}>
                  {user.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: tier.bg, color: tier.text }}>{tier.label}</span>
                  </div>
                  <p className="text-xs text-[#64748B]">{user.totalTrades} işlem · {user.achievements} rozet</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${user.totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {formatPercent(user.totalReturn)}
                  </p>
                  <p className="text-xs text-[#94A3B8]">{formatCurrency(user.balance)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
