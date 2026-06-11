'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, Globe, DollarSign, Gem, Bitcoin,
  BarChart3, ArrowUpRight, ArrowDownRight, Flame, Search, X, Clock, ArrowUp, ArrowDown,
  ChevronUp, ChevronDown, Filter
} from 'lucide-react';
import { formatNumber, formatPercent, formatCurrency } from '@/lib/constants';

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'Az önce';
  if (diff < 60) return `${diff} sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  return `${Math.floor(diff / 3600)} sa önce`;
}

const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

function MiniSparkSvg({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 32;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={positive ? '#22C55E' : '#EF4444'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* Range bar for high/low */
function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low || 1;
  const pos = Math.min(100, Math.max(0, ((current - low) / range) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.06] relative mt-1.5">
      <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#EF4444] via-[#F59E0B] to-[#22C55E]" style={{ width: '100%', opacity: 0.3 }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-foreground border-2 border-background shadow-sm" style={{ left: `calc(${pos}% - 5px)` }} />
    </div>
  );
}

type Tab = 'doviz' | 'kripto' | 'emtia' | 'endeks' | 'bist';
type SortKey = 'name' | 'price' | 'change';

export function PiyasalarClient() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('doviz');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/piyasalar');
      const json = await res.json();
      setData(json);
      setLastUpdate(Date.now());
    } catch (e) {
      console.error('Piyasalar fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, [fetchData]);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  /* Market summary stats */
  const stats = useMemo(() => {
    if (!data) return null;
    const all = [...(data.currencies ?? []), ...(data.crypto ?? []), ...(data.commodities ?? []), ...(data.bistStocks ?? [])];
    const gainers = all.filter((x: any) => (x.changePercent ?? 0) > 0).length;
    const losers = all.filter((x: any) => (x.changePercent ?? 0) < 0).length;
    const bestPerformer = all.reduce((best: any, cur: any) => (!best || (cur.changePercent ?? 0) > (best.changePercent ?? 0)) ? cur : best, null);
    const worstPerformer = all.reduce((worst: any, cur: any) => (!worst || (cur.changePercent ?? 0) < (worst.changePercent ?? 0)) ? cur : worst, null);
    return { gainers, losers, total: all.length, bestPerformer, worstPerformer };
  }, [data]);

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'doviz', label: 'Döviz', icon: DollarSign, count: data?.currencies?.length },
    { key: 'kripto', label: 'Kripto', icon: Bitcoin, count: data?.crypto?.length },
    { key: 'emtia', label: 'Emtia', icon: Gem, count: data?.commodities?.length },
    { key: 'endeks', label: 'Endeksler', icon: BarChart3, count: data?.indices?.length },
    { key: 'bist', label: 'BIST', icon: TrendingUp, count: data?.bistStocks?.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Globe className="w-7 h-7 text-[#3B82F6]" /> Piyasalar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Döviz, kripto, emtia ve borsa verileri</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${lastUpdate && (Date.now() - lastUpdate) > 120000 ? 'bg-[#F59E0B]' : 'bg-[#22C55E] animate-pulse'}`} />
            <span className="hidden sm:inline">{lastUpdate ? `${formatTimeAgo(lastUpdate)} güncellendi` : 'Yükleniyor...'}</span>
          </div>
          <button onClick={() => { setLoading(true); fetchData(); }} className="p-2.5 rounded-lg glass-card text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Market Summary Strip */}
      {stats && (
        <motion.div {...fadeIn} className="glass-card rounded-2xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Yükselenler</p>
              <p className="text-xl font-bold text-[#22C55E] mt-1">▲ {stats.gainers}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Düşenler</p>
              <p className="text-xl font-bold text-[#EF4444] mt-1">▼ {stats.losers}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">En İyi</p>
              <p className="text-sm font-bold text-[#22C55E] mt-1">{stats.bestPerformer?.shortName}</p>
              <p className="text-xs text-[#22C55E]">{formatPercent(stats.bestPerformer?.changePercent)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">En Kötü</p>
              <p className="text-sm font-bold text-[#EF4444] mt-1">{stats.worstPerformer?.shortName}</p>
              <p className="text-xs text-[#EF4444]">{formatPercent(stats.worstPerformer?.changePercent)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Index Summary Cards */}
      {data?.indices && (
        <motion.div {...fadeIn} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.indices.map((idx: any) => (
            <div key={idx.symbol} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{idx.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${idx.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  {formatPercent(idx.changePercent)}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xl font-bold text-foreground">{formatNumber(idx.price, 0)}</p>
                  <p className={`text-xs ${idx.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {idx.change >= 0 ? '+' : ''}{formatNumber(idx.change, 0)}
                  </p>
                </div>
                <MiniSparkSvg data={idx.sparkline} positive={idx.changePercent >= 0} />
              </div>
              {idx.high > 0 && idx.low > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>{formatNumber(idx.low, 0)}</span>
                    <span>{formatNumber(idx.high, 0)}</span>
                  </div>
                  <RangeBar low={idx.low} high={idx.high} current={idx.price} />
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Tab Navigation + Search */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-[#3B82F6]/10 text-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.1)]'
                    : 'glass-inner text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.count != null && <span className="text-[10px] opacity-60">({t.count})</span>}
              </button>
            );
          })}
        </div>

        {/* Search + Sort Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara... (ör: USD, Bitcoin, Altın)"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl glass-inner text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/30"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {([['name', 'A-Z'], ['price', '₺'], ['change', '%']] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 ${
                  sortKey === key ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'glass-inner text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {sortKey === key && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
          {tab === 'doviz' && <CurrencySection data={data?.currencies ?? []} search={search} sortKey={sortKey} sortAsc={sortAsc} />}
          {tab === 'kripto' && <CryptoSection data={data?.crypto ?? []} search={search} sortKey={sortKey} sortAsc={sortAsc} />}
          {tab === 'emtia' && <CommoditySection data={data?.commodities ?? []} search={search} sortKey={sortKey} sortAsc={sortAsc} />}
          {tab === 'endeks' && <IndexSection data={data?.indices ?? []} search={search} sortKey={sortKey} sortAsc={sortAsc} />}
          {tab === 'bist' && <BistSection data={data?.bistStocks ?? []} search={search} sortKey={sortKey} sortAsc={sortAsc} />}
        </motion.div>
      </AnimatePresence>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-muted-foreground pt-4">
        ⚠️ Bu veriler bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

/* ── Sort + Filter Helper ── */
function useFilteredSorted(data: any[], search: string, sortKey: SortKey, sortAsc: boolean) {
  return useMemo(() => {
    let filtered = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = data.filter((x: any) =>
        (x.shortName ?? '').toLowerCase().includes(q) ||
        (x.name ?? '').toLowerCase().includes(q) ||
        (x.symbol ?? '').toLowerCase().includes(q)
      );
    }
    const sorted = [...filtered].sort((a: any, b: any) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = (a.shortName ?? '').localeCompare(b.shortName ?? '', 'tr');
      else if (sortKey === 'price') cmp = (a.price ?? 0) - (b.price ?? 0);
      else cmp = (a.changePercent ?? 0) - (b.changePercent ?? 0);
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [data, search, sortKey, sortAsc]);
}

interface SectionProps { data: any[]; search: string; sortKey: SortKey; sortAsc: boolean; }

/* ── Döviz Section ── */
function CurrencySection({ data, search, sortKey, sortAsc }: SectionProps) {
  const router = useRouter();
  const items = useFilteredSorted(data, search, sortKey, sortAsc);
  if (items.length === 0) return <EmptySearch />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c: any) => (
        <motion.div
          key={c.symbol}
          whileHover={{ scale: 1.01 }}
          className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push(`/stock/${c.symbol}`)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.flag}</span>
              <div>
                <p className="text-sm font-bold text-foreground">{c.shortName}</p>
                <p className="text-xs text-muted-foreground">{c.name}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${c.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
              {c.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatPercent(c.changePercent)}
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(c.price, 4)}</p>
            </div>
            <MiniSparkSvg data={c.sparkline} positive={c.changePercent >= 0} />
          </div>
          {c.high > 0 && c.low > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>Düşük: {formatNumber(c.low, 4)}</span>
                <span>Yüksek: {formatNumber(c.high, 4)}</span>
              </div>
              <RangeBar low={c.low} high={c.high} current={c.price} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── Kripto Section ── */
function CryptoSection({ data, search, sortKey, sortAsc }: SectionProps) {
  const router = useRouter();
  const items = useFilteredSorted(data, search, sortKey, sortAsc);
  if (items.length === 0) return <EmptySearch />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c: any) => (
        <motion.div
          key={c.symbol}
          whileHover={{ scale: 1.01 }}
          className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push(`/stock/${c.symbol}`)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <Bitcoin className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{c.shortName}</p>
                <p className="text-[11px] text-muted-foreground">{c.name}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${c.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
              {c.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatPercent(c.changePercent)}
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">${formatNumber(c.price, c.price < 1 ? 4 : 2)}</p>
          <div className="flex items-center justify-between mt-2">
            <MiniSparkSvg data={c.sparkline} positive={c.changePercent >= 0} />
          </div>
          {c.marketCap > 0 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-[10px] text-muted-foreground">Piyasa Değeri</span>
              <span className="text-[11px] font-semibold text-foreground">${(c.marketCap / 1e9).toFixed(1)}B</span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── Emtia Section ── */
function CommoditySection({ data, search, sortKey, sortAsc }: SectionProps) {
  const items = useFilteredSorted(data, search, sortKey, sortAsc);
  if (items.length === 0) return <EmptySearch />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c: any) => (
        <motion.div
          key={c.symbol}
          whileHover={{ scale: 1.01 }}
          className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{c.icon}</span>
            <div>
              <p className="text-sm font-bold text-foreground">{c.shortName}</p>
              <p className="text-xs text-muted-foreground">{c.name}</p>
            </div>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-xl font-bold text-foreground">{c.currency === 'TRY' ? `₺${formatNumber(c.price, 2)}` : `$${formatNumber(c.price, 2)}`}</p>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${c.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
              {c.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatPercent(c.changePercent)}
            </div>
          </div>
          <div className="mt-3">
            <MiniSparkSvg data={c.sparkline} positive={c.changePercent >= 0} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Endeks Section ── */
function IndexSection({ data, search, sortKey, sortAsc }: SectionProps) {
  const items = useFilteredSorted(data, search, sortKey, sortAsc);
  if (items.length === 0) return <EmptySearch />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((idx: any) => (
        <motion.div key={idx.symbol} whileHover={{ scale: 1.01 }} className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#3B82F6]" />
              <span className="text-sm font-bold text-foreground">{idx.name}</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${idx.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
              {formatPercent(idx.changePercent)}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatNumber(idx.price, 0)}</p>
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Y: {formatNumber(idx.high, 0)}</span>
              <span>D: {formatNumber(idx.low, 0)}</span>
            </div>
            <MiniSparkSvg data={idx.sparkline} positive={idx.changePercent >= 0} />
          </div>
          {idx.high > 0 && idx.low > 0 && (
            <RangeBar low={idx.low} high={idx.high} current={idx.price} />
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── BIST Section ── */
function BistSection({ data, search, sortKey, sortAsc }: SectionProps) {
  const router = useRouter();
  const items = useFilteredSorted(data, search, sortKey, sortAsc);
  if (items.length === 0) return <EmptySearch />;
  return (
    <div className="space-y-3">
      {/* BIST Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">{items.length} hisse gösteriliyor</p>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {items.map((s: any) => (
            <button
              key={s.symbol}
              onClick={() => router.push(`/stock/${s.symbol}`)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                (s.changePercent ?? 0) >= 0 ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'
              }`}>
                <span className={`text-xs font-bold ${(s.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {s.shortName?.slice(0, 4)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{s.shortName}</p>
                <p className="text-xs text-muted-foreground truncate">{s.name}</p>
              </div>
              <div className="hidden sm:block flex-shrink-0">
                <MiniSparkSvg data={s.sparkline} positive={(s.changePercent ?? 0) >= 0} />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{formatCurrency(s.price)}</p>
                <p className={`text-xs font-medium ${(s.changePercent ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {(s.changePercent ?? 0) >= 0 ? '▲' : '▼'} {formatPercent(s.changePercent)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Empty Search ── */
function EmptySearch() {
  return (
    <div className="text-center py-12">
      <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Arama terimini değiştirmeyi deneyin</p>
    </div>
  );
}
