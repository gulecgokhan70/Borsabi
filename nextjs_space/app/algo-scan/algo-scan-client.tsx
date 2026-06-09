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
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Algoritmik Tarama</h1>
          <p className="text-xs text-[#94A3B8]">Özel filtrelerle piyasa tarayın</p>
        </div>
      </motion.div>

      {/* Filters Panel */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
        <button onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-white">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-[#8B5CF6]" /> Filtreler</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="px-5 pb-5 space-y-4">
            {/* Market & Sort */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">Piyasa</label>
                <select value={filters.market} onChange={e => updateFilter('market', e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                  <option value="BIST">BIST</option>
                  <option value="CRYPTO">Kripto</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">Sıralama</label>
                <select value={filters.sortBy} onChange={e => updateFilter('sortBy', e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                  <option value="score">Puana Göre</option>
                  <option value="rsi">RSI (Düşük Önce)</option>
                  <option value="change">Değişim (Yüksek Önce)</option>
                  <option value="volume">Hacim (Yüksek Önce)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">EMA Periyodu</label>
                <select value={filters.emaPeriod} onChange={e => updateFilter('emaPeriod', Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                  <option value={10}>EMA 10</option>
                  <option value={20}>EMA 20</option>
                  <option value={50}>EMA 50</option>
                </select>
              </div>
            </div>

            {/* RSI Range */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">RSI Min</label>
                <input type="number" value={filters.rsiMin} onChange={e => updateFilter('rsiMin', Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" min={0} max={100} />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">RSI Max</label>
                <input type="number" value={filters.rsiMax} onChange={e => updateFilter('rsiMax', Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" min={0} max={100} />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">MACD Sinyal</label>
                <select value={filters.macdSignal} onChange={e => updateFilter('macdSignal', e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                  <option value="all">Tümü</option>
                  <option value="bullish">Yükseliş (Bullish)</option>
                  <option value="bearish">Düşüş (Bearish)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">EMA Filtre</label>
                <select value={filters.emaFilter} onChange={e => updateFilter('emaFilter', e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                  <option value="all">Tümü</option>
                  <option value="above">EMA Üstünde</option>
                  <option value="below">EMA Altında</option>
                </select>
              </div>
            </div>

            {/* Volume & Price */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">Min Hacim Çarpanı</label>
                <input type="number" value={filters.volumeMin} onChange={e => updateFilter('volumeMin', Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" min={0} step={0.1} />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">Değişim Min %</label>
                <input type="number" value={filters.changeMin} onChange={e => updateFilter('changeMin', Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">Değişim Max %</label>
                <input type="number" value={filters.changeMax} onChange={e => updateFilter('changeMax', Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" />
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
          className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#334155] flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Sonuçlar ({results.length})</span>
          </div>

          {results.length === 0 ? (
            <div className="p-10 text-center text-[#94A3B8] text-sm">Filtrelere uygun sonuç bulunamadı. Filtreleri gevşetin.</div>
          ) : (
            <div className="divide-y divide-[#334155]">
              {results.map((r: any, idx: number) => (
                <motion.div key={r.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                  className="px-5 py-3 hover:bg-[#0F172A]/30 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center">
                        <span className="text-xs font-bold" style={{ color: r.score >= 80 ? '#22C55E' : r.score >= 60 ? '#3B82F6' : '#F59E0B' }}>{r.score}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(r.symbol)}`)}>{r.shortName}</p>
                        <p className="text-xs text-[#64748B]">{r.name}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="text-white font-medium">{formatCurrency(r.price)}</span>
                      <span className={r.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{formatPercent(r.change)}</span>
                      <span className="text-[#94A3B8]">RSI: <span className={r.rsi < 30 ? 'text-[#22C55E]' : r.rsi > 70 ? 'text-[#EF4444]' : 'text-white'}>{r.rsi.toFixed(1)}</span></span>
                      <span className="text-[#94A3B8]">MACD: <span className={r.macd.histogram > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{r.macd.histogram > 0 ? '+' : ''}{r.macd.histogram.toFixed(3)}</span></span>
                      <span className="text-[#94A3B8]">EMA{filters.emaPeriod}: <span className="text-white">{formatNumber(r.ema)}</span></span>
                      <span className="text-[#94A3B8]">Hacim: <span className={r.volRatio > 1.5 ? 'text-[#F59E0B]' : 'text-white'}>{r.volRatio}x</span></span>
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
