'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  FlaskConical, Play, TrendingUp, TrendingDown, Target,
  BarChart3, Clock, Shield, AlertTriangle, Activity
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, BIST_STOCKS, BIST_FUNDS, CRYPTO_ASSETS } from '@/lib/constants';
import { SymbolSearch } from '@/components/symbol-search';

const EquityChart = dynamic(() => import('./equity-chart'), { ssr: false });

const STRATEGIES = [
  { id: 'ema-crossover', name: 'EMA Kesişim', desc: 'EMA20 EMA50\'yi yukarı kestiğinde al, aşağı kestiğinde sat' },
  { id: 'rsi-reversal', name: 'RSI Dönüş', desc: 'RSI 30 altından yukarı çıkınca al, 70 üzerinde sat' },
  { id: 'macd-crossover', name: 'MACD Kesişim', desc: 'MACD sinyal çizgisini yukarı kestiğinde al, aşağı kestiğinde sat' },
  { id: 'trend-following', name: 'Trend Takip', desc: 'Güçlü yükseliş trendinde EMA dizilimi uygunsa al' },
  { id: 'breakout', name: 'Kırılım', desc: '20 günlük zirveyi geçince al, EMA20 altına düşünce sat' },
];

const PERIODS = [
  { id: '1m', name: '1 Ay' },
  { id: '3m', name: '3 Ay' },
  { id: '6m', name: '6 Ay' },
  { id: '1y', name: '1 Yıl' },
  { id: '2y', name: '2 Yıl' },
  { id: '3y', name: '3 Yıl' },
];

interface BacktestResult {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    totalReturn: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    avgHoldingDays: number;
    finalCapital: number;
  };
  trades: Array<{
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    holdingDays: number;
    exitReason: string;
  }>;
  equity: number[];
}

export function BacktestClient() {
  const symbolGroups = [
    { label: 'BIST Hisseleri', items: BIST_STOCKS },
    { label: 'Borsa Yatırım Fonları', items: BIST_FUNDS },
    { label: 'Kripto', items: CRYPTO_ASSETS.slice(0, 5) },
  ];
  const allSymbols = symbolGroups.flatMap(g => g.items);
  const [symbol, setSymbol] = useState(BIST_STOCKS[0].symbol);
  const [strategy, setStrategy] = useState('ema-crossover');
  const [period, setPeriod] = useState('1y');
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(6);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState('');

  const runBacktest = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy, period, stopLoss, takeProfit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Backtest hatası');
      setResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedStrategy = STRATEGIES.find(s => s.id === strategy);
  const selectedSymbol = allSymbols.find(s => s.symbol === symbol);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          Backtest Motoru
        </h1>
        <p className="text-[#94A3B8] text-sm mt-1">Stratejilerinizi geçmiş verilerle test edin</p>
      </div>

      {/* Config */}
      <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Backtest Ayarları</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Symbol */}
          <div>
            <label className="text-xs text-[#64748B] mb-1.5 block">Sembol</label>
            <SymbolSearch
              value={symbol}
              onChange={setSymbol}
              groups={symbolGroups}
              placeholder="Hisse veya fon ara..."
            />
          </div>

          {/* Strategy */}
          <div>
            <label className="text-xs text-[#64748B] mb-1.5 block">Strateji</label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              className="w-full bg-[#0F172A] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none"
            >
              {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="text-xs text-[#64748B] mb-1.5 block">Test Periyodu</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full bg-[#0F172A] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none"
            >
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="text-xs text-[#64748B] mb-1.5 block">Stop Loss (%)</label>
            <input
              type="number"
              value={stopLoss}
              onChange={e => setStopLoss(Number(e.target.value))}
              min={1} max={20} step={0.5}
              className="w-full bg-[#0F172A] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          {/* Take Profit */}
          <div>
            <label className="text-xs text-[#64748B] mb-1.5 block">Take Profit (%)</label>
            <input
              type="number"
              value={takeProfit}
              onChange={e => setTakeProfit(Number(e.target.value))}
              min={1} max={50} step={0.5}
              className="w-full bg-[#0F172A] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          {/* Run */}
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? 'Test Ediliyor...' : 'Backtest Başlat'}
            </button>
          </div>
        </div>

        {selectedStrategy && (
          <div className="mt-3 p-3 bg-[#0F172A]/50 rounded-lg">
            <p className="text-xs text-[#94A3B8]">
              <strong className="text-white">{selectedStrategy.name}:</strong> {selectedStrategy.desc}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Toplam Getiri', value: formatPercent(result.summary.totalReturn), color: result.summary.totalReturn >= 0 ? '#22C55E' : '#EF4444', icon: TrendingUp },
              { label: 'Toplam K/Z', value: formatCurrency(result.summary.totalPnL), color: result.summary.totalPnL >= 0 ? '#22C55E' : '#EF4444', icon: Activity },
              { label: 'İşlem Sayısı', value: result.summary.totalTrades.toString(), color: '#3B82F6', icon: BarChart3 },
              { label: 'Kazanç Oranı', value: `%${formatNumber(result.summary.winRate, 1)}`, color: result.summary.winRate >= 50 ? '#22C55E' : '#EF4444', icon: Target },
              { label: 'Kâr Faktörü', value: formatNumber(result.summary.profitFactor, 2), color: result.summary.profitFactor >= 1.5 ? '#22C55E' : '#F59E0B', icon: Shield },
              { label: 'Max Düşüş', value: `%${formatNumber(result.summary.maxDrawdown, 1)}`, color: '#EF4444', icon: TrendingDown },
            ].map((stat, idx) => (
              <div key={idx} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
                <div className="flex items-center gap-1.5 mb-2">
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  <span className="text-[10px] text-[#64748B] uppercase">{stat.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Equity Curve */}
          {result.equity.length > 0 && (
            <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Sermaye Eğrisi</h3>
              <div className="h-[250px]">
                <EquityChart equity={result.equity} positive={result.summary.totalReturn >= 0} />
              </div>
            </div>
          )}

          {/* Detail Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">İşlem İstatistikleri</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Kazanan İşlem', value: result.summary.winningTrades, color: '#22C55E' },
                  { label: 'Kaybeden İşlem', value: result.summary.losingTrades, color: '#EF4444' },
                  { label: 'Ort. Kazanç', value: formatCurrency(result.summary.avgWin), color: '#22C55E' },
                  { label: 'Ort. Kayıp', value: formatCurrency(result.summary.avgLoss), color: '#EF4444' },
                  { label: 'Ort. Tutma Süresi', value: `${result.summary.avgHoldingDays} gün`, color: '#94A3B8' },
                  { label: 'Son Sermaye', value: formatCurrency(result.summary.finalCapital), color: '#3B82F6' },
                ].map((row, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-xs text-[#64748B]">{row.label}</span>
                    <span className="text-sm font-medium" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Strateji Değerlendirmesi</h3>
              <div className="space-y-3">
                {[
                  { label: 'Kârlılık', score: result.summary.totalReturn > 10 ? 'Mükemmel' : result.summary.totalReturn > 0 ? 'İyi' : 'Zayıf', ok: result.summary.totalReturn > 0 },
                  { label: 'Kazanç Oranı', score: result.summary.winRate > 55 ? 'Yüksek' : result.summary.winRate > 40 ? 'Kabul Edilebilir' : 'Düşük', ok: result.summary.winRate > 40 },
                  { label: 'Risk Yönetimi', score: result.summary.maxDrawdown < 10 ? 'Güçlü' : result.summary.maxDrawdown < 20 ? 'Orta' : 'Zayıf', ok: result.summary.maxDrawdown < 20 },
                  { label: 'Kâr Faktörü', score: result.summary.profitFactor > 1.5 ? 'Güçlü' : result.summary.profitFactor > 1 ? 'Kabul Edilebilir' : 'Zayıf', ok: result.summary.profitFactor > 1 },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#0F172A]/50 rounded-lg px-3 py-2.5">
                    <span className="text-xs text-[#94A3B8]">{item.label}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.ok ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                      {item.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trade Table */}
          {result.trades.length > 0 && (
            <div className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
              <div className="p-5 border-b border-[#334155]">
                <h3 className="text-sm font-semibold text-white">Son İşlemler (Son 20)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      {['Giriş', 'Çıkış', 'Giriş Fiyat', 'Çıkış Fiyat', 'K/Z', 'K/Z %', 'Süre', 'Neden'].map(h => (
                        <th key={h} className="text-left text-[10px] uppercase text-[#64748B] px-3 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade, idx) => (
                      <tr key={idx} className="border-b border-[#334155]/50 hover:bg-[#0F172A]/30">
                        <td className="px-3 py-2.5 text-xs text-[#94A3B8]">{trade.entryDate}</td>
                        <td className="px-3 py-2.5 text-xs text-[#94A3B8]">{trade.exitDate}</td>
                        <td className="px-3 py-2.5 text-xs text-white font-medium">{formatNumber(trade.entryPrice)}</td>
                        <td className="px-3 py-2.5 text-xs text-white font-medium">{formatNumber(trade.exitPrice)}</td>
                        <td className={`px-3 py-2.5 text-xs font-medium ${trade.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {formatCurrency(trade.pnl)}
                        </td>
                        <td className={`px-3 py-2.5 text-xs font-medium ${trade.pnlPercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {formatPercent(trade.pnlPercent)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#94A3B8]">{trade.holdingDays}g</td>
                        <td className="px-3 py-2.5 text-xs text-[#94A3B8]">{trade.exitReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="text-center py-4">
        <p className="text-xs text-[#64748B]">
          ⚠️ Geçmiş performans gelecek sonuçları garanti etmez. Eğitim ve simülasyon amaçlıdır.
        </p>
      </div>
    </div>
  );
}
