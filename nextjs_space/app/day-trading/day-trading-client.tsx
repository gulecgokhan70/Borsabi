'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, RefreshCw, TrendingUp, TrendingDown, Target, Shield,
  AlertTriangle, Clock, BarChart3, Activity
} from 'lucide-react';
import { formatNumber, formatPercent, formatCurrency, getScoreCategory, SCORE_LABELS } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';

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
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  riskReward: number;
  rsi: number;
  vwap: number;
  macd: { macd: number; signal: number; histogram: number };
}

export function DayTradingClient() {
  const [data, setData] = useState<DayTradeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<{ open: boolean; symbol: string; name: string; price: number; marketType: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'elite' | 'strong' | 'watch'>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/day-trading');
      const json = await res.json();
      setData(json?.data ?? []);
    } catch (e) {
      console.error('Day trading fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredData = data.filter((item) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#F59E0B]" />
            </div>
            Day Trading Motoru
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">Gün içi fırsatları analiz edin</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1E293B] rounded-lg p-1 gap-1">
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'elite', label: 'Elite' },
              { key: 'strong', label: 'Güçlü+' },
              { key: 'watch', label: 'İzleme+' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === f.key
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Tara
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#F59E0B]">Day Trading Uyarısı</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Day trading yüksek risk içerir. İşlem başına sermayenizin maksimum %1'ini riske atın. 
              Stop loss olmadan işlem açmayın. Bu veriler eğitim amaçlıdır, yatırım tavsiyesi değildir.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Taranan Hisse', value: data.length, icon: BarChart3, color: '#3B82F6' },
          { label: 'Elite Fırsat', value: data.filter(d => d.score >= 90).length, icon: Target, color: '#22C55E' },
          { label: 'Güçlü Fırsat', value: data.filter(d => d.score >= 80 && d.score < 90).length, icon: TrendingUp, color: '#3B82F6' },
          { label: 'İzleme', value: data.filter(d => d.score >= 70 && d.score < 80).length, icon: Clock, color: '#F59E0B' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-xs text-[#94A3B8]">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-[#3B82F6] animate-spin mb-4" />
          <p className="text-[#94A3B8]">BIST hisseleri taranıyor...</p>
          <p className="text-xs text-[#64748B] mt-1">Açılış gücü, hacim, VWAP ve momentum analiz ediliyor</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="w-12 h-12 text-[#64748B] mx-auto mb-3" />
          <p className="text-[#94A3B8]">Bu filtrede day trade fırsatı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((item, idx) => (
            <motion.div
              key={item.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-[#1E293B] rounded-xl border overflow-hidden ${getScoreBg(item.score)}`}
            >
              <div className="p-5">
                {/* Top row */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${getScoreBg(item.score)}`}>
                      <span className={`text-lg font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
                      <span className="text-[8px] text-[#94A3B8] uppercase">Puan</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{item.symbol}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreBg(item.score)} ${getScoreColor(item.score)}`}>
                          {item.quality}
                        </span>
                      </div>
                      <p className="text-sm text-[#94A3B8]">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{formatCurrency(item.price)}</p>
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

                {/* Signals */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.signals.map((signal, sIdx) => (
                    <span key={sIdx} className="text-xs px-2.5 py-1 rounded-full bg-[#0F172A] text-[#94A3B8] border border-[#334155]">
                      {signal}
                    </span>
                  ))}
                </div>

                {/* Trade plan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: 'Giriş', value: formatCurrency(item.entry), icon: TrendingUp, color: '#3B82F6' },
                    { label: 'Stop', value: formatCurrency(item.stop), icon: Shield, color: '#EF4444' },
                    { label: 'Hedef 1', value: formatCurrency(item.target1), icon: Target, color: '#22C55E' },
                    { label: 'Hedef 2', value: formatCurrency(item.target2), icon: Target, color: '#22C55E' },
                    { label: 'R/G', value: `1:${item.riskReward}`, icon: Activity, color: '#F59E0B' },
                    { label: 'RSI', value: item.rsi.toString(), icon: BarChart3, color: '#94A3B8' },
                    { label: 'VWAP', value: formatNumber(item.vwap), icon: Activity, color: '#94A3B8' },
                  ].map((field, fIdx) => (
                    <div key={fIdx} className="bg-[#0F172A]/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <field.icon className="w-3 h-3" style={{ color: field.color }} />
                        <span className="text-[10px] text-[#64748B] uppercase">{field.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{field.value}</p>
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
        <p className="text-xs text-[#64748B]">
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
