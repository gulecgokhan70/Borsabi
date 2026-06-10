'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Briefcase, Bot, Search, ScrollText, Eye, LogOut, Menu, X, Shield, Zap, Waves, GraduationCap, FlaskConical,
  User, ScanSearch, Wrench, Trophy, Bell, Award, Moon, Sun, Home, BarChart3, Brain, Compass, Globe, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { BorsaBiLogoFull, BorsaBiLogo } from './logo';

const AVATAR_MAP: Record<string, string> = {
  bear: '🐻', bull: '🐂', eagle: '🦅', wolf: '🐺', lion: '🦁', shark: '🦈', dragon: '🐉', fox: '🦊',
  rocket: '🚀', gem: '💎', fire: '🔥', lightning: '⚡', star: '⭐', crown: '👑', money: '💰', chart: '📈',
  cool: '😎', nerd: '🤓', ninja: '🥷', alien: '👽', robot: '🤖', ghost: '👻', pirate: '🏴\u200d☠️', wizard: '🧙',
};


/* ── Global Quick Search ── */
function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => { const isMobile = window.innerWidth < 640; if (isMobile) mobileInputRef.current?.focus(); else desktopInputRef.current?.focus(); }, 100); }, [open]);

  const [allItems, setAllItems] = useState<any[]>([]);
  useEffect(() => {
    import('@/lib/constants').then(mod => {
      setAllItems([
        ...mod.BIST_ALL_ASSETS.map((a: any) => ({ symbol: a.symbol, name: a.name, shortName: a.shortName, type: 'BIST' })),
        ...mod.CRYPTO_ASSETS.map((a: any) => ({ symbol: a.symbol, name: a.name, shortName: a.shortName, type: 'Kripto' })),
      ]);
    });
  }, []);

  const term = q.toLowerCase().trim();
  const results = term.length >= 1
    ? allItems.filter(i => i.shortName.toLowerCase().includes(term) || i.name.toLowerCase().includes(term)).slice(0, 12)
    : [];

  const go = (sym: string) => { router.push(`/stock/${sym}`); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl glass-inner border border-black/[0.06] dark:border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-[#3B82F6]/30 transition-all text-sm min-w-[180px] lg:min-w-[260px]"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs lg:text-sm">Hisse ara...</span>
        <kbd className="hidden lg:inline-flex ml-auto text-[10px] px-1.5 py-0.5 rounded glass-inner border border-black/[0.06] dark:border-white/[0.08] text-muted-foreground">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[80] inset-0 sm:inset-auto sm:top-[12%] sm:left-1/2 sm:-translate-x-1/2 sm:w-[90vw] sm:max-w-[480px] bg-background sm:bg-transparent flex flex-col sm:block"
            >
              {/* Mobile top bar */}
              <div className="flex items-center gap-2 p-3 sm:hidden">
                <button onClick={() => { setOpen(false); setQ(''); }} className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={mobileInputRef}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && results.length > 0) go(results[0].symbol); }}
                    placeholder="Hisse veya kripto ara..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-inner border border-black/[0.06] dark:border-white/[0.08] text-foreground text-sm focus:border-[#3B82F6] focus:outline-none placeholder-muted-foreground"
                  />
                  {q && (
                    <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop search box */}
              <div className="hidden sm:block glass-card rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      ref={desktopInputRef}
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && results.length > 0) go(results[0].symbol); }}
                      placeholder="Hisse veya kripto ara..."
                      className="w-full pl-10 pr-10 py-3 rounded-xl glass-inner border border-black/[0.06] dark:border-white/[0.08] text-foreground text-sm focus:border-[#3B82F6] focus:outline-none placeholder-muted-foreground"
                    />
                    {q && (
                      <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {term.length < 1 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">Aramak istediğiniz hisseyi veya kriptoyu yazın</div>
                  ) : results.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">Sonuç bulunamadı</div>
                  ) : (
                    results.map((item, i) => (
                      <button
                        key={item.symbol}
                        onClick={() => go(item.symbol)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors border-b border-black/[0.03] dark:border-white/[0.03] last:border-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#3B82F6]">{item.shortName.slice(0, 3)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{item.shortName}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full glass-inner text-muted-foreground">{item.type}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Mobile results */}
              <div className="flex-1 overflow-y-auto sm:hidden">
                {term.length < 1 ? (
                  <div className="px-4 py-12 text-center text-xs text-muted-foreground">Aramak istediğiniz hisseyi veya kriptoyu yazın</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-12 text-center text-xs text-muted-foreground">Sonuç bulunamadı</div>
                ) : (
                  results.map((item, i) => (
                    <button
                      key={item.symbol}
                      onClick={() => go(item.symbol)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:bg-black/[0.08] dark:active:bg-white/[0.08] transition-colors border-b border-black/[0.04] dark:border-white/[0.04] last:border-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#3B82F6]">{item.shortName.slice(0, 3)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{item.shortName}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full glass-inner text-muted-foreground">{item.type}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Ana Sayfa', icon: Home },
  { href: '/piyasalar', label: 'Piyasalar', icon: Globe },
  { href: '/portfolio', label: 'Portföy', icon: Briefcase },
  { href: '/day-trading', label: 'Day Trading', icon: Zap },
  { href: '/swing-trading', label: 'Swing Trading', icon: Waves },
  { href: '/ai-assistant', label: 'BorsaBi AI', icon: Bot },
  { href: '/screening', label: 'Tarama', icon: Search },
  { href: '/kesfet', label: 'Keşfet', icon: Compass },
  { href: '/risk-center', label: 'Risk Merkezi', icon: Shield },
  { href: '/trade-log', label: 'İşlem Günlüğü', icon: ScrollText },
  { href: '/watchlist', label: 'İzleme Listesi', icon: Eye },
  { href: '/aksam-analizi', label: 'Akşam Analizi', icon: Moon },
  { href: '/academy', label: 'Akademi', icon: GraduationCap },
  { href: '/backtest', label: 'Backtest', icon: FlaskConical },
  { href: '/algo-scan', label: 'Algo Tarama', icon: ScanSearch },
  { href: '/strategy-builder', label: 'Strateji', icon: Wrench },
  { href: '/leaderboard', label: 'Liderlik', icon: Trophy },
  { href: '/alerts', label: 'Alarmlar', icon: Bell },
  { href: '/achievements', label: 'Rozetler', icon: Award },
  { href: '/profile', label: 'Profil', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
          <div className="flex items-center px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
            {(session?.user as any)?.avatar && AVATAR_MAP[(session?.user as any)?.avatar] ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg">
                  <span className="text-xl leading-none">{AVATAR_MAP[(session?.user as any)?.avatar]}</span>
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">BorsaBi</p>
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Trader</p>
                </div>
              </div>
            ) : (
              <BorsaBiLogoFull size={36} />
            )}
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-muted-foreground hover:text-foreground">
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#3B82F6]/10 text-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.12)] dark:shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                  {item?.label}
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle + User + Logout */}
          <div className="px-4 py-4 border-t border-black/[0.06] dark:border-white/[0.06] space-y-3">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all duration-200"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-[#F59E0B]" /> : <Moon className="w-5 h-5 text-[#3B82F6]" />}
                {theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
              </button>
            )}
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(session?.user as any)?.avatar ? (
                  <span className="text-lg leading-none">{AVATAR_MAP[(session?.user as any)?.avatar] ?? (session?.user?.name ?? 'T').charAt(0).toUpperCase()}</span>
                ) : (
                  (session?.user?.name ?? 'T').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{session?.user?.name ?? 'Trader'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{session?.user?.email ?? ''}</p>
              </div>
            </div>
            <button
              onClick={() => signOut?.({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Desktop top bar */}
        <div className="hidden lg:flex sticky top-0 z-30 items-center gap-4 px-6 py-3 glass-nav">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            {(session?.user as any)?.avatar && AVATAR_MAP[(session?.user as any)?.avatar] ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg">
                  <span className="text-lg leading-none">{AVATAR_MAP[(session?.user as any)?.avatar]}</span>
                </div>
                <span className="font-bold text-foreground text-sm">BorsaBi</span>
              </div>
            ) : (
              <BorsaBiLogoFull size={28} />
            )}
          </Link>
          <div className="flex-1" />
          <GlobalSearch />
          <div className="flex-1" />
        </div>
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 glass-nav lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="shrink-0">
            {(session?.user as any)?.avatar && AVATAR_MAP[(session?.user as any)?.avatar] ? (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg">
                <span className="text-lg leading-none">{AVATAR_MAP[(session?.user as any)?.avatar]}</span>
              </div>
            ) : (
              <BorsaBiLogo size={28} />
            )}
          </Link>
          <div className="flex-1">
            <GlobalSearch />
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4 text-[#3B82F6]" />}
            </button>
          )}
        </div>
        <div className="p-4 lg:p-6 pb-24 lg:pb-6 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="glass-nav border-t border-black/[0.06] dark:border-white/[0.06] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end justify-around">
            {[
              { href: '/dashboard', label: 'Ana Sayfa', icon: Home },
              { href: '/piyasalar', label: 'Piyasalar', icon: BarChart3 },
              { href: '/ai-assistant', label: 'AI Analiz', icon: Brain, center: true },
              { href: '/portfolio', label: 'Portföyüm', icon: Briefcase },
              { href: '/kesfet', label: 'Keşfet', icon: Compass },
            ].map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith?.(item.href + '/');
              const Icon = item.icon;
              if (item.center) {
                return (
                  <Link key={item.href} href={item.href} className="flex flex-col items-center -mt-5 relative">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] shadow-[#8B5CF6]/30'
                        : 'bg-gradient-to-br from-[#6D28D9] to-[#3B82F6] shadow-[#3B82F6]/20'
                    }`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-[10px] mt-1 font-medium ${
                      isActive ? 'text-[#8B5CF6]' : 'text-muted-foreground'
                    }`}>{item.label}</span>
                  </Link>
                );
              }
              return (
                <Link key={item.href} href={item.href} className="flex flex-col items-center py-1.5 min-w-[56px]">
                  <Icon className={`w-5 h-5 transition-colors duration-200 ${
                    isActive ? 'text-[#3B82F6]' : 'text-muted-foreground'
                  }`} />
                  <span className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${
                    isActive ? 'text-[#3B82F6]' : 'text-muted-foreground'
                  }`}>{item.label}</span>
                  {isActive && (
                    <div className="w-1 h-1 rounded-full bg-[#3B82F6] mt-0.5" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
