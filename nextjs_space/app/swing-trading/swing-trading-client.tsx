'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, RefreshCw, Target, Shield, Clock,
  AlertTriangle, BarChart3, Activity, Waves, ArrowUpDown, Crosshair, Zap
} from 'lucide-react';
import { formatNumber, formatPercent, formatCurrency, getScoreCategory } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';

interface SwingTradeResult {
  symbol: string;
  yahooSymbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  avgVolume: number;
  score: number;
  quality: string;
  signals: string[];
  passesFilter: boolean;
  sapanDetected: boolean;
  dipBipDetected: boolean;
  formations: string[];
  entryZone: { low: number; high: number };
  stop: number;
  target1: number;
  target2: number;
  holdingPeriod: string;
  riskReward: number;
  rsi: number;
  atr: number;
  ema20: number;
  ema50: number;
  ema200: number;
  macd: { macd: number; signal: number; histogram: number };
}

export function SwingTradingClient() {
  const [data, setData] = useState<SwingTradeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<{ open: boolean; symbol: string; name: string; price: number; marketType: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'elite' | 'strong' | 'watch'>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/swing-trading');
      const json = await res.json();
      setData(json?.data ?? []);
    } catch (e) {
      console.error('Swing trading fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredData = data.filter((item: SwingTradeResult) => {
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
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Waves className="w-5 h-5 text-[#3B82F6]" />
            </div>
            Swing Trading Motoru
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">Sapan & Dip-Bip Sistemleri ile Orta Vadeli Fırsat Analizi</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1E293B] rounded-lg p-1 gap-1">
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

      {/* Info */}
      <div className="bg-[#3B82F6]/5 border border-[#3B82F6]/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#3B82F6]">Swing Trading Stratejisi</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Filtre: EMA20 üstü | EMA20 {'>'} EMA50 | RSI(14) 50-70 | MACD pozitif | Hacim {'>'} ort. 
              Sapan Sistemi (pullback to EMA20) ve Dip-Bip Sistemi (dip dönüşü) tespit edilir. Minimum R:R 1:2.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Hisse', value: data.length, icon: BarChart3, color: '#3B82F6' },
          { label: 'Sapan Sinyali', value: data.filter((d: SwingTradeResult) => d.sapanDetected).length, icon: Crosshair, color: '#F59E0B' },
          { label: 'Dip-Bip Sinyali', value: data.filter((d: SwingTradeResult) => d.dipBipDetected).length, icon: Zap, color: '#22C55E' },
          { label: 'Formasyon', value: data.filter((d: SwingTradeResult) => (d.formations?.length ?? 0) > 0).length, icon: Activity, color: '#8B5CF6' },
        ].map((stat: any, idx: number) => (
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
          <p className="text-xs text-[#64748B] mt-1">Sapan, Dip-Bip, formasyon ve EMA dizilimi analiz ediliyor</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-16">
          <Waves className="w-12 h-12 text-[#64748B] mx-auto mb-3" />
          <p className="text-[#94A3B8]">Bu filtrede swing trade fırsatı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((item: SwingTradeResult, idx: number) => (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white">{item.symbol}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreBg(item.score)} ${getScoreColor(item.score)}`}>
                          {item.quality}
                        </span>
                        {item.sapanDetected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold">
                            🎯 Sapan
                          </span>
                        )}
                        {item.dipBipDetected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 font-semibold">
                            ⚡ Dip-Bip
                          </span>
                        )}
                        {item.passesFilter && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 font-medium">
                            ✓ Filtre
                          </span>
                        )}
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

                {/* Signals + Formations */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(item.signals ?? []).map((signal: string, sIdx: number) => (
                    <span key={sIdx} className="text-xs px-2.5 py-1 rounded-full bg-[#0F172A] text-[#94A3B8] border border-[#334155]">
                      {signal}
                    </span>
                  ))}
                  {(item.formations ?? []).map((f: string, fIdx: number) => (
                    <span key={`f-${fIdx}`} className="text-xs px-2.5 py-1 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30 font-medium">
                      📐 {f}
                    </span>
                  ))}
                </div>

                {/* Trade plan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {[
                    { label: 'Giriş Bölgesi', value: `${formatNumber(item.entryZone?.low ?? 0)} - ${formatNumber(item.entryZone?.high ?? 0)}`, icon: TrendingUp, color: '#3B82F6' },
                    { label: 'Stop', value: formatCurrency(item.stop), icon: Shield, color: '#EF4444' },
                    { label: 'Hedef 1', value: formatCurrency(item.target1), icon: Target, color: '#22C55E' },
                    { label: 'Hedef 2', value: formatCurrency(item.target2), icon: Target, color: '#22C55E' },
                    { label: 'Bekleme', value: item.holdingPeriod ?? '-', icon: Clock, color: '#94A3B8' },
                    { label: 'R/G', value: `1:${item.riskReward}`, icon: ArrowUpDown, color: '#F59E0B' },
                    { label: 'RSI', value: (item.rsi ?? 0).toString(), icon: BarChart3, color: '#94A3B8' },
                    { label: 'ATR', value: formatNumber(item.atr), icon: Activity, color: '#94A3B8' },
                  ].map((field: any, fIdx: number) => (
                    <div key={fIdx} className="bg-[#0F172A]/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <field.icon className="w-3 h-3" style={{ color: field.color }} />
                        <span className="text-[10px] text-[#64748B] uppercase">{field.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{field.value}</p>
                    </div>
                  ))}
                </div>

                {/* EMA levels */}
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <span className="text-[#94A3B8]">EMA20: <span className={item.price > item.ema20 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{formatNumber(item.ema20)}</span></span>
                  <span className="text-[#94A3B8]">EMA50: <span className={item.price > item.ema50 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{formatNumber(item.ema50)}</span></span>
                  <span className="text-[#94A3B8]">EMA200: <span className={item.price > item.ema200 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{formatNumber(item.ema200)}</span></span>
                  <span className="text-[#94A3B8]">MACD: <span className={(item.macd?.histogram ?? 0) > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{formatNumber(item.macd?.histogram ?? 0)}</span></span>
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
