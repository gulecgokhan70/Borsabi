'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Play, Filter, TrendingUp, TrendingDown, BarChart3, Activity, RefreshCw, ChevronDown } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/constants';
import { useRouter } from 'next/navigation';

const DEFAULT_FILTERS = {
  market: 'BIST',
  rsiMin: 0,
  rsiMax: 100,
  macdSignal: 'all',
  emaFilter: 'all',
  emaPeriod: 20,
  volumeMin: 0,
  priceMin: 0,
  priceMax: 999999,
  changeMin: -100,
  changeMax: 100,
  sortBy: 'score',
  bollingerPos: 'all',
  stochSignal: 'all',
  adxMin: 0,
};

export default function AlgoScanClient() {
  const router = useRouter();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [scanned, setScanned] = useState(false);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/algo-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      const data = await res.json();
      setResults(data.results || []);
      setScanned(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateFilter = (key: string, value: any) => setFilters(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center">
          <Search className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Algoritmik Tarama</h1>
          <p className="text-xs text-muted-foreground">Özel filtrelerle piyasa tarayın</p>
        </div>
      </motion.div>

      {/* Filters Panel */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl overflow-hidden">
        <button onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-[#8B5CF6]" /> Filtreler</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="px-5 pb-5 space-y-4">
            {/* Market & Sort */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Piyasa</label>
                <select value={filters.market} onChange={e => updateFilter('market', e.target.value)}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value="BIST">BIST</option>
                  <option value="CRYPTO">Kripto</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sıralama</label>
                <select value={filters.sortBy} onChange={e => updateFilter('sortBy', e.target.value)}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value="score">Puana Göre</option>
                  <option value="rsi">RSI (Düşük Önce)</option>
                  <option value="change">Değişim (Yüksek Önce)</option>
                  <option value="volume">Hacim (Yüksek Önce)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMA Periyodu</label>
                <select value={filters.emaPeriod} onChange={e => updateFilter('emaPeriod', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value={10}>EMA 10</option>
                  <option value={20}>EMA 20</option>
                  <option value={50}>EMA 50</option>
                </select>
              </div>
            </div>

            {/* RSI Range */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">RSI Min</label>
                <input type="number" value={filters.rsiMin} onChange={e => updateFilter('rsiMin', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" min={0} max={100} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">RSI Max</label>
                <input type="number" value={filters.rsiMax} onChange={e => updateFilter('rsiMax', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" min={0} max={100} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">MACD Sinyal</label>
                <select value={filters.macdSignal} onChange={e => updateFilter('macdSignal', e.target.value)}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value="all">Tümü</option>
                  <option value="bullish">Yükseliş (Bullish)</option>
                  <option value="bearish">Düşüş (Bearish)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMA Filtre</label>
                <select value={filters.emaFilter} onChange={e => updateFilter('emaFilter', e.target.value)}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value="all">Tümü</option>
                  <option value="above">EMA Üstünde</option>
                  <option value="below">EMA Altında</option>
                </select>
              </div>
            </div>

            {/* Bollinger, Stochastic, ADX */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bollinger Pozisyon</label>
                <select value={filters.bollingerPos} onChange={e => updateFilter('bollingerPos', e.target.value)}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value="all">Tümü</option>
                  <option value="upper">Üst Bant Yakını</option>
                  <option value="lower">Alt Bant Yakını</option>
                  <option value="squeeze">Sıkışma (Squeeze)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Stochastic Sinyal</label>
                <select value={filters.stochSignal} onChange={e => updateFilter('stochSignal', e.target.value)}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]">
                  <option value="all">Tümü</option>
                  <option value="oversold">Aşırı Satım (K&lt;20)</option>
                  <option value="overbought">Aşırı Alım (K&gt;80)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min ADX</label>
                <input type="number" value={filters.adxMin} onChange={e => updateFilter('adxMin', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" min={0} max={100} />
              </div>
            </div>

            {/* Volume & Price */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min Hacim Çarpanı</label>
                <input type="number" value={filters.volumeMin} onChange={e => updateFilter('volumeMin', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" min={0} step={0.1} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Değişim Min %</label>
                <input type="number" value={filters.changeMin} onChange={e => updateFilter('changeMin', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Değişim Max %</label>
                <input type="number" value={filters.changeMax} onChange={e => updateFilter('changeMax', Number(e.target.value))}
                  className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" />
              </div>
              <div className="flex items-end">
                <button onClick={runScan} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Taranıyor...' : 'Tara'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Results */}
      {scanned && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Sonuçlar ({results.length})</span>
          </div>

          {results.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Filtrelere uygun sonuç bulunamadı. Filtreleri gevşetin.</div>
          ) : (
            <div className="divide-y divide-black/[0.08] dark:divide-white/[0.08]">
              {results.map((r: any, idx: number) => (
                <motion.div key={r.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                  className="px-5 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-8 h-8 rounded-lg glass-inner flex items-center justify-center">
                        <span className="text-xs font-bold" style={{ color: r.score >= 80 ? '#22C55E' : r.score >= 60 ? '#3B82F6' : '#F59E0B' }}>{r.score}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(r.symbol)}`)}>{r.shortName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{r.name}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="text-foreground font-medium">{formatCurrency(r.price)}</span>
                      <span className={r.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{formatPercent(r.change)}</span>
                      <span className="text-muted-foreground">RSI: <span className={r.rsi < 30 ? 'text-[#22C55E]' : r.rsi > 70 ? 'text-[#EF4444]' : 'text-foreground'}>{r.rsi.toFixed(1)}</span></span>
                      <span className="text-muted-foreground">MACD: <span className={r.macd.histogram > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{r.macd.histogram > 0 ? '+' : ''}{r.macd.histogram.toFixed(3)}</span></span>
                      <span className="text-muted-foreground">EMA{filters.emaPeriod}: <span className="text-foreground">{formatNumber(r.ema)}</span></span>
                      <span className="text-muted-foreground">Hacim: <span className={r.volRatio > 1.5 ? 'text-[#F59E0B]' : 'text-foreground'}>{r.volRatio}x</span></span>
                      {r.stochastic && <span className="text-muted-foreground">Stoch: <span className={r.stochastic.k < 20 ? 'text-[#22C55E]' : r.stochastic.k > 80 ? 'text-[#EF4444]' : 'text-foreground'}>{r.stochastic.k.toFixed(1)}</span></span>}
                      {r.adx && <span className="text-muted-foreground">ADX: <span className={r.adx.adx > 25 ? 'text-[#F59E0B]' : 'text-foreground'}>{r.adx.adx.toFixed(1)}</span></span>}
                      {r.bollinger && <span className="text-muted-foreground">BB: <span className="text-foreground">{r.bollinger.bandwidth.toFixed(1)}%</span></span>}
                      {(r as any)?.candlePatterns?.map((cp: any, cpIdx: number) => (
                        <span key={cpIdx} className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                          cp.type === 'bullish' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
                          : cp.type === 'bearish' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                          : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
                        }`}>🕯️ {cp.name}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
