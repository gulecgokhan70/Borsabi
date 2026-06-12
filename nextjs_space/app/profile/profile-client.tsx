'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Crown, Star, Zap, TrendingUp, BarChart3, Shield, Award, Calendar, Edit3, Check, X, LogOut, Percent, Save } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { formatCurrency, formatPercent } from '@/lib/constants';

const AVATARS = [
  // Hayvanlar
  { id: 'bear', emoji: '🐻', label: 'Ayı' },
  { id: 'bull', emoji: '🐂', label: 'Boğa' },
  { id: 'eagle', emoji: '🦅', label: 'Kartal' },
  { id: 'wolf', emoji: '🐺', label: 'Kurt' },
  { id: 'lion', emoji: '🦁', label: 'Aslan' },
  { id: 'shark', emoji: '🦈', label: 'Köpekbalığı' },
  { id: 'dragon', emoji: '🐉', label: 'Ejderha' },
  { id: 'fox', emoji: '🦊', label: 'Tilki' },
  // Trader temaları
  { id: 'rocket', emoji: '🚀', label: 'Roket' },
  { id: 'gem', emoji: '💎', label: 'Elmas' },
  { id: 'fire', emoji: '🔥', label: 'Ateş' },
  { id: 'lightning', emoji: '⚡', label: 'Şimşek' },
  { id: 'star', emoji: '⭐', label: 'Yıldız' },
  { id: 'crown', emoji: '👑', label: 'Taç' },
  { id: 'money', emoji: '💰', label: 'Para' },
  { id: 'chart', emoji: '📈', label: 'Grafik' },
  // Yüzler
  { id: 'cool', emoji: '😎', label: 'Havalı' },
  { id: 'nerd', emoji: '🤓', label: 'Zeki' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'alien', emoji: '👽', label: 'Uzaylı' },
  { id: 'robot', emoji: '🤖', label: 'Robot' },
  { id: 'ghost', emoji: '👻', label: 'Hayalet' },
  { id: 'pirate', emoji: '🏴\u200d☠️', label: 'Korsan' },
  { id: 'wizard', emoji: '🧙', label: 'Büyücü' },
];

function getAvatarEmoji(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  const found = AVATARS.find(a => a.id === avatarId);
  return found?.emoji ?? null;
}

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
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [commissionInput, setCommissionInput] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setProfile(d);
      setNewName(d.name || '');
      setCommissionInput(((d.commissionRate ?? 0.002) * 100).toFixed(2));
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

  const handleAvatarSelect = async (avatarId: string) => {
    setSavingAvatar(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: avatarId }),
    });
    if (res.ok) {
      setProfile((p: any) => ({ ...p, avatar: avatarId }));
    }
    setSavingAvatar(false);
    setAvatarPickerOpen(false);
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
          <button
            onClick={() => setAvatarPickerOpen(true)}
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center group transition-all duration-200 hover:scale-105"
            style={{ background: `${currentTier.color}15`, border: `2px solid ${currentTier.color}40` }}
          >
            {getAvatarEmoji(profile.avatar) ? (
              <span className="text-4xl">{getAvatarEmoji(profile.avatar)}</span>
            ) : (
              <TierIcon className="w-10 h-10" style={{ color: currentTier.color }} />
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
          </button>
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
            { label: 'Portföy Değeri', value: formatCurrency(profile.totalPortfolioValue ?? profile.balance), icon: Zap, color: '#3B82F6' },
            { label: 'Toplam Getiri', value: formatPercent(profile.totalReturn), icon: TrendingUp, color: profile.totalReturn >= 0 ? '#22C55E' : '#EF4444' },
            { label: 'Toplam İşlem', value: ((profile.totalTrades ?? 0) + (profile.openPositions ?? 0)).toString(), icon: BarChart3, color: '#8B5CF6' },
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

      {/* Komisyon Oranı Ayarı */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Percent className="w-4 h-4 text-[#8B5CF6]" /> Komisyon Oranı
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          İşlemlerinizde uygulanacak komisyon oranını belirleyin. Varsayılan: %0.20
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 flex-1">
            <span className="text-sm text-muted-foreground">%</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={commissionInput}
              onChange={e => setCommissionInput(e.target.value)}
              className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-[#8B5CF6] w-full"
              placeholder="0.20"
            />
          </div>
          <div className="flex gap-1">
            {['0', '0.10', '0.20', '0.40'].map(v => (
              <button
                key={v}
                onClick={() => setCommissionInput(v)}
                className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  commissionInput === v
                    ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40'
                    : 'glass-inner text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                %{v}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={async () => {
            setSavingCommission(true);
            const rate = parseFloat(commissionInput) / 100;
            if (isNaN(rate) || rate < 0 || rate > 1) {
              setSavingCommission(false);
              return;
            }
            const res = await fetch('/api/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ commissionRate: rate }),
            });
            if (res.ok) {
              setProfile((p: any) => ({ ...p, commissionRate: rate }));
            }
            setSavingCommission(false);
          }}
          disabled={savingCommission}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white bg-[#8B5CF6] hover:bg-[#7C3AED] transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {savingCommission ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <button
          onClick={() => signOut?.({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold text-[#EF4444] glass-card border border-[#EF4444]/20 hover:bg-[#EF4444]/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          Çıkış Yap
        </button>
      </motion.div>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {avatarPickerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/[0.65]"
              onClick={() => setAvatarPickerOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed z-[80] glass-card shadow-2xl overflow-hidden inset-x-0 bottom-0 rounded-t-2xl sm:rounded-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[92vw] sm:max-w-[420px]"
            >
              <div className="flex justify-center pt-2 pb-0 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h3 className="text-base font-bold text-foreground">Avatar Seç</h3>
                <button onClick={() => setAvatarPickerOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-[55vh] sm:max-h-[60vh] overflow-y-auto">
                {/* Hayvanlar */}
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">🐾 Hayvanlar</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {AVATARS.filter((_, i) => i < 8).map((av) => (
                    <button
                      key={av.id}
                      onClick={() => handleAvatarSelect(av.id)}
                      disabled={savingAvatar}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-150 ${
                        profile.avatar === av.id
                          ? 'bg-[#3B82F6]/15 border-2 border-[#3B82F6] scale-105'
                          : 'glass-inner hover:bg-black/[0.05] dark:hover:bg-white/[0.05] border-2 border-transparent hover:border-[#3B82F6]/30'
                      }`}
                    >
                      <span className="text-2xl">{av.emoji}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{av.label}</span>
                    </button>
                  ))}
                </div>

                {/* Trader */}
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">💹 Trader</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {AVATARS.filter((_, i) => i >= 8 && i < 16).map((av) => (
                    <button
                      key={av.id}
                      onClick={() => handleAvatarSelect(av.id)}
                      disabled={savingAvatar}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-150 ${
                        profile.avatar === av.id
                          ? 'bg-[#3B82F6]/15 border-2 border-[#3B82F6] scale-105'
                          : 'glass-inner hover:bg-black/[0.05] dark:hover:bg-white/[0.05] border-2 border-transparent hover:border-[#3B82F6]/30'
                      }`}
                    >
                      <span className="text-2xl">{av.emoji}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{av.label}</span>
                    </button>
                  ))}
                </div>

                {/* Karakterler */}
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">🎭 Karakterler</p>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.filter((_, i) => i >= 16).map((av) => (
                    <button
                      key={av.id}
                      onClick={() => handleAvatarSelect(av.id)}
                      disabled={savingAvatar}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-150 ${
                        profile.avatar === av.id
                          ? 'bg-[#3B82F6]/15 border-2 border-[#3B82F6] scale-105'
                          : 'glass-inner hover:bg-black/[0.05] dark:hover:bg-white/[0.05] border-2 border-transparent hover:border-[#3B82F6]/30'
                      }`}
                    >
                      <span className="text-2xl">{av.emoji}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{av.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {savingAvatar && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-2xl">
                  <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
