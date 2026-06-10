'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, RefreshCw, TrendingUp, TrendingDown, Target, Shield,
  AlertTriangle, Clock, BarChart3, Activity, CheckCircle2
} from 'lucide-react';
import { formatNumber, formatPercent, formatCurrency, getScoreCategory, SCORE_LABELS } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';
import { useRouter } from 'next/navigation';

interface DayTradeResult {
  symbol: string;
  yahooSymbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  avgVolume: number;
  open: number;
  high: number;
  low: number;
  score: number;
  quality: string;
  signals: string[];
  passesFilter: boolean;
  hacimPuan: number;
  trendPuan: number;
  momentumPuan: number;
  formasyonPuan: number;
  riskOdulPuan: number;
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  riskReward: number;
  prevClose?: number;
  tavan?: number;
  taban?: number;
  rsi: number;
  rsi14: number;
  vwap: number;
  macd: { macd: number; signal: number; histogram: number };
}

function formatTimeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  return `${Math.floor(diff / 3600)} sa önce`;
}

export function DayTradingClient() {
  const router = useRouter();
  const [data, setData] = useState<DayTradeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<{ open: boolean; symbol: string; name: string; price: number; marketType: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'elite' | 'strong' | 'watch'>('all');
  const [marketOpen, setMarketOpen] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isFresh, setIsFresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/day-trading');
      const json = await res.json();
      setData(json?.data ?? []);
      if (json?.marketOpen !== undefined) setMarketOpen(json.marketOpen);
      if (json?.cachedAt) setCachedAt(json.cachedAt);
      if (json?.fresh !== undefined) setIsFresh(json.fresh);
    } catch (e) {
      console.error('Day trading fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { fetchData(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredData = data.filter((item: DayTradeResult) => {
    if (filter === 'all') return true;
    const cat = getScoreCategory(item.score);
    if (filter === 'elite') return cat === 'elite';
    if (filter === 'strong') return cat === 'elite' || cat === 'strong';
    if (filter === 'watch') return cat !== 'weak';
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-[#22C55E]';
    if (score >= 80) return 'text-[#3B82F6]';
    if (score >= 70) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-[#22C55E]/10 border-[#22C55E]/30';
    if (score >= 80) return 'bg-[#3B82F6]/10 border-[#3B82F6]/30';
    if (score >= 70) return 'bg-[#F59E0B]/10 border-[#F59E0B]/30';
    return 'bg-[#EF4444]/10 border-[#EF4444]/30';
  };

  const PuanBar = ({ label, puan, max }: { label: string; puan: number; max: number }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-20 text-right">{label}</span>
      <div className="flex-1 h-2 glass-inner rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(puan / max) * 100}%`,
            backgroundColor: puan >= max * 0.8 ? '#22C55E' : puan >= max * 0.5 ? '#3B82F6' : '#F59E0B',
          }}
        />
      </div>
      <span className="text-foreground font-mono w-10 text-right">{puan}/{max}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#F59E0B]" />
            </div>
            Day Trading Motoru
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">5 Kategori Puanlama Sistemi ile Gün İçi Fırsat Analizi</p>
            {cachedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full glass-inner text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${isFresh ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`} />
                {formatTimeAgo(cachedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex glass-card rounded-lg p-1 gap-1">
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'elite', label: 'Elite' },
              { key: 'strong', label: 'Güçlü+' },
              { key: 'watch', label: 'İzleme+' },
            ].map((f: any) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === f.key
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Tara
          </button>
        </div>
      </div>

      {!marketOpen && !loading && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
          <span className="text-[#F59E0B] text-lg">🔔</span>
          <p className="text-[#F59E0B] text-sm font-medium">Borsa şu an kapalı — son kapanış verileri üzerinden tarama yapılmıştır. Yarın açılışta güncel verilerle tekrar tarayın.</p>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#F59E0B]">Day Trading Uyarısı</p>
            <p className="text-xs text-muted-foreground mt-1">
              Filtre: Hacim {'>'} 20 günlük ort. | VWAP üstü | EMA9 {'>'} EMA21 | RSI(5) {'>'} 55 | MACD pozitif | Değişim {'>'} %1. 
              Minimum R:R 1:1.2. Hedef fiyatlar tavan/taban limitlerine göre sınırlandırılmıştır. Stop loss olmadan işlem açmayın.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Hisse', value: data.length, icon: BarChart3, color: '#3B82F6' },
          { label: 'Filtre Geçen', value: data.filter((d: DayTradeResult) => d.passesFilter).length, icon: CheckCircle2, color: '#22C55E' },
          { label: 'Elite Fırsat', value: data.filter((d: DayTradeResult) => d.score >= 90).length, icon: Target, color: '#22C55E' },
          { label: 'Güçlü Fırsat', value: data.filter((d: DayTradeResult) => d.score >= 80 && d.score < 90).length, icon: TrendingUp, color: '#3B82F6' },
        ].map((stat: any, idx: number) => (
          <div key={idx} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-[#3B82F6] animate-spin mb-4" />
          <p className="text-muted-foreground">BIST hisseleri taranıyor...</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hacim, VWAP, EMA, RSI(5), MACD analiz ediliyor</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
          <p className="text-muted-foreground">Bu filtrede day trade fırsatı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((item: DayTradeResult, idx: number) => (
            <motion.div
              key={item.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`glass-card rounded-xl border overflow-hidden ${getScoreBg(item.score)}`}
            >
              <div className="p-5">
                {/* Top row */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${getScoreBg(item.score)}`}>
                      <span className={`text-lg font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
                      <span className="text-[8px] text-muted-foreground uppercase">Puan</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={(e) => { e.stopPropagation(); router.push(`/stock/${encodeURIComponent(item.yahooSymbol || (item.symbol + '.IS'))}`); }}>{item.symbol}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreBg(item.score)} ${getScoreColor(item.score)}`}>
                          {item.quality}
                        </span>
                        {item.passesFilter && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 font-medium">
                            ✓ Filtre Geçti
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{formatCurrency(item.price)}</p>
                      <p className={`text-sm font-medium ${item.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {formatPercent(item.change)}
                      </p>
                    </div>
                    <button
                      onClick={() => setTradeModal({ open: true, symbol: item.symbol, name: item.name, price: item.price, marketType: 'BIST' })}
                      className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      İşlem Aç
                    </button>
                  </div>
                </div>

                {/* Mum Formasyonları */}
                {(item as any)?.candlePatterns?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {((item as any).candlePatterns ?? []).map((cp: any, cpIdx: number) => (
                      <span key={cpIdx} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        cp.type === 'bullish' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
                        : cp.type === 'bearish' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                        : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
                      }`}>
                        🕯️ {cp.name}
                      </span>
                    ))}
                  </div>
                )}
                {/* Signals */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(item.signals ?? []).filter((s: string) => !s.startsWith('🕯')).map((signal: string, sIdx: number) => (
                    <span key={sIdx} className="text-xs px-2.5 py-1 rounded-full glass-inner text-muted-foreground">
                      {signal}
                    </span>
                  ))}
                </div>

                {/* Puan Breakdown */}
                <div className="glass-inner rounded-lg p-3 mb-4">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-2 font-semibold">Puan Dağılımı</p>
                  <div className="space-y-1.5">
                    <PuanBar label="Hacim" puan={item.hacimPuan ?? 0} max={20} />
                    <PuanBar label="Trend" puan={item.trendPuan ?? 0} max={20} />
                    <PuanBar label="Momentum" puan={item.momentumPuan ?? 0} max={20} />
                    <PuanBar label="Formasyon" puan={item.formasyonPuan ?? 0} max={20} />
                    <PuanBar label="Risk/Ödül" puan={item.riskOdulPuan ?? 0} max={20} />
                  </div>
                </div>

                {/* Trade plan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: 'Giriş', value: formatCurrency(item.entry), icon: TrendingUp, color: '#3B82F6' },
                    { label: 'Stop', value: formatCurrency(item.stop), icon: Shield, color: '#EF4444' },
                    { label: 'Hedef 1', value: formatCurrency(item.target1), icon: Target, color: '#22C55E' },
                    { label: 'Hedef 2', value: formatCurrency(item.target2), icon: Target, color: '#22C55E' },
                    { label: 'R/G', value: `1:${item.riskReward}`, icon: Activity, color: '#F59E0B' },
                    { label: 'Tavan', value: item.tavan ? formatCurrency(item.tavan) : '-', icon: TrendingUp, color: '#F97316' },
                    { label: 'Taban', value: item.taban ? formatCurrency(item.taban) : '-', icon: TrendingDown, color: '#EF4444' },
                  ].map((field: any, fIdx: number) => (
                    <div key={fIdx} className="glass-inner rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <field.icon className="w-3 h-3" style={{ color: field.color }} />
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">{field.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{field.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ⚠️ Bu analiz yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır.
        </p>
      </div>

      {/* Trade Modal */}
      {tradeModal?.open && (
        <TradeModal
          isOpen={tradeModal.open}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal.symbol}
          name={tradeModal.name}
          price={tradeModal.price}
          marketType={tradeModal.marketType}
          onSuccess={() => { setTradeModal(null); }}
        />
      )}
    </div>
  );
}
