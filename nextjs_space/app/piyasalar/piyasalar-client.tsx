'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, Globe, DollarSign, Gem, Bitcoin,
  BarChart3, ArrowUpRight, ArrowDownRight, Flame
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
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#22C55E' : '#EF4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Tab = 'doviz' | 'kripto' | 'emtia' | 'endeks' | 'bist';

export function PiyasalarClient() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('doviz');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [, setTick] = useState(0);

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

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'doviz', label: 'Döviz', icon: DollarSign },
    { key: 'kripto', label: 'Kripto', icon: Bitcoin },
    { key: 'emtia', label: 'Emtia', icon: Gem },
    { key: 'endeks', label: 'Endeksler', icon: BarChart3 },
    { key: 'bist', label: 'BIST', icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span>Canlı{lastUpdate ? ` • ${formatTimeAgo(lastUpdate)}` : ''}</span>
          </div>
          <button onClick={() => { setLoading(true); fetchData(); }} className="p-2.5 rounded-lg glass-card text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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
            </div>
          ))}
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
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
            </button>
          );
        })}
      </div>

      {/* Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === 'doviz' && <CurrencySection data={data?.currencies ?? []} />}
        {tab === 'kripto' && <CryptoSection data={data?.crypto ?? []} />}
        {tab === 'emtia' && <CommoditySection data={data?.commodities ?? []} />}
        {tab === 'endeks' && <IndexSection data={data?.indices ?? []} />}
        {tab === 'bist' && <BistSection data={data?.bistStocks ?? []} />}
      </motion.div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-muted-foreground pt-4">
        ⚠️ Bu veriler bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

/* ── Döviz Section ── */
function CurrencySection({ data }: { data: any[] }) {
  const router = useRouter();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((c: any) => (
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
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span>Yüksek: {formatNumber(c.high, 4)}</span>
                <span>Düşük: {formatNumber(c.low, 4)}</span>
              </div>
            </div>
            <MiniSparkSvg data={c.sparkline} positive={c.changePercent >= 0} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Kripto Section ── */
function CryptoSection({ data }: { data: any[] }) {
  const router = useRouter();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {data.map((c: any) => (
        <motion.div
          key={c.symbol}
          whileHover={{ scale: 1.01 }}
          className="glass-card rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push(`/stock/${c.symbol}`)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                <Bitcoin className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{c.shortName}</p>
                <p className="text-[11px] text-muted-foreground">{c.name}</p>
              </div>
            </div>
          </div>
          <p className="text-lg font-bold text-foreground">${formatNumber(c.price, c.price < 1 ? 4 : 2)}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${c.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
              {formatPercent(c.changePercent)}
            </span>
            <MiniSparkSvg data={c.sparkline} positive={c.changePercent >= 0} />
          </div>
          {c.marketCap > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Piyasa Değeri: ${(c.marketCap / 1e9).toFixed(1)}B
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── Emtia Section ── */
function CommoditySection({ data }: { data: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {data.map((c: any) => (
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
          <p className="text-xl font-bold text-foreground">${formatNumber(c.price, 2)}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${c.changePercent >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
              {formatPercent(c.changePercent)}
            </span>
            <MiniSparkSvg data={c.sparkline} positive={c.changePercent >= 0} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Endeks Section ── */
function IndexSection({ data }: { data: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {data.map((idx: any) => (
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
              <span>Yüksek: {formatNumber(idx.high, 0)}</span>
              <span>Düşük: {formatNumber(idx.low, 0)}</span>
            </div>
            <MiniSparkSvg data={idx.sparkline} positive={idx.changePercent >= 0} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── BIST Section ── */
function BistSection({ data }: { data: any[] }) {
  const router = useRouter();
  const sorted = [...data].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
        {sorted.map((s: any) => (
          <button
            key={s.symbol}
            onClick={() => router.push(`/stock/${s.symbol}`)}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#3B82F6]">{s.shortName?.slice(0, 4)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{s.shortName}</p>
              <p className="text-xs text-muted-foreground truncate">{s.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{formatCurrency(s.price)}</p>
              <p className={`text-xs font-medium ${s.changePercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {formatPercent(s.changePercent)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
