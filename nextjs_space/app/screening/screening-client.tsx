'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, RefreshCw, Loader2, TrendingUp, Target, ShieldAlert, Zap, ArrowUpRight, ArrowDownRight, Crosshair, BarChart3, Activity } from 'lucide-react';
import { formatNumber, formatPercent, getScoreCategory, SCORE_LABELS } from '@/lib/constants';
import { TradeModal } from '@/components/trade-modal';

export function ScreeningClient() {
  const router = useRouter();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<any>(null);
  const [marketOpen, setMarketOpen] = useState(true);

  const fetchScreening = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/screening');
      const data = await res.json();
      setResults(data?.data ?? []);
      if (data?.marketOpen !== undefined) setMarketOpen(data.marketOpen);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchScreening();
    const interval = setInterval(() => { fetchScreening(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchScreening]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 65) return '#3B82F6';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Hisse Tarama Motoru</h1>
          <p className="text-sm text-[#94A3B8]">BIST hisseleri için 5 kategori puanlama + Sapan/Dip-Bip/Formasyon tespiti</p>
        </div>
        <button onClick={fetchScreening} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Tara
        </button>
      </div>

      {!marketOpen && !loading && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
          <span className="text-[#F59E0B] text-lg">🔔</span>
          <p className="text-[#F59E0B] text-sm font-medium">Borsa şu an kapalı — son kapanış verileri üzerinden tarama yapılmıştır. Yarın açılışta tekrar tarayın.</p>
        </div>
      )}

      {/* Score legend */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(SCORE_LABELS ?? {}).map(([key, val]: any) => (
          <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E293B] border border-[#334155]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: val?.color }} />
            <span className="text-xs text-[#94A3B8]">{val?.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Hisseler taranıyor...</p>
            <p className="text-xs text-[#64748B] mt-1">Tüm teknik göstergeler, Sapan/Dip-Bip ve formasyonlar hesaplanıyor</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(results ?? []).map((stock: any, i: number) => {
            const scoreColor = getScoreColor(stock?.score ?? 0);
            return (
              <motion.div
                key={stock?.symbol ?? i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 hover:border-[#3B82F6]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Left: Name & score */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold" style={{ backgroundColor: `${scoreColor}15`, color: scoreColor }}>
                        <span className="text-lg">{stock?.score ?? 0}</span>
                        <span className="text-[7px] opacity-70">PUAN</span>
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: scoreColor }}>
                        {stock?.quality ?? '-'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-white cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={() => router.push(`/stock/${encodeURIComponent(stock?.yahooSymbol ?? stock?.symbol)}`)}>{stock?.symbol}</p>
                        <span className={`text-xs font-mono font-semibold ${(stock?.change ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {(stock?.change ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                          {formatPercent(stock?.change)}
                        </span>
                        {stock?.dayTradeUygun && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold">
                            ⚡ Day
                          </span>
                        )}
                        {stock?.swingUygun && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 font-semibold">
                            🌊 Swing
                          </span>
                        )}
                        {stock?.sapanDetected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold">
                            🎯 Sapan
                          </span>
                        )}
                        {stock?.dipBipDetected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 font-semibold">
                            ⚡ Dip-Bip
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#94A3B8]">{stock?.name}</p>
                      <p className="text-sm font-mono font-semibold text-white mt-0.5">{formatNumber(stock?.price)} TL</p>
                    </div>
                  </div>

                  {/* Center: Puan dağılımı + Indicators */}
                  <div className="flex-1 min-w-0">
                    {/* Puan bars */}
                    <div className="grid grid-cols-5 gap-1 mb-2">
                      {[
                        { label: 'Hac', puan: stock?.hacimPuan ?? 0 },
                        { label: 'Trn', puan: stock?.trendPuan ?? 0 },
                        { label: 'Mom', puan: stock?.momentumPuan ?? 0 },
                        { label: 'For', puan: stock?.formasyonPuan ?? 0 },
                        { label: 'R/Ö', puan: stock?.riskOdulPuan ?? 0 },
                      ].map((p: any, pIdx: number) => (
                        <div key={pIdx} className="text-center">
                          <div className="h-1.5 bg-[#0F172A] rounded-full overflow-hidden mb-0.5">
                            <div className="h-full rounded-full" style={{ width: `${(p.puan / 20) * 100}%`, backgroundColor: p.puan >= 16 ? '#22C55E' : p.puan >= 10 ? '#3B82F6' : '#F59E0B' }} />
                          </div>
                          <span className="text-[8px] text-[#64748B]">{p.label} {p.puan}</span>
                        </div>
                      ))}
                    </div>
                    {/* Formations */}
                    {(stock?.formations?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(stock.formations ?? []).map((f: string, fIdx: number) => (
                          <span key={fIdx} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30">
                            📐 {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Indicators row */}
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 text-center">
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
                        <p className="text-[10px] text-[#64748B] mb-0.5">VWAP</p>
                        <p className="text-xs font-mono text-white">{formatNumber(stock?.vwap)}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] text-[#64748B] mb-0.5">R/G</p>
                        <p className="text-xs font-mono text-[#3B82F6]">1:{stock?.riskReward ?? '-'}</p>
                      </div>
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
