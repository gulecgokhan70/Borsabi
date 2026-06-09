'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Activity, DollarSign, Volume2, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatNumber, formatPercent, toTradingViewSymbol } from '@/lib/constants';

interface StockData {
  symbol: string;
  name: string;
  shortName: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  currency: string;
  indicators: { rsi: number | null; ema20: number | null; ema50: number | null; avgVolume: number };
}

export default function StockDetailClient({ symbol }: { symbol: string }) {
  const router = useRouter();
  const tvContainerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}?period=1mo`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (e: any) {
      console.error('Stock data error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // TradingView Advanced Chart Widget
  useEffect(() => {
    if (!tvContainerRef.current) return;
    const container = tvContainerRef.current;
    container.innerHTML = '';

    const tvSymbol = toTradingViewSymbol(symbol);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Europe/Istanbul',
      theme: 'dark',
      style: '1',
      locale: 'tr',
      backgroundColor: '#0F172A',
      gridColor: '#1E293B',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: ['RSI@tv-basicstudies', 'MAExp@tv-basicstudies'],
    });

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';

    container.appendChild(widgetDiv);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol]);

  const isPositive = (data?.change ?? 0) >= 0;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0F172A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0F172A] text-white">
        <p className="text-[#94A3B8] mb-4">Hisse verisi bulunamadı</p>
        <button onClick={() => router.back()} className="text-[#3B82F6] hover:underline">Geri Dön</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#94A3B8]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{data.shortName}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${isPositive ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>
                {isPositive ? '+' : ''}{formatPercent(data.changePercent)}
              </span>
            </div>
            <p className="text-[#64748B] text-sm mt-1">{data.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">{formatCurrency(data.price)}</p>
          <p className={`text-sm font-medium ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
            {isPositive ? '+' : ''}{formatCurrency(data.change)}
          </p>
        </div>
      </motion.div>

      {/* TradingView Chart */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
        <div
          ref={tvContainerRef}
          className="tradingview-widget-container w-full"
          style={{ height: '500px' }}
        />
      </motion.div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Açılış', value: formatCurrency(data.open), icon: DollarSign },
          { label: 'Önceki Kapanış', value: formatCurrency(data.prevClose), icon: ArrowUpDown },
          { label: 'Gün İçi Yüksek', value: formatCurrency(data.high), icon: TrendingUp },
          { label: 'Gün İçi Düşük', value: formatCurrency(data.low), icon: TrendingDown },
          { label: 'Hacim', value: formatNumber(data.volume), icon: Volume2 },
          { label: 'Ort. Hacim', value: formatNumber(data.indicators?.avgVolume ?? 0), icon: Activity },
          { label: '52H Yüksek', value: formatCurrency(data.fiftyTwoWeekHigh), icon: TrendingUp },
          { label: '52H Düşük', value: formatCurrency(data.fiftyTwoWeekLow), icon: TrendingDown },
        ].map((item: any, i: number) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="bg-[#1E293B] rounded-xl border border-[#334155] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-xs text-[#64748B]">{item.label}</span>
            </div>
            <p className="text-white font-semibold">{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Technical indicators from Yahoo */}
      {(data.indicators?.rsi || data.indicators?.ema20 || data.indicators?.ema50) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#1E293B] rounded-xl border border-[#334155] p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#3B82F6]" />
            Teknik Göstergeler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.indicators.rsi !== null && (
              <div className="bg-[#0F172A] rounded-lg p-4">
                <p className="text-xs text-[#64748B] mb-1">RSI (14)</p>
                <p className={`text-xl font-bold ${(data.indicators.rsi ?? 50) > 70 ? 'text-[#EF4444]' : (data.indicators.rsi ?? 50) < 30 ? 'text-[#22C55E]' : 'text-white'}`}>
                  {(data.indicators.rsi ?? 0).toFixed(1)}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  {(data.indicators.rsi ?? 50) > 70 ? 'Aşırı Alım' : (data.indicators.rsi ?? 50) < 30 ? 'Aşırı Satım' : 'Nötr'}
                </p>
                <div className="w-full bg-[#334155] rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${(data.indicators.rsi ?? 50) > 70 ? 'bg-[#EF4444]' : (data.indicators.rsi ?? 50) < 30 ? 'bg-[#22C55E]' : 'bg-[#3B82F6]'}`}
                    style={{ width: `${Math.min(data.indicators.rsi ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {data.indicators.ema20 !== null && (
              <div className="bg-[#0F172A] rounded-lg p-4">
                <p className="text-xs text-[#64748B] mb-1">EMA 20</p>
                <p className="text-xl font-bold text-white">{formatCurrency(data.indicators.ema20 ?? 0)}</p>
                <p className={`text-xs mt-1 ${data.price > (data.indicators.ema20 ?? 0) ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  Fiyat {data.price > (data.indicators.ema20 ?? 0) ? 'üstünde ↑' : 'altında ↓'}
                </p>
              </div>
            )}
            {data.indicators.ema50 !== null && (
              <div className="bg-[#0F172A] rounded-lg p-4">
                <p className="text-xs text-[#64748B] mb-1">EMA 50</p>
                <p className="text-xl font-bold text-white">{formatCurrency(data.indicators.ema50 ?? 0)}</p>
                <p className={`text-xs mt-1 ${data.price > (data.indicators.ema50 ?? 0) ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  Fiyat {data.price > (data.indicators.ema50 ?? 0) ? 'üstünde ↑' : 'altında ↓'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Disclaimer */}
      <p className="text-center text-xs text-[#475569] py-4">
        ⚠️ Bu sayfa yalnızca eğitim amaçlıdır. Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
