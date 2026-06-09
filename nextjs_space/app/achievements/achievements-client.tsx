'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Lock, Unlock, Star } from 'lucide-react';

export default function AchievementsClient() {
  const [badges, setBadges] = useState<any[]>([]);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/achievements').then(r => r.json()).then(d => {
      setBadges(d.badges || []);
      setNewBadges(d.newBadges || []);
      setStats(d.stats || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const unlocked = badges.filter((b: any) => b.unlocked);
  const locked = badges.filter((b: any) => !b.unlocked);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#8B5CF6] flex items-center justify-center">
          <Award className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Başarı Rozetleri</h1>
          <p className="text-xs text-muted-foreground">{unlocked.length}/{badges.length} rozet kazanıldı</p>
        </div>
      </motion.div>

      {/* New Badges Notification */}
      {newBadges.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-[#F59E0B]/20 to-[#22C55E]/20 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-[#F59E0B]">🎉 Yeni Rozet Kazanıldı!</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            {newBadges.map((id: string) => {
              const badge = badges.find((b: any) => b.id === id);
              return badge ? (
                <span key={id} className="text-2xl" title={badge.name}>{badge.icon}</span>
              ) : null;
            })}
          </div>
        </motion.div>
      )}

      {/* Progress */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">İlerleme</span>
          <span className="text-sm font-bold text-[#F59E0B]">{unlocked.length}/{badges.length}</span>
        </div>
        <div className="w-full h-3 glass-inner rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#22C55E] rounded-full transition-all"
            style={{ width: `${badges.length > 0 ? (unlocked.length / badges.length) * 100 : 0}%` }} />
        </div>
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="glass-inner rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{stats.totalTrades}</p>
              <p className="text-xs text-muted-foreground">Toplam İşlem</p>
            </div>
            <div className="glass-inner rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-[#22C55E]">{stats.winRate?.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Kazanç Oranı</p>
            </div>
            <div className="glass-inner rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-[#3B82F6]">{stats.uniqueSymbols}</p>
              <p className="text-xs text-muted-foreground">Farklı Sembol</p>
            </div>
            <div className="glass-inner rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-[#F59E0B]">{stats.maxWinStreak}</p>
              <p className="text-xs text-muted-foreground">En Uzun Seri</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Unlocked Badges */}
      {unlocked.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-[#22C55E]" /> Kazanılan Rozetler ({unlocked.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {unlocked.map((badge: any, idx: number) => (
              <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                className="glass-card rounded-xl p-4 text-center hover:border-[#F59E0B]/50 transition">
                <div className="text-3xl mb-2">{badge.icon}</div>
                <p className="text-sm font-bold text-foreground">{badge.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
                {badge.unlockedAt && (
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(badge.unlockedAt).toLocaleDateString('tr-TR')}</p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Locked Badges */}
      {locked.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Kilitli Rozetler ({locked.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {locked.map((badge: any) => (
              <div key={badge.id} className="glass-card rounded-xl p-4 text-center opacity-70">
                <div className="text-3xl mb-2 grayscale">{badge.icon}</div>
                <p className="text-sm font-bold text-foreground">{badge.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
