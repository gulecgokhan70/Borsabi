'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Briefcase, Bot, Search, ScrollText, Eye, LogOut, Menu, X, TrendingUp, Shield, Zap, Waves, GraduationCap, FlaskConical,
  User, ScanSearch, Wrench, Trophy, Bell, Award, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolio', label: 'Portföy', icon: Briefcase },
  { href: '/day-trading', label: 'Day Trading', icon: Zap },
  { href: '/swing-trading', label: 'Swing Trading', icon: Waves },
  { href: '/ai-assistant', label: 'Master AI', icon: Bot },
  { href: '/screening', label: 'Tarama', icon: Search },
  { href: '/risk-center', label: 'Risk Merkezi', icon: Shield },
  { href: '/trade-log', label: 'İşlem Günlüğü', icon: ScrollText },
  { href: '/watchlist', label: 'İzleme Listesi', icon: Eye },
  { href: '/academy', label: 'Akademi', icon: GraduationCap },
  { href: '/backtest', label: 'Backtest', icon: FlaskConical },
  { href: '/algo-scan', label: 'Algo Tarama', icon: ScanSearch },
  { href: '/strategy-builder', label: 'Strateji', icon: Wrench },
  { href: '/leaderboard', label: 'Liderlik', icon: Trophy },
  { href: '/alerts', label: 'Alarmlar', icon: Bell },
  { href: '/achievements', label: 'Rozetler', icon: Award },
  { href: '/aksam-analizi', label: 'Akşam Analizi', icon: Moon },
  { href: '/profile', label: 'Profil', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass-sidebar transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
            <div className="w-9 h-9 rounded-lg bg-[#3B82F6] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Master Trader</h1>
              <p className="text-[10px] text-[#94A3B8] tracking-wider uppercase">Simülasyon</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-[#94A3B8] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
            {NAV_ITEMS.map((item: any) => {
              const isActive = pathname === item?.href || pathname?.startsWith?.(item?.href + '/');
              const Icon = item?.icon;
              return (
                <Link
                  key={item?.href}
                  href={item?.href ?? '#'}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#3B82F6]/10 text-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                  {item?.label}
                </Link>
              );
            })}
          </nav>

          {/* Risk info */}
          <div className="px-4 py-3 mx-3 mb-3 rounded-lg glass-inner">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs font-semibold text-[#F59E0B]">Risk Yönetimi</span>
            </div>
            <p className="text-[10px] text-[#94A3B8] leading-relaxed">İşlem başına max %1 risk, günlük max %3 zarar limiti</p>
          </div>

          {/* User */}
          <div className="px-4 py-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{session?.user?.name ?? 'Trader'}</p>
                <p className="text-xs text-[#94A3B8] truncate">{session?.user?.email ?? ''}</p>
              </div>
              <button
                onClick={() => signOut?.({ callbackUrl: '/login' })}
                className="p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                title="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass-nav lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.05]">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
            <span className="font-bold text-white">Master Trader</span>
          </div>
        </div>
        <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
