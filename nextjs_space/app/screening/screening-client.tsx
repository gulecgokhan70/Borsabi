'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, RefreshCw, Loader2, TrendingUp, Target, ShieldAlert, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatNumber, formatPercent, getScoreCategory, SCORE_LABELS } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';

export function ScreeningClient() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<any>(null);

  const fetchScreening = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/screening');
      const data = await res.json();
      setResults(data?.data ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchScreening(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Hisse Tarama Motoru</h1>
          <p className="text-sm text-[#94A3B8]">BIST hisseleri için teknik gösterge bazlı puanlama</p>
        </div>
        <button onClick={fetchScreening} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Tara
        </button>
      </div>

      {/* Score legend */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(SCORE_LABELS ?? {}).map(([key, val]: any) => (
          <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E293B] border border-[#334155]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: val?.color }} />
            <span className="text-xs text-[#94A3B8]">{val?.label}</span>
            <span className="text-[10px] text-[#64748B]">
              {key === 'elite' ? '90-100' : key === 'strong' ? '80-89' : key === 'watch' ? '70-79' : '60-69'}
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Hisseler taranıyor...</p>
            <p className="text-xs text-[#64748B] mt-1">Teknik göstergeler hesaplanıyor</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(results ?? []).map((stock: any, i: number) => {
            const cat = getScoreCategory(stock?.score ?? 0);
            const catInfo = SCORE_LABELS?.[cat] ?? { label: '-', color: '#94A3B8' };
            return (
              <motion.div
                key={stock?.symbol ?? i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 hover:border-[#3B82F6]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Name & score */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg" style={{ backgroundColor: `${catInfo?.color}15`, color: catInfo?.color }}>
                        {stock?.score ?? 0}
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: catInfo?.color, color: '#fff' }}>
                        {catInfo?.label}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-white">{stock?.symbol}</p>
                        <span className={`text-xs font-mono font-semibold ${(stock?.change ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {(stock?.change ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                          {formatPercent(stock?.change)}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8]">{stock?.name}</p>
                      <p className="text-sm font-mono font-semibold text-white mt-0.5">{formatNumber(stock?.price)} TL</p>
                    </div>
                  </div>

                  {/* Center: Indicators */}
                  <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-[#64748B] mb-0.5">RSI</p>
                      <p className={`text-xs font-mono font-semibold ${(stock?.rsi ?? 50) < 30 ? 'text-[#22C55E]' : (stock?.rsi ?? 50) > 70 ? 'text-[#EF4444]' : 'text-white'}`}>
                        {stock?.rsi ?? '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748B] mb-0.5">MACD</p>
                      <p className={`text-xs font-mono font-semibold ${(stock?.macd?.histogram ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {stock?.macd?.histogram ?? '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748B] mb-0.5">EMA20</p>
                      <p className="text-xs font-mono text-white">{formatNumber(stock?.ema20)}</p>
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-[10px] text-[#64748B] mb-0.5">EMA50</p>
                      <p className="text-xs font-mono text-white">{formatNumber(stock?.ema50)}</p>
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-[10px] text-[#64748B] mb-0.5">R/G Oranı</p>
                      <p className="text-xs font-mono text-[#3B82F6]">1:{stock?.riskReward ?? '-'}</p>
                    </div>
                  </div>

                  {/* Right: Levels & action */}
                  <div className="flex items-center gap-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-[#64748B]">Giriş</p>
                        <p className="text-xs font-mono text-[#3B82F6]">{formatNumber(stock?.entry)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748B]">Stop</p>
                        <p className="text-xs font-mono text-[#EF4444]">{formatNumber(stock?.stop)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748B]">Hedef</p>
                        <p className="text-xs font-mono text-[#22C55E]">{formatNumber(stock?.target)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTradeModal({ symbol: stock?.yahooSymbol ?? stock?.symbol, name: stock?.name, price: stock?.price ?? 0, marketType: 'BIST' })}
                      className="px-4 py-2 text-xs font-semibold bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6]/20 transition-colors whitespace-nowrap"
                    >
                      İşlem Yap
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {(results?.length ?? 0) === 0 && (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
              <p className="text-sm text-[#94A3B8]">Tarama sonucu bulunamadı</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-[#64748B] text-center pb-4">⚠️ Tarama sonuçları yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır.</p>

      {tradeModal && (
        <TradeModal
          isOpen={true}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal?.symbol}
          name={tradeModal?.name}
          price={tradeModal?.price}
          marketType={tradeModal?.marketType}
          onSuccess={fetchScreening}
        />
      )}
    </div>
  );
}
