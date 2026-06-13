'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, UserMinus, Trophy, TrendingUp, TrendingDown, Activity, Eye, Star, Search, Filter } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type TabType = 'all' | 'following' | 'top';

export default function SocialClient() {
  const router = useRouter();
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);

  const fetchTraders = useCallback(async () => {
    try {
      const res = await fetch('/api/social');
      const data = await res.json();
      setTraders(data.traders || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTraders(); }, [fetchTraders]);

  const toggleFollow = async (traderId: string, isFollowing: boolean) => {
    setFollowLoading(traderId);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isFollowing ? 'unfollow' : 'follow', targetUserId: traderId }),
      });
      if (res.ok) {
        toast.success(isFollowing ? 'Takipten çıkıldı' : 'Takip edildi!');
        fetchTraders();
      }
    } catch (e) { toast.error('İşlem başarısız'); }
    setFollowLoading(null);
  };

  const filtered = traders.filter(t => {
    if (tab === 'following') return t.isFollowing;
    if (tab === 'top') return t.rank <= 10;
    return true;
  }).filter(t => {
    if (!search) return true;
    return t.name?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sosyal Trading</h1>
            <p className="text-xs text-muted-foreground">Traderları takip edin, stratejileri keşfedin</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs + Search */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {([['all', 'Tümü'], ['following', 'Takip'], ['top', 'Top 10']] as [TabType, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-[#3B82F6] text-white' : 'glass-card text-muted-foreground hover:text-foreground'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Trader ara..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg glass-card border border-black/[0.08] dark:border-white/[0.08] text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" />
        </div>
      </motion.div>

      {/* Trader Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((trader, idx) => (
          <motion.div key={trader.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="glass-card rounded-xl p-4 hover:border-[#3B82F6]/20 transition-all cursor-pointer border border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-start gap-3">
              {/* Avatar + Rank */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B5CF6]/20 to-[#3B82F6]/20 flex items-center justify-center text-xl">
                  {trader.avatar}
                </div>
                {trader.rank <= 3 && (
                  <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    trader.rank === 1 ? 'bg-[#F59E0B] text-black' : trader.rank === 2 ? 'bg-[#C0C0C0] text-black' : 'bg-[#CD7F32] text-white'
                  }`}>
                    {trader.rank}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{trader.name}</span>
                  {trader.isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] font-medium">Sen</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    trader.tier === 'elite' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                    trader.tier === 'pro' ? 'bg-[#3B82F6]/10 text-[#3B82F6]' :
                    'bg-[#94A3B8]/10 text-[#94A3B8]'
                  }`}>{trader.tier?.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{trader.followers} takipçi</span>
                  <span className="text-xs text-muted-foreground">{trader.totalTrades} işlem</span>
                </div>
              </div>

              {/* Follow Button */}
              {!trader.isMe && (
                <button onClick={(e) => { e.stopPropagation(); toggleFollow(trader.id, trader.isFollowing); }}
                  disabled={followLoading === trader.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    trader.isFollowing
                      ? 'glass-card text-muted-foreground hover:text-[#EF4444] hover:border-[#EF4444]/30'
                      : 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                  }`}>
                  {followLoading === trader.id ? (
                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : trader.isFollowing ? (
                    <><UserMinus className="w-3 h-3" /> Takipte</>
                  ) : (
                    <><UserPlus className="w-3 h-3" /> Takip Et</>
                  )}
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="text-center">
                <p className={`text-sm font-bold ${trader.totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {formatPercent(trader.totalReturn)}
                </p>
                <p className="text-[10px] text-muted-foreground">Getiri</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{trader.winRate.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{trader.openPositions}</p>
                <p className="text-[10px] text-muted-foreground">Açık Poz.</p>
              </div>
            </div>

            {/* Open positions preview */}
            {trader.topPositions.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <Eye className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                {trader.topPositions.map((sym: string) => (
                  <span key={sym} className="text-[10px] px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground font-medium">
                    {sym}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {tab === 'following' ? 'Henüz kimseyi takip etmiyorsunuz' : 'Trader bulunamadı'}
          </p>
        </div>
      )}

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
