'use client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Wrench, Plus, Trash2, Play, TrendingUp, TrendingDown, BarChart3, AlertTriangle,
  Copy, RotateCcw, Lightbulb, ChevronDown, ChevronUp, Target, Shield, Zap,
  Activity, Clock, Percent, Award
} from 'lucide-react';
import { formatCurrency, formatPercent, BIST_STOCKS, BIST_FUNDS, CRYPTO_ASSETS } from '@/lib/constants';
import { SymbolSearch } from '@/components/symbol-search';

const EquityChart = dynamic(() => import('../backtest/equity-chart'), { ssr: false });

const INDICATORS = [
  { id: 'price', name: 'Fiyat', group: 'Fiyat' },
  { id: 'ema10', name: 'EMA 10', group: 'Ortalama' },
  { id: 'ema20', name: 'EMA 20', group: 'Ortalama' },
  { id: 'ema50', name: 'EMA 50', group: 'Ortalama' },
  { id: 'ema200', name: 'EMA 200', group: 'Ortalama' },
  { id: 'rsi', name: 'RSI (14)', group: 'Osilatör' },
  { id: 'macd', name: 'MACD', group: 'Osilatör' },
  { id: 'macdSignal', name: 'MACD Sinyal', group: 'Osilatör' },
  { id: 'stochK', name: 'Stochastic %K', group: 'Osilatör' },
  { id: 'stochD', name: 'Stochastic %D', group: 'Osilatör' },
  { id: 'adx', name: 'ADX', group: 'Trend' },
  { id: 'bollingerUpper', name: 'Bollinger Üst', group: 'Bant' },
  { id: 'bollingerMiddle', name: 'Bollinger Orta', group: 'Bant' },
  { id: 'bollingerLower', name: 'Bollinger Alt', group: 'Bant' },
  { id: 'atr', name: 'ATR (14)', group: 'Volatilite' },
  { id: 'volume', name: 'Hacim', group: 'Hacim' },
  { id: 'avgVolume', name: 'Ort. Hacim', group: 'Hacim' },
];

const OPERATORS = [
  { id: 'gt', name: 'Büyük (>)', symbol: '>' },
  { id: 'lt', name: 'Küçük (<)', symbol: '<' },
  { id: 'cross_above', name: 'Yukarı Kesişim', symbol: '↑✕' },
  { id: 'cross_below', name: 'Aşağı Kesişim', symbol: '↓✕' },
];

const PERIODS = [
  { id: '1d', name: 'Günlük', icon: '⚡' },
  { id: '1w', name: 'Haftalık', icon: '📅' },
  { id: '15d', name: '15 Gün', icon: '📆' },
  { id: '1m', name: '1 Ay', icon: '🗓️' },
  { id: '3m', name: '3 Ay', icon: '📊' },
  { id: '6m', name: '6 Ay', icon: '📈' },
  { id: '1y', name: '1 Yıl', icon: '🎯' },
  { id: '2y', name: '2 Yıl', icon: '🏆' },
  { id: '3y', name: '3 Yıl', icon: '💎' },
];

const TEMPLATES = [
  {
    id: 'golden-cross',
    name: 'Altın Kesişim',
    desc: 'EMA10, EMA20 üstüne geçince al — altına düşünce sat',
    icon: '🌟',
    rules: [
      { id: 1, direction: 'buy', indicator: 'ema10', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
      { id: 2, direction: 'sell', indicator: 'ema10', operator: 'cross_below', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
    ],
    stopLoss: 5, takeProfit: 10,
  },
  {
    id: 'rsi-reversal',
    name: 'RSI Dönüş',
    desc: 'RSI 30 altına düşünce al, 70 üstüne çıkınca sat',
    icon: '🔄',
    rules: [
      { id: 1, direction: 'buy', indicator: 'rsi', operator: 'lt', compareWith: 'value', compareIndicator: 'ema20', value: 30 },
      { id: 2, direction: 'sell', indicator: 'rsi', operator: 'gt', compareWith: 'value', compareIndicator: 'ema20', value: 70 },
    ],
    stopLoss: 7, takeProfit: 15,
  },
  {
    id: 'trend-follow',
    name: 'Trend Takip',
    desc: 'Fiyat EMA50 üstüne geçince al, altına düşünce sat',
    icon: '📈',
    rules: [
      { id: 1, direction: 'buy', indicator: 'price', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'ema50', value: 0 },
      { id: 2, direction: 'sell', indicator: 'price', operator: 'cross_below', compareWith: 'indicator', compareIndicator: 'ema50', value: 0 },
    ],
    stopLoss: 8, takeProfit: 20,
  },
  {
    id: 'volume-breakout',
    name: 'Hacim Kırılım',
    desc: 'Hacim ortalamanın üstünde + EMA10 > EMA20 ise al',
    icon: '💥',
    rules: [
      { id: 1, direction: 'buy', indicator: 'volume', operator: 'gt', compareWith: 'indicator', compareIndicator: 'avgVolume', value: 0 },
      { id: 2, direction: 'buy', indicator: 'ema10', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
      { id: 3, direction: 'sell', indicator: 'ema10', operator: 'cross_below', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
    ],
    stopLoss: 5, takeProfit: 12,
  },
  {
    id: 'scalp',
    name: 'Scalping',
    desc: 'Kısa vadeli — RSI < 40 + EMA10 > EMA20, hızlı kâr al',
    icon: '⚡',
    rules: [
      { id: 1, direction: 'buy', indicator: 'rsi', operator: 'lt', compareWith: 'value', compareIndicator: 'ema20', value: 40 },
      { id: 2, direction: 'buy', indicator: 'ema10', operator: 'gt', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
      { id: 3, direction: 'sell', indicator: 'rsi', operator: 'gt', compareWith: 'value', compareIndicator: 'ema20', value: 65 },
    ],
    stopLoss: 3, takeProfit: 5,
  },
  {
    id: 'bollinger-bounce',
    name: 'Bollinger Sıçraması',
    desc: 'Fiyat Bollinger alt bandına dokunursa al, üst bantta sat',
    icon: '📉',
    rules: [
      { id: 1, direction: 'buy', indicator: 'price', operator: 'lt', compareWith: 'indicator', compareIndicator: 'bollingerLower', value: 0 },
      { id: 2, direction: 'sell', indicator: 'price', operator: 'gt', compareWith: 'indicator', compareIndicator: 'bollingerUpper', value: 0 },
    ],
    stopLoss: 4, takeProfit: 8,
  },
  {
    id: 'macd-momentum',
    name: 'MACD Momentum',
    desc: 'MACD sinyal çizgisini yukarı keserse al, aşağı keserse sat',
    icon: '📊',
    rules: [
      { id: 1, direction: 'buy', indicator: 'macd', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'macdSignal', value: 0 },
      { id: 2, direction: 'sell', indicator: 'macd', operator: 'cross_below', compareWith: 'indicator', compareIndicator: 'macdSignal', value: 0 },
    ],
    stopLoss: 5, takeProfit: 10,
  },
  {
    id: 'stochastic-reversal',
    name: 'Stochastic Dönüş',
    desc: 'Stochastic %K aşırı satımda yukarı keserse al, aşırı alımda sat',
    icon: '🔄',
    rules: [
      { id: 1, direction: 'buy', indicator: 'stochK', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'stochD', value: 0 },
      { id: 2, direction: 'buy', indicator: 'stochK', operator: 'lt', compareWith: 'value', compareIndicator: 'stochD', value: 25 },
      { id: 3, direction: 'sell', indicator: 'stochK', operator: 'gt', compareWith: 'value', compareIndicator: 'stochD', value: 80 },
    ],
    stopLoss: 5, takeProfit: 12,
  },
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
  const [period, setPeriod] = useState('6m');
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [rules, setRules] = useState<Rule[]>([
    { id: 1, direction: 'buy', indicator: 'ema10', operator: 'cross_above', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
    { id: 2, direction: 'sell', indicator: 'ema10', operator: 'cross_below', compareWith: 'indicator', compareIndicator: 'ema20', value: 0 },
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [nextId, setNextId] = useState(3);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRules, setShowRules] = useState(true);

  const addRule = () => {
    setRules(r => [...r, { id: nextId, direction: 'buy', indicator: 'rsi', operator: 'lt', compareWith: 'value', compareIndicator: 'ema20', value: 30 }]);
    setNextId(n => n + 1);
  };

  const removeRule = (id: number) => setRules(r => r.filter(x => x.id !== id));

  const updateRule = (id: number, field: string, value: any) => {
    setRules(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setRules(tpl.rules.map((r, i) => ({ ...r, id: i + 1 })));
    setNextId(tpl.rules.length + 1);
    setStopLoss(tpl.stopLoss);
    setTakeProfit(tpl.takeProfit);
    setName(tpl.name);
    setShowTemplates(false);
  };

  const resetAll = () => {
    setRules([]);
    setResult(null);
    setName('Benim Stratejim');
    setStopLoss(5);
    setTakeProfit(10);
    setNextId(1);
  };

  const runBacktest = async () => {
    if (rules.length === 0) return;
    setLoading(true);
    setResult(null);
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

  const buyRules = rules.filter(r => r.direction === 'buy');
  const sellRules = rules.filter(r => r.direction === 'sell');

  const getGrade = (ret: number) => {
    if (ret >= 50) return { label: 'A+', color: '#22C55E', bg: 'bg-[#22C55E]/20' };
    if (ret >= 20) return { label: 'A', color: '#22C55E', bg: 'bg-[#22C55E]/10' };
    if (ret >= 10) return { label: 'B', color: '#3B82F6', bg: 'bg-[#3B82F6]/10' };
    if (ret >= 0) return { label: 'C', color: '#F59E0B', bg: 'bg-[#F59E0B]/10' };
    if (ret >= -10) return { label: 'D', color: '#EF4444', bg: 'bg-[#EF4444]/10' };
    return { label: 'F', color: '#EF4444', bg: 'bg-[#EF4444]/20' };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
            <Wrench className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Strateji Oluşturucu</h1>
            <p className="text-xs text-muted-foreground">Kendi stratejinizi oluşturun ve backtest edin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-[#3B82F6]/50 transition-all">
            <Lightbulb className="w-3.5 h-3.5 text-[#F59E0B]" /> Şablonlar
          </button>
          <button onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-lg text-xs text-slate-400 dark:text-slate-500 hover:text-[#F87171] hover:border-[#EF4444]/30 transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Sıfırla
          </button>
        </div>
      </motion.div>

      {/* Templates Panel */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card rounded-xl border border-[#F59E0B]/20 p-4">
              <h3 className="text-sm font-semibold text-[#F59E0B] mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Hazır Strateji Şablonları
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {TEMPLATES.map(tpl => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                    className="text-left glass-inner rounded-lg p-3 border border-black/[0.08] dark:border-white/[0.08] hover:border-[#F59E0B]/40 transition-all group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{tpl.icon}</span>
                      <span className="text-sm font-semibold text-foreground group-hover:text-[#F59E0B] transition-colors">{tpl.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">{tpl.desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EF4444]/10 text-[#F87171]">SL: %{tpl.stopLoss}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E]">TP: %{tpl.takeProfit}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6]">{tpl.rules.length} kural</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#3B82F6]" /> Temel Ayarlar
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Strateji Adı</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sembol</label>
            <SymbolSearch value={symbol} onChange={setSymbol} groups={symbolGroups} placeholder="Sembol ara..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Stop Loss %</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))}
              className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" min={1} max={50} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Take Profit %</label>
            <input type="number" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))}
              className="w-full glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#3B82F6]" min={1} max={100} />
          </div>
        </div>

        {/* Period Selector */}
        <div className="mt-4">
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <Clock className="w-3 h-3" /> Test Dönemi
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.id
                    ? 'bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20'
                    : 'glass-inner text-muted-foreground hover:text-foreground hover:border-[#3B82F6]/30'
                }`}>
                <span className="mr-1">{p.icon}</span> {p.name}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Rules */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-xl p-5">
        <button onClick={() => setShowRules(!showRules)} className="w-full flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-[#F59E0B]" /> Kurallar ({rules.length})
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); addRule(); }} className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#60A5FA] transition">
              <Plus className="w-3.5 h-3.5" /> Kural Ekle
            </button>
            {showRules ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          </div>
        </button>

        <AnimatePresence>
          {showRules && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {/* Buy Rules */}
              {buyRules.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#22C55E] font-semibold mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Alış Kuralları
                  </p>
                  <div className="space-y-2">
                    {buyRules.map(rule => renderRule(rule, updateRule, removeRule))}
                  </div>
                </div>
              )}
              {/* Sell Rules */}
              {sellRules.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#F87171] font-semibold mb-2 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Satış Kuralları
                  </p>
                  <div className="space-y-2">
                    {sellRules.map(rule => renderRule(rule, updateRule, removeRule))}
                  </div>
                </div>
              )}
              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Henüz kural eklenmedi. &quot;Kural Ekle&quot; veya bir şablon seçin.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Run Button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <button onClick={runBacktest} disabled={loading || rules.length === 0}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#F59E0B] to-[#EF4444] text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 shadow-lg shadow-[#F59E0B]/10">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Test Ediliyor...</>
          ) : (
            <><Play className="w-5 h-5" /> Stratejiyi Test Et ({PERIODS.find(p => p.id === period)?.name})</>
          )}
        </button>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Score Card */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#F59E0B]" /> &quot;{result.name}&quot; Sonuçları
                </h3>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${getGrade(result.summary.totalReturn).bg}`}
                  style={{ color: getGrade(result.summary.totalReturn).color }}>
                  {getGrade(result.summary.totalReturn).label}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="glass-inner rounded-lg p-3 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Percent className="w-3 h-3 text-[#3B82F6]" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Toplam Getiri</p>
                  </div>
                  <p className={`text-lg font-bold font-mono ${result.summary.totalReturn >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                    {result.summary.totalReturn >= 0 ? '+' : ''}{result.summary.totalReturn.toFixed(2)}%
                  </p>
                </div>
                <div className="glass-inner rounded-lg p-3 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3 h-3 text-[#8B5CF6]" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Kazanç Oranı</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-foreground">%{result.summary.winRate}</p>
                </div>
                <div className="glass-inner rounded-lg p-3 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="w-3 h-3 text-[#F59E0B]" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">İşlem Sayısı</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-foreground">{result.summary.totalTrades}</p>
                </div>
                <div className="glass-inner rounded-lg p-3 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="w-3 h-3 text-[#EF4444]" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Max Drawdown</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-[#F87171]">%{result.summary.maxDrawdown}</p>
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Son Sermaye</p>
                  <p className="text-sm font-bold text-foreground font-mono">{formatCurrency(result.summary.finalCapital)}</p>
                </div>
                <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Başlangıç</p>
                  <p className="text-sm font-bold text-muted-foreground font-mono">{formatCurrency(result.summary.initialCapital)}</p>
                </div>
                <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Ort. Kazanç</p>
                  <p className="text-sm font-bold text-[#22C55E] font-mono">{formatPercent(result.summary.avgWin)}</p>
                </div>
                <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Ort. Kayıp</p>
                  <p className="text-sm font-bold text-[#F87171] font-mono">{formatPercent(result.summary.avgLoss)}</p>
                </div>
              </div>
            </div>

            {/* Equity Chart */}
            {result.equity?.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#3B82F6]" /> Sermaye Eğrisi
                </h3>
                <div className="h-[280px]">
                  <EquityChart equity={result.equity} positive={result.summary.totalReturn >= 0} />
                </div>
              </div>
            )}

            {/* Trades Table */}
            {result.trades?.length > 0 && (
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#F59E0B]" /> İşlem Geçmişi ({result.trades.length})
                  </h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-[#22C55E]">✓ Kazanç: {result.trades.filter((t: any) => t.pnl > 0).length}</span>
                    <span className="text-[#F87171]">✗ Kayıp: {result.trades.filter((t: any) => t.pnl <= 0).length}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-muted-foreground border-b border-black/[0.08] dark:border-white/[0.08]">
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Tarih</th>
                      <th className="px-4 py-2 text-right">Giriş</th>
                      <th className="px-4 py-2 text-right">Çıkış</th>
                      <th className="px-4 py-2 text-right">K/Z %</th>
                      <th className="px-4 py-2 text-right">K/Z ₺</th>
                      <th className="px-4 py-2 text-left">Sebep</th>
                    </tr></thead>
                    <tbody>
                      {result.trades.map((t: any, i: number) => (
                        <tr key={i} className="border-b border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]">
                          <td className="px-4 py-2 text-slate-400 dark:text-slate-500">{i + 1}</td>
                          <td className="px-4 py-2 text-muted-foreground">{t.date}</td>
                          <td className="px-4 py-2 text-right text-foreground font-mono">{formatCurrency(t.entry)}</td>
                          <td className="px-4 py-2 text-right text-foreground font-mono">{formatCurrency(t.exit)}</td>
                          <td className={`px-4 py-2 text-right font-mono font-medium ${t.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                            {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}%
                          </td>
                          <td className={`px-4 py-2 text-right font-mono font-medium ${t.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                            {formatCurrency(t.pnl)}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              t.reason === 'Stop Loss' ? 'bg-[#EF4444]/10 text-[#F87171]' :
                              t.reason === 'Take Profit' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                              'bg-[#3B82F6]/10 text-[#3B82F6]'
                            }`}>{t.reason}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}

function renderRule(
  rule: Rule,
  updateRule: (id: number, field: string, value: any) => void,
  removeRule: (id: number) => void
) {
  const dirColor = rule.direction === 'buy' ? 'border-[#22C55E]/20' : 'border-[#EF4444]/20';
  return (
    <div key={rule.id} className={`flex flex-wrap items-center gap-2 glass-inner rounded-lg p-3 border ${dirColor}`}>
      <select value={rule.direction} onChange={e => updateRule(rule.id, 'direction', e.target.value)}
        className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
        <option value="buy">🟢 AL</option>
        <option value="sell">🔴 SAT</option>
      </select>
      <select value={rule.indicator} onChange={e => updateRule(rule.id, 'indicator', e.target.value)}
        className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
        {INDICATORS.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
      </select>
      <select value={rule.operator} onChange={e => updateRule(rule.id, 'operator', e.target.value)}
        className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
        {OPERATORS.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
      </select>
      <select value={rule.compareWith} onChange={e => updateRule(rule.id, 'compareWith', e.target.value)}
        className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
        <option value="indicator">Gösterge</option>
        <option value="value">Değer</option>
      </select>
      {rule.compareWith === 'indicator' ? (
        <select value={rule.compareIndicator} onChange={e => updateRule(rule.id, 'compareIndicator', e.target.value)}
          className="glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
          {INDICATORS.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
        </select>
      ) : (
        <input type="number" value={rule.value} onChange={e => updateRule(rule.id, 'value', Number(e.target.value))}
          className="w-20 glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none" />
      )}
      <button onClick={() => removeRule(rule.id)} className="ml-auto p-1.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
