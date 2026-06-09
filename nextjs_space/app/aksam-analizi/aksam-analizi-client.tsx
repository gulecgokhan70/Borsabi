'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Moon, Sun, RefreshCw, TrendingUp, TrendingDown, Target, Shield,
  BarChart3, Activity, Zap, Waves, AlertTriangle, Clock, ArrowRight,
  ChevronDown, ChevronUp, Star, DollarSign, ExternalLink
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/constants';

interface TradeResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  volRatio: number;
  score: number;
  signals: string[];
  rsi14: number;
  rsi5?: number;
  macd: { macd: number; signal: number; histogram: number };
  ema20?: number;
  ema50: number;
  ema200?: number;
  vwap?: number;
  last5Day: number;
  support: number;
  resistance: number;
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  tavan?: number;
  taban?: number;
  prevClose: number;
  holdingPeriod?: string;
  trendDirection?: string;
  fk?: number;
  pddd?: number;
  marketValue?: number;
  volatility?: number;
}

interface AnalysisData {
  analizZamani: string;
  tarananHisse: number;
  toplamDayTrade: number;
  toplamSwing: number;
  dayTrade: TradeResult[];
  swingTrade: TradeResult[];
}

export default function AksamAnaliziClient() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedSwing, setExpandedSwing] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Sayfa açılışında önbellekten son analizi yükle
  useEffect(() => {
    const loadCached = async () => {
      try {
        const res = await fetch('/api/aksam-analizi?cached=true');
        const json = await res.json();
        if (!json.error && json.dayTrade) {
          setData(json);
        }
      } catch (e) {
        // sessizce geç
      }
    };
    loadCached();
  }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/aksam-analizi');
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (e) {
      setError('Analiz sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#22C55E]';
    if (score >= 65) return 'text-[#3B82F6]';
    if (score >= 50) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-[#22C55E]/10 border-[#22C55E]/30';
    if (score >= 65) return 'bg-[#3B82F6]/10 border-[#3B82F6]/30';
    if (score >= 50) return 'bg-[#F59E0B]/10 border-[#F59E0B]/30';
    return 'bg-[#EF4444]/10 border-[#EF4444]/30';
  };

  const renderTradeTable = (trades: TradeResult[], type: 'day' | 'swing') => {
    const expanded = type === 'day' ? expandedDay : expandedSwing;
    const setExpanded = type === 'day' ? setExpandedDay : setExpandedSwing;

    return (
      <div className="overflow-x-auto">
        {/* Desktop Tablo */}
        <table className="w-full text-sm hidden lg:table">
          <thead>
            <tr className="border-b border-black/[0.08] dark:border-white/[0.08]">
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">#</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Hisse</th>
              <th className="text-right py-3 px-3 text-muted-foreground font-medium">Puan</th>
              <th className="text-right py-3 px-3 text-muted-foreground font-medium">Fiyat</th>
              <th className="text-right py-3 px-3 text-muted-foreground font-medium">Değişim</th>
              <th className="text-right py-3 px-3 text-[#22C55E] font-medium">Giriş</th>
              <th className="text-right py-3 px-3 text-[#EF4444] font-medium">Stop Loss</th>
              <th className="text-right py-3 px-3 text-[#3B82F6] font-medium">Hedef 1</th>
              <th className="text-right py-3 px-3 text-[#8B5CF6] font-medium">Hedef 2</th>
              <th className="text-right py-3 px-3 text-[#F59E0B] font-medium">R/G</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Sinyaller</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, idx) => (
              <tr key={t.symbol} className="border-b border-black/[0.06] dark:border-white/[0.06] hover:glass-card/50 transition-colors">
                <td className="py-3 px-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getScoreBg(t.score)}`}>
                    {idx + 1}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="font-bold text-[#3B82F6] hover:text-[#60A5FA] cursor-pointer flex items-center gap-1 transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(t.symbol + '.IS')}`)}>
                    {t.symbol}
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{t.name}</div>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className={`text-lg font-bold ${getScoreColor(t.score)}`}>{t.score}</span>
                </td>
                <td className="py-3 px-3 text-right font-medium text-foreground">{formatCurrency(t.price)}</td>
                <td className={`py-3 px-3 text-right font-medium ${t.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                </td>
                <td className="py-3 px-3 text-right font-semibold text-[#22C55E]">{formatCurrency(t.entry)}</td>
                <td className="py-3 px-3 text-right font-semibold text-[#EF4444]">{formatCurrency(t.stopLoss)}</td>
                <td className="py-3 px-3 text-right font-semibold text-[#3B82F6]">{formatCurrency(t.target1)}</td>
                <td className="py-3 px-3 text-right font-semibold text-[#8B5CF6]">{formatCurrency(t.target2)}</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-bold">
                    1:{t.riskReward}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {t.signals.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#334155] text-muted-foreground">{s}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobil Kartlar */}
        <div className="lg:hidden space-y-3">
          {trades.map((t, idx) => (
            <motion.div
              key={t.symbol}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border p-4 ${getScoreBg(t.score)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${getScoreBg(t.score)}`}>
                    <span className={`text-sm font-bold ${getScoreColor(t.score)}`}>{t.score}</span>
                  </div>
                  <div>
                    <div className="font-bold text-[#3B82F6] text-base cursor-pointer" onClick={() => router.push(`/stock/${encodeURIComponent(t.symbol + '.IS')}`)}>
                      {t.symbol} <ExternalLink className="w-3 h-3 inline opacity-50" />
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{t.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-foreground font-bold">{formatCurrency(t.price)}</div>
                  <div className={`text-xs font-medium ${t.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Trade Plan */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="glass-inner rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">GİRİŞ</div>
                  <div className="text-sm font-bold text-[#22C55E]">{formatCurrency(t.entry)}</div>
                </div>
                <div className="glass-inner rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">STOP LOSS</div>
                  <div className="text-sm font-bold text-[#EF4444]">{formatCurrency(t.stopLoss)}</div>
                </div>
                <div className="glass-inner rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">HEDEF 1</div>
                  <div className="text-sm font-bold text-[#3B82F6]">{formatCurrency(t.target1)}</div>
                </div>
                <div className="glass-inner rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">HEDEF 2</div>
                  <div className="text-sm font-bold text-[#8B5CF6]">{formatCurrency(t.target2)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {t.signals.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#334155] text-muted-foreground">{s}</span>
                  ))}
                </div>
                <span className="px-2 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-bold">
                  R/G 1:{t.riskReward}
                </span>
              </div>

              {/* Detay toggle */}
              <button
                onClick={() => setExpanded(expanded === t.symbol ? null : t.symbol)}
                className="w-full mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1 hover:text-foreground transition-colors"
              >
                {expanded === t.symbol ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded === t.symbol ? 'Gizle' : 'Detaylar'}
              </button>
              <AnimatePresence>
                {expanded === t.symbol && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center">
                        <div className="text-slate-400 dark:text-slate-500">RSI</div>
                        <div className="text-foreground font-medium">{t.rsi14}</div>
                      </div>
                      <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center">
                        <div className="text-slate-400 dark:text-slate-500">MACD</div>
                        <div className={`font-medium ${t.macd.histogram > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {t.macd.histogram > 0 ? '+' : ''}{t.macd.histogram}
                        </div>
                      </div>
                      <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center">
                        <div className="text-slate-400 dark:text-slate-500">5G Perf.</div>
                        <div className={`font-medium ${t.last5Day >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {t.last5Day >= 0 ? '+' : ''}{t.last5Day}%
                        </div>
                      </div>
                      <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center">
                        <div className="text-slate-400 dark:text-slate-500">Destek</div>
                        <div className="text-foreground font-medium">{formatCurrency(t.support)}</div>
                      </div>
                      <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center">
                        <div className="text-slate-400 dark:text-slate-500">Direnç</div>
                        <div className="text-foreground font-medium">{formatCurrency(t.resistance)}</div>
                      </div>
                      <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center">
                        <div className="text-slate-400 dark:text-slate-500">Hacim</div>
                        <div className="text-foreground font-medium">{t.volRatio}x</div>
                      </div>
                      {type === 'swing' && t.trendDirection && (
                        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded p-1.5 text-center col-span-3">
                          <div className="text-slate-400 dark:text-slate-500">Trend: <span className="text-foreground">{t.trendDirection}</span> | Süre: <span className="text-foreground">{t.holdingPeriod}</span></div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Moon className="w-7 h-7 text-[#8B5CF6]" />
            Akşam Analizi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            20 yıllık profesyonel trader bakış açısıyla kapsamlı BIST taraması
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/20"
        >
          {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sun className="w-5 h-5" />}
          {loading ? 'Analiz Ediliyor...' : 'Analizi Başlat'}
        </button>
      </div>

      {/* Disclaimer */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#F59E0B]">Önemli Uyarı</p>
            <p className="text-xs text-muted-foreground mt-1">
              Bu analiz yatırım tavsiyesi değildir. Tüm BIST hisseleri hacim, RSI, MACD, EMA20/50/200,
              son 5 günlük performans, destek/direnç ve kırılım potansiyeli kriterlerine göre analiz edilir.
              Akşam çalıştırın, sabah işlem açın. Stop loss olmadan asla işlem açmayın.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-[#EF4444] text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-10 h-10 text-[#8B5CF6] animate-spin mb-4" />
          <p className="text-muted-foreground text-sm">Tüm BIST hisseleri analiz ediliyor...</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Bu işlem 30-60 saniye sürebilir</p>
        </div>
      )}

      {/* Sonuçlar */}
      {data && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Özet kartları */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Taranan Hisse', value: data.tarananHisse, icon: BarChart3, color: '#3B82F6' },
              { label: 'Day Trade Adayı', value: data.toplamDayTrade, icon: Zap, color: '#F59E0B' },
              { label: 'Swing Adayı', value: data.toplamSwing, icon: Waves, color: '#8B5CF6' },
              { label: 'Analiz Zamanı', value: data.analizZamani?.split(' ')[1] || '-', icon: Clock, color: '#94A3B8', isText: true },
            ].map((stat: any, idx: number) => (
              <div key={idx} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className={`${stat.isText ? 'text-sm' : 'text-xl'} font-bold text-foreground`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* DAY TRADING TABLOSU */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">En İyi 5 Day Trading Hissesi</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Hacim artışı • RSI • MACD • EMA20/50 • Son 5 gün performans • Destek/Direnç
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {data.dayTrade.length > 0 ? (
                renderTradeTable(data.dayTrade, 'day')
              ) : (
                <p className="text-center text-slate-400 dark:text-slate-500 py-8">Day trading için uygun hisse bulunamadı</p>
              )}
            </div>
          </div>

          {/* SWING TRADING TABLOSU */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                  <Waves className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">En İyi 5 Swing Trading Hissesi</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Trend yönü • EMA50/200 • Hacim artışı • Kırılım potansiyeli • Risk/Getiri
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {data.swingTrade.length > 0 ? (
                renderTradeTable(data.swingTrade, 'swing')
              ) : (
                <p className="text-center text-slate-400 dark:text-slate-500 py-8">Swing trading için uygun hisse bulunamadı</p>
              )}
            </div>
          </div>

          {/* Analiz kriterleri */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-[#F59E0B]" />
              Analiz Metodolojisi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-[#F59E0B] mb-2">Day Trading Kriterleri (100P)</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><span className="text-[#3B82F6]">25P</span> Hacim artışı (ort. üstü)</li>
                  <li className="flex items-center gap-2"><span className="text-[#3B82F6]">15P</span> RSI (14 periyot)</li>
                  <li className="flex items-center gap-2"><span className="text-[#3B82F6]">15P</span> MACD sinyal çaprazlaması</li>
                  <li className="flex items-center gap-2"><span className="text-[#3B82F6]">15P</span> EMA20 ve EMA50 dizilimi</li>
                  <li className="flex items-center gap-2"><span className="text-[#3B82F6]">15P</span> Son 5 günlük performans</li>
                  <li className="flex items-center gap-2"><span className="text-[#3B82F6]">15P</span> Destek/direnç + VWAP</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#8B5CF6] mb-2">Swing Trading Kriterleri (100P)</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><span className="text-[#8B5CF6]">25P</span> Trend yönü (EMA50/200 üstü)</li>
                  <li className="flex items-center gap-2"><span className="text-[#8B5CF6]">20P</span> 50/200 günlük ort. golden cross</li>
                  <li className="flex items-center gap-2"><span className="text-[#8B5CF6]">20P</span> Hacim artışı</li>
                  <li className="flex items-center gap-2"><span className="text-[#8B5CF6]">20P</span> Kırılım potansiyeli</li>
                  <li className="flex items-center gap-2"><span className="text-[#8B5CF6]">15P</span> Risk/Getiri oranı</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Bu analiz yatırım tavsiyesi değildir. Tüm kararların sorumluluğu yatırımcıya aittir.
          </p>
        </motion.div>
      )}

      {/* Başlangıç ekranı */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center mb-6 shadow-lg shadow-[#8B5CF6]/20">
            <Moon className="w-10 h-10 text-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Akşam Analizi Hazır</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Tüm BIST hisselerini kapsamlı teknik analiz ile tarayın.
            Akşam analizi yapın, sabah en iyi fırsatlarla işleme başlayın.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
            <div className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
              <Zap className="w-5 h-5 text-[#F59E0B] mb-2" />
              <p className="text-sm font-semibold text-foreground">Day Trading</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Hacim, RSI, MACD, EMA, momentum, VWAP kriterlerine göre en iyi 5 hisse
              </p>
            </div>
            <div className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
              <Waves className="w-5 h-5 text-[#8B5CF6] mb-2" />
              <p className="text-sm font-semibold text-foreground">Swing Trading</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Trend, golden cross, kırılım, hacim, risk/getiri kriterlerine göre en iyi 5 hisse
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
