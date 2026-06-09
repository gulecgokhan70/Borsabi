'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Wrench, Plus, Trash2, Play, TrendingUp, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatPercent, BIST_STOCKS, BIST_FUNDS, CRYPTO_ASSETS } from '@/lib/constants';
import { SymbolSearch } from '@/components/symbol-search';

const EquityChart = dynamic(() => import('../backtest/equity-chart'), { ssr: false });

const INDICATORS = [
  { id: 'price', name: 'Fiyat' },
  { id: 'ema10', name: 'EMA 10' },
  { id: 'ema20', name: 'EMA 20' },
  { id: 'ema50', name: 'EMA 50' },
  { id: 'rsi', name: 'RSI (14)' },
  { id: 'volume', name: 'Hacim' },
  { id: 'avgVolume', name: 'Ort. Hacim' },
];

const OPERATORS = [
  { id: 'gt', name: 'Büyük (>)' },
  { id: 'lt', name: 'Küçük (<)' },
  { id: 'cross_above', name: 'Yukarı Kesişim' },
  { id: 'cross_below', name: 'Aşağı Kesişim' },
];

interface Rule {
  id: number;
  direction: string;
  indicator: string;
  operator: string;
  compareWith: string;
  compareIndicator: string;
  value: number;
}

export default function StrategyBuilderClient() {
  const [name, setName] = useState('Benim Stratejim');
  const [symbol, setSymbol] = useState('THYAO.IS');
  const [period, setPeriod] = useState('1y');
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [rules, setRules] = useState<Rule[]>([
    { id: 1, direction: 'buy', indicator: 'ema10', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
    { id: 2, direction: 'sell', indicator: 'ema10', operator: 'cross_below', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [nextId, setNextId] = useState(3);

  const addRule = () => {
    setRules(r => [...r, { id: nextId, direction: 'buy', indicator: 'rsi', operator: 'lt', compareWith: 'value', compareIndicator: 'ema20', value: 30 }]);
    setNextId(n => n + 1);
  };

  const removeRule = (id: number) => setRules(r => r.filter(x => x.id !== id));

  const updateRule = (id: number, field: string, value: any) => {
    setRules(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const runBacktest = async () => {
    if (rules.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/strategy-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, symbol, period, initialCapital: 100000, stopLoss, takeProfit, rules }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); }
      else setResult(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const symbolGroups = [
    { label: 'BIST Hisseleri', items: BIST_STOCKS },
    { label: 'Fonlar', items: BIST_FUNDS },
    { label: 'Kripto', items: CRYPTO_ASSETS },
  ];
  const allSymbols = symbolGroups.flatMap(g => g.items);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Strateji Oluşturucu</h1>
          <p className="text-xs text-[#94A3B8]">Kendi stratejinizi oluşturun ve backtest edin</p>
        </div>
      </motion.div>

      {/* Config */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Temel Ayarlar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-[#94A3B8] mb-1 block">Strateji Adı</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="text-xs text-[#94A3B8] mb-1 block">Sembol</label>
            <SymbolSearch value={symbol} onChange={setSymbol} groups={symbolGroups} placeholder="Sembol ara..." />
          </div>
          <div>
            <label className="text-xs text-[#94A3B8] mb-1 block">Dönem</label>
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
              <option value="6m">6 Ay</option>
              <option value="1y">1 Yıl</option>
              <option value="2y">2 Yıl</option>
              <option value="3y">3 Yıl</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#94A3B8] mb-1 block">Stop Loss %</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))}
              className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" min={1} max={50} />
          </div>
          <div>
            <label className="text-xs text-[#94A3B8] mb-1 block">Take Profit %</label>
            <input type="number" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))}
              className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" min={1} max={100} />
          </div>
          <div className="flex items-end">
            <button onClick={runBacktest} disabled={loading || rules.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#F59E0B] to-[#EF4444] text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
              <Play className="w-4 h-4" /> {loading ? 'Test Ediliyor...' : 'Backtest'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Rules */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Kurallar ({rules.length})</h3>
          <button onClick={addRule} className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#60A5FA] transition">
            <Plus className="w-3.5 h-3.5" /> Kural Ekle
          </button>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-2 bg-[#0F172A]/50 rounded-lg p-3">
              <select value={rule.direction} onChange={e => updateRule(rule.id, 'direction', e.target.value)}
                className="bg-[#0F172A] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                <option value="buy">🟢 AL</option>
                <option value="sell">🔴 SAT</option>
              </select>
              <select value={rule.indicator} onChange={e => updateRule(rule.id, 'indicator', e.target.value)}
                className="bg-[#0F172A] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                {INDICATORS.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
              </select>
              <select value={rule.operator} onChange={e => updateRule(rule.id, 'operator', e.target.value)}
                className="bg-[#0F172A] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                {OPERATORS.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
              <select value={rule.compareWith} onChange={e => updateRule(rule.id, 'compareWith', e.target.value)}
                className="bg-[#0F172A] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                <option value="indicator">Gösterge</option>
                <option value="value">Değer</option>
              </select>
              {rule.compareWith === 'indicator' ? (
                <select value={rule.compareIndicator} onChange={e => updateRule(rule.id, 'compareIndicator', e.target.value)}
                  className="bg-[#0F172A] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  {INDICATORS.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
                </select>
              ) : (
                <input type="number" value={rule.value} onChange={e => updateRule(rule.id, 'value', Number(e.target.value))}
                  className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
              )}
              <button onClick={() => removeRule(rule.id)} className="ml-auto p-1.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {rules.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-4">Henüz kural eklenmedi. “Kural Ekle” butonuna tıklayın.</p>}
        </div>
      </motion.div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-4">
          {/* Summary */}
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">“{result.name}” Sonuçları</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Toplam Getiri', value: formatPercent(result.summary.totalReturn), color: result.summary.totalReturn >= 0 ? '#22C55E' : '#EF4444' },
                { label: 'Son Sermaye', value: formatCurrency(result.summary.finalCapital), color: '#3B82F6' },
                { label: 'Toplam İşlem', value: result.summary.totalTrades.toString(), color: '#8B5CF6' },
                { label: 'Kazanç Oranı', value: `%${result.summary.winRate}`, color: '#F59E0B' },
                { label: 'Ort. Kazanç', value: formatPercent(result.summary.avgWin), color: '#22C55E' },
                { label: 'Ort. Kayıp', value: formatPercent(result.summary.avgLoss), color: '#EF4444' },
                { label: 'Max Drawdown', value: `%${result.summary.maxDrawdown}`, color: '#EF4444' },
                { label: 'Başlangıç', value: formatCurrency(result.summary.initialCapital), color: '#94A3B8' },
              ].map((s, i) => (
                <div key={i} className="bg-[#0F172A]/50 rounded-lg p-3">
                  <p className="text-xs text-[#94A3B8] mb-1">{s.label}</p>
                  <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Equity Chart */}
          {result.equity?.length > 0 && (
            <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Sermaye Eğrisi</h3>
              <div className="h-[250px]">
                <EquityChart equity={result.equity} positive={result.summary.totalReturn >= 0} />
              </div>
            </div>
          )}

          {/* Trades */}
          {result.trades?.length > 0 && (
            <div className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#334155]">
                <h3 className="text-sm font-semibold text-white">İşlem Geçmişi ({result.trades.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-[#94A3B8] border-b border-[#334155]">
                    <th className="px-4 py-2 text-left">Tarih</th>
                    <th className="px-4 py-2 text-right">Giriş</th>
                    <th className="px-4 py-2 text-right">Çıkış</th>
                    <th className="px-4 py-2 text-right">K/Z</th>
                    <th className="px-4 py-2 text-left">Sebep</th>
                  </tr></thead>
                  <tbody>
                    {result.trades.map((t: any, i: number) => (
                      <tr key={i} className="border-b border-[#334155]/50 hover:bg-[#0F172A]/30">
                        <td className="px-4 py-2 text-[#94A3B8]">{t.date}</td>
                        <td className="px-4 py-2 text-right text-white">{formatCurrency(t.entry)}</td>
                        <td className="px-4 py-2 text-right text-white">{formatCurrency(t.exit)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${t.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {formatPercent(t.pnlPercent)}
                        </td>
                        <td className="px-4 py-2 text-[#94A3B8]">{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}
