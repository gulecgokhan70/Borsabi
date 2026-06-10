'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Crown, Star, Zap, TrendingUp, BarChart3, Shield, Award, Calendar, Edit3, Check, X } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/constants';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    icon: User,
    color: '#94A3B8',
    features: ['5 aktif alarm', 'Temel tarama', '3 backtest/gün', 'Standart gösterge'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Crown,
    color: '#3B82F6',
    features: ['50 aktif alarm', 'Algoritmik tarama', 'Sınırsız backtest', 'Strateji oluşturucu', 'Gelişmiş göstergeler', 'Öncelikli AI analiz', 'API erişimi', 'Özel stratejiler'],
  },
];

export default function ProfileClient() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setProfile(d);
      setNewName(d.name || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleNameSave = async () => {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setProfile((p: any) => ({ ...p, name: newName }));
      setEditingName(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setUpgrading(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    if (res.ok) {
      setProfile((p: any) => ({ ...p, tier }));
    }
    setUpgrading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!profile) return <div className="text-center text-muted-foreground py-20">Profil yüklenemedi.</div>;

  const effectiveTier = profile.tier === 'elite' ? 'pro' : profile.tier;
  const currentTier = TIERS.find(t => t.id === effectiveTier) || TIERS[0];
  const TierIcon = currentTier.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center">
          <User className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Profil</h1>
          <p className="text-xs text-muted-foreground">Hesap bilgileri ve paket yönetimi</p>
        </div>
      </motion.div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${currentTier.color}20`, border: `2px solid ${currentTier.color}` }}>
            <TierIcon className="w-8 h-8" style={{ color: currentTier.color }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-1 text-foreground text-sm focus:outline-none focus:border-[#3B82F6]" />
                  <button onClick={handleNameSave} className="p-1 text-[#22C55E] hover:bg-[#22C55E]/10 rounded"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="p-1 text-[#EF4444] hover:bg-[#EF4444]/10 rounded"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-foreground">{profile.name || 'Trader'}</h2>
                  <button onClick={() => setEditingName(true)} className="p-1 text-muted-foreground hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${currentTier.color}20`, color: currentTier.color }}>
                {currentTier.name}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Üye: {new Date(profile.memberSince).toLocaleDateString('tr-TR')}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Bakiye', value: formatCurrency(profile.balance), icon: Zap, color: '#3B82F6' },
            { label: 'Toplam Getiri', value: formatPercent(profile.totalReturn), icon: TrendingUp, color: profile.totalReturn >= 0 ? '#22C55E' : '#EF4444' },
            { label: 'Toplam İşlem', value: profile.totalTrades.toString(), icon: BarChart3, color: '#8B5CF6' },
            { label: 'Kazanç Oranı', value: `%${profile.winRate.toFixed(1)}`, icon: Shield, color: '#F59E0B' },
          ].map((s, i) => (
            <div key={i} className="glass-inner rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tier Selection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Crown className="w-4 h-4 text-[#F59E0B]" /> Paket Seçimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isActive = effectiveTier === tier.id;
            return (
              <div key={tier.id}
                className={`glass-card rounded-xl p-5 transition-all ${
                  isActive ? 'border-2' : 'hover:border-black/[0.1] dark:border-white/[0.12]'
                }`}
                style={isActive ? { borderColor: tier.color } : {}}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5" style={{ color: tier.color }} />
                  <span className="font-bold text-foreground">{tier.name}</span>
                  {isActive && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E]">Aktif</span>}
                </div>
                <ul className="space-y-1.5 mb-4">
                  {tier.features.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check className="w-3 h-3" style={{ color: tier.color }} /> {f}
                    </li>
                  ))}
                </ul>
                {!isActive && (
                  <button onClick={() => handleUpgrade(tier.id)} disabled={upgrading}
                    className="w-full py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: tier.color }}>
                    {upgrading ? 'Yükleniyor...' : tier.id === 'free' ? 'Geç' : 'Seç'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">* Bu bir simülasyon platformudur. Paket değişikliği özellik erişimini değiştirir.</p>
      </motion.div>

      {/* Achievements Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#F59E0B]" /> Başarılar
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[#F59E0B]">{profile.achievements?.length || 0}</span>
          <span className="text-sm text-muted-foreground">rozet kazanıldı</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Detaylar için Başarılar sayfasını ziyaret edin.</p>
      </motion.div>

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
