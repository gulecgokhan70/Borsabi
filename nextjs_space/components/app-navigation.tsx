'use client';
import Link from 'next/link';
import { Home, Globe, Briefcase, GraduationCap, Bot, Search, ScrollText, Eye, Bell, Compass, FlaskConical, ScanSearch, Wrench, Shield, Zap, Waves, Moon, Users, Trophy, Award, Building2, User } from 'lucide-react';

const PRIMARY = [
  { href: '/dashboard', label: 'Ana Sayfa', icon: Home, related: [] },
  { href: '/piyasalar', label: 'Piyasalar', icon: Globe, related: [] },
  { href: '/portfolio', label: 'Portföy', icon: Briefcase, related: ['/watchlist', '/trade-log', '/alerts'] },
  { href: '/academy', label: 'Öğren', icon: GraduationCap, related: ['/kesfet'] },
  { href: '/ai-assistant', label: 'AI Asistan', icon: Bot, related: [] },
];
const GROUPS = [
  { title: 'Portföy araçları', items: [
    { href: '/watchlist', label: 'İzleme Listesi', icon: Eye },
    { href: '/trade-log', label: 'İşlem Günlüğü', icon: ScrollText },
    { href: '/alerts', label: 'Alarmlar ve Radar', icon: Bell },
  ] },
  { title: 'Öğren ve keşfet', items: [{ href: '/kesfet', label: 'Keşfet', icon: Compass }] },
  { title: 'Gelişmiş', items: [
    { href: '/backtest', label: 'Backtest', icon: FlaskConical },
    { href: '/screening', label: 'Tarama', icon: Search },
    { href: '/algo-scan', label: 'Algo Tarama', icon: ScanSearch },
    { href: '/strategy-builder', label: 'Strateji Oluşturucu', icon: Wrench },
    { href: '/risk-center', label: 'Risk Merkezi', icon: Shield },
    { href: '/day-trading', label: 'Günlük İşlem Araçları', icon: Zap },
    { href: '/swing-trading', label: 'Swing İşlem Araçları', icon: Waves },
    { href: '/aksam-analizi', label: 'Akşam Analizi', icon: Moon },
  ] },
  { title: 'Diğer', items: [
    { href: '/social', label: 'Sosyal', icon: Users },
    { href: '/leaderboard', label: 'Sıralama', icon: Trophy },
    { href: '/achievements', label: 'Rozetler', icon: Award },
    { href: '/brokers', label: 'Aracı Kurumlar', icon: Building2 },
  ] },
];
const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');
const linkClass = (active: boolean) => `flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${active ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`;
export function SidebarNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return <nav aria-label="Uygulama menüsü" className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-none">
    {PRIMARY.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={matches(pathname, href) ? 'page' : undefined} className={linkClass(matches(pathname, href))} onClick={onNavigate}><Icon className="w-[18px] h-[18px] shrink-0" />{label}</Link>)}
    <div className="pt-3 mt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
      {GROUPS.map(group => <details key={`${group.title}:${pathname}`} open={group.items.some(item => matches(pathname, item.href))} className="mb-1">
        <summary className="min-h-[44px] px-3 py-3 text-xs font-semibold text-muted-foreground cursor-pointer">{group.title}</summary>
        {group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={matches(pathname, href) ? 'page' : undefined} className={linkClass(matches(pathname, href))} onClick={onNavigate}><Icon className="w-[18px] h-[18px] shrink-0" />{label}</Link>)}
      </details>)}
    </div>
    <Link href="/profile" aria-current={matches(pathname, '/profile') ? 'page' : undefined} className={linkClass(matches(pathname, '/profile'))} onClick={onNavigate}><User className="w-[18px] h-[18px] shrink-0" />Profil</Link>
  </nav>;
}
export function MobileNavigation({ pathname }: { pathname: string }) {
  // The stock detail already has its own fixed buy/sell bar.
  if (pathname.startsWith('/stock/')) return null;
  return <nav aria-label="Ana gezinme" className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
    <div className="glass-nav border-t border-black/[0.06] dark:border-white/[0.06] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 gap-1">{PRIMARY.map(({ href, label, icon: Icon, related }) => {
        const active = [href, ...related].some(path => matches(pathname, path));
        return <Link key={href} href={href} aria-current={active ? pathname === href ? 'page' : 'location' : undefined} className={`flex min-w-0 min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium ${active ? 'text-[#3B82F6] bg-[#3B82F6]/10' : 'text-muted-foreground'}`}><Icon className="w-5 h-5 shrink-0" /><span className="whitespace-nowrap">{label}</span></Link>;
      })}</div>
    </div>
  </nav>;
}
