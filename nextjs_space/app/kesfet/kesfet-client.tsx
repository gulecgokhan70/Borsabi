'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Compass, TrendingUp, TrendingDown, Flame, Eye, Bitcoin, Shield, Target,
  Brain, BarChart3, Scale, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Lightbulb, Users, Activity, Newspaper, ExternalLink, Clock
} from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/constants';

const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

const TIP_ICONS: Record<string, any> = {
  shield: Shield,
  target: Target,
  trending: TrendingUp,
  brain: Brain,
  bar: BarChart3,
  scale: Scale,
};

export function KesfetClient() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tipIdx, setTipIdx] = useState(0);
  const [news, setNews] = useState<any[]>([]);
  const [newsTab, setNewsTab] = useState<'genel' | 'bist' | 'kripto' | 'kap'>('genel');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/kesfet');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Keşfet fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news?limit=30');
      const json = await res.json();
      setNews(json?.news ?? []);
    } catch (e) { console.error('News fetch error:', e); }
  }, []);

  useEffect(() => { fetchData(); fetchNews(); }, [fetchData, fetchNews]);
  useEffect(() => {
    const iv = setInterval(fetchData, 90000);
    return () => clearInterval(iv);
  }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchNews, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchNews]);

  // Rotate tips
  useEffect(() => {
    if (!data?.tips?.length) return;
    const iv = setInterval(() => setTipIdx(i => (i + 1) % data.tips.length), 8000);
    return () => clearInterval(iv);
  }, [data?.tips]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  const currentTip = data?.tips?.[tipIdx];
  const TipIcon = currentTip ? (TIP_ICONS[currentTip.icon] || Lightbulb) : Lightbulb;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Compass className="w-7 h-7 text-[#8B5CF6]" /> Keşfet
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Günün öne çıkanları ve piyasa nabzı</p>
        </div>
        <button onClick={() => { setLoading(true); fetchData(); }} className="p-2.5 rounded-lg glass-card text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Trading Tip Card */}
      {currentTip && (
        <motion.div {...fadeIn} className="glass-card rounded-2xl p-5 border-l-4 border-[#F59E0B]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center flex-shrink-0">
              <TipIcon className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wider">Günün İpucu</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{currentTip.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{currentTip.desc}</p>
            </div>
          </div>
          <div className="flex gap-1 mt-3 justify-center">
            {data.tips.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setTipIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === tipIdx ? 'bg-[#F59E0B] w-4' : 'bg-[#F59E0B]/30'}`}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Top 2 Sections: Gainers & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#22C55E]" />
            <h3 className="text-sm font-bold text-foreground">Çok Yükselenler</h3>
          </div>
          <div className="space-y-2">
            {(data?.topGainers ?? []).map((s: any, i: number) => (
              <button
                key={s.symbol}
                onClick={() => router.push(`/stock/${s.symbol}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-left"
              >
                <span className="text-lg font-bold text-[#22C55E] w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{s.shortName}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCurrency(s.price)}</p>
                  <p className="text-xs font-medium text-[#22C55E] flex items-center gap-0.5 justify-end">
                    <ArrowUpRight className="w-3 h-3" />{formatPercent(s.changePercent)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Top Losers */}
        <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-[#EF4444]" />
            <h3 className="text-sm font-bold text-foreground">Çok Düşenler</h3>
          </div>
          <div className="space-y-2">
            {(data?.topLosers ?? []).map((s: any, i: number) => (
              <button
                key={s.symbol}
                onClick={() => router.push(`/stock/${s.symbol}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-left"
              >
                <span className="text-lg font-bold text-[#EF4444] w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{s.shortName}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCurrency(s.price)}</p>
                  <p className="text-xs font-medium text-[#EF4444] flex items-center gap-0.5 justify-end">
                    <ArrowDownRight className="w-3 h-3" />{formatPercent(s.changePercent)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Volume Leaders */}
      <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[#F59E0B]" />
          <h3 className="text-sm font-bold text-foreground">Hacim Liderleri</h3>
          <span className="text-[10px] text-muted-foreground ml-1">En yüksek işlem hacmi</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(data?.volumeLeaders ?? []).map((s: any) => (
            <button
              key={s.symbol}
              onClick={() => router.push(`/stock/${s.symbol}`)}
              className="glass-inner rounded-xl p-4 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
            >
              <p className="text-sm font-bold text-foreground">{s.shortName}</p>
              <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(s.price)}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs font-medium ${s.changePercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {formatPercent(s.changePercent)}
                </span>
                <span className="text-[10px] text-muted-foreground">{(s.volume / 1e6).toFixed(1)}M</span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Crypto Movers */}
      {(data?.cryptoMovers ?? []).length > 0 && (
        <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bitcoin className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="text-sm font-bold text-foreground">Kripto Nabzı</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.cryptoMovers.map((c: any) => (
              <button
                key={c.symbol}
                onClick={() => router.push(`/stock/${c.symbol}`)}
                className="glass-inner rounded-xl p-3 text-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
              >
                <p className="text-xs font-bold text-foreground">{c.shortName}</p>
                <p className="text-sm font-bold text-foreground mt-1">${formatNumber(c.price, c.price < 1 ? 4 : 2)}</p>
                <span className={`text-xs font-medium ${c.changePercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {formatPercent(c.changePercent)}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Popular Stocks & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Popular Stocks */}
        {(data?.popularStocks ?? []).length > 0 && (
          <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-[#8B5CF6]" />
              <h3 className="text-sm font-bold text-foreground">En Çok İzlenenler</h3>
            </div>
            <div className="space-y-2">
              {data.popularStocks.map((s: any) => (
                <button
                  key={s.symbol}
                  onClick={() => router.push(`/stock/${s.symbol}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{s.shortName}</p>
                    <p className="text-xs text-muted-foreground">{s.name}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span>{s.watchCount}</span>
                  </div>
                  <span className={`text-xs font-medium ${s.changePercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {formatPercent(s.changePercent)}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Community Trades */}
        {(data?.recentTrades ?? []).length > 0 && (
          <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#3B82F6]" />
              <h3 className="text-sm font-bold text-foreground">Son İşlemler</h3>
            </div>
            <div className="space-y-2">
              {data.recentTrades.map((t: any, i: number) => {
                const isBuy = t.type === 'BUY';
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl glass-inner">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isBuy ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                      {isBuy ? <ArrowUpRight className="w-4 h-4 text-[#22C55E]" /> : <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        <span className={isBuy ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{isBuy ? 'AL' : 'SAT'}</span>
                        {' '}{t.symbol?.replace('.IS', '')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.quantity} adet • {formatCurrency(t.price)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(t.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Güncel Haberler */}
      <motion.div {...fadeIn} className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="text-sm font-bold text-foreground">Güncel Haberler</h3>
          </div>
        </div>
        <div className="flex gap-1 px-5 pb-3">
          {([['genel', 'Tümü'], ['bist', 'BIST'], ['kripto', 'Kripto'], ['kap', 'KAP']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setNewsTab(key)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                newsTab === key ? 'bg-[#8B5CF6] text-white' : 'glass-inner text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06] max-h-[420px] overflow-y-auto">
          {(newsTab === 'genel' ? news : news.filter(n => n.category === newsTab)).length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">Haber yükleniyor...</div>
          ) : (
            (newsTab === 'genel' ? news : news.filter(n => n.category === newsTab)).slice(0, 15).map((n: any, i: number) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 px-5 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  n.sentiment === 'positive' ? 'bg-[#22C55E]/10' : n.sentiment === 'negative' ? 'bg-[#EF4444]/10' : n.category === 'kap' ? 'bg-[#F59E0B]/10' : 'bg-[#8B5CF6]/10'
                }`}>
                  {n.sentiment === 'positive' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> :
                   n.sentiment === 'negative' ? <TrendingDown className="w-4 h-4 text-[#EF4444]" /> :
                   n.category === 'kap' ? <Shield className="w-4 h-4 text-[#F59E0B]" /> :
                   <Newspaper className="w-4 h-4 text-[#8B5CF6]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{n.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{n.source}</span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{n.date ? new Date(n.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
              </a>
            ))
          )}
        </div>
      </motion.div>

      {/* Quick Navigation */}
      <motion.div {...fadeIn} className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#3B82F6]" />
          <h3 className="text-sm font-bold text-foreground">Hızlı Erişim</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/day-trading', label: 'Day Trading', icon: '⚡', color: 'text-[#F59E0B]' },
            { href: '/swing-trading', label: 'Swing Trading', icon: '🌊', color: 'text-[#3B82F6]' },
            { href: '/screening', label: 'Tarama', icon: '🔍', color: 'text-[#8B5CF6]' },
            { href: '/algo-scan', label: 'Algo Tarama', icon: '🤖', color: 'text-[#22C55E]' },
          ].map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="glass-inner rounded-xl p-4 text-center hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-2xl">{item.icon}</span>
              <p className={`text-xs font-semibold mt-2 ${item.color}`}>{item.label}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-muted-foreground pt-2">
        ⚠️ Bu veriler bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
