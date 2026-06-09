'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, CandlestickChart, LineChart as LineChartIcon, Loader2, Activity, DollarSign, Volume2, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/constants';

type ChartType = 'candlestick' | 'bar' | 'line';

const PERIOD_OPTIONS = [
  { id: '1w', label: '1H' },
  { id: '1mo', label: '1A' },
  { id: '3mo', label: '3A' },
  { id: '6mo', label: '6A' },
  { id: '1y', label: '1Y' },
];

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
  ohlc: { time: number; date: string; open: number; high: number; low: number; close: number; volume: number }[];
}

export default function StockDetailClient({ symbol }: { symbol: string }) {
  const router = useRouter();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [period, setPeriod] = useState('1mo');
  const [chartReady, setChartReady] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}?period=${period}`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (e: any) {
      console.error('Stock data error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;
    let cancelled = false;

    import('lightweight-charts').then((mod) => {
      if (cancelled || !chartRef.current) return;
      // Clean up previous chart
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
      }

      const chart = mod.createChart(chartRef.current!, {
        layout: {
          background: { color: '#0F172A' } as any,
          textColor: '#94A3B8',
          fontFamily: 'Inter, sans-serif',
        },
        grid: {
          vertLines: { color: '#1E293B' },
          horzLines: { color: '#1E293B' },
        },
        crosshair: {
          mode: 0,
        },
        rightPriceScale: {
          borderColor: '#334155',
        },
        timeScale: {
          borderColor: '#334155',
          timeVisible: true,
        },
        handleScroll: true,
        handleScale: true,
      });

      chartInstanceRef.current = chart;
      setChartReady(true);

      const resizeObserver = new ResizeObserver(() => {
        if (chartRef.current && chart) {
          chart.applyOptions({ width: chartRef.current.clientWidth });
        }
      });
      if (chartRef.current) resizeObserver.observe(chartRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    });

    return () => {
      cancelled = true;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
        setChartReady(false);
      }
    };
  }, []);

  // Update chart series when data or type changes
  useEffect(() => {
    if (!chartInstanceRef.current || !data || !chartReady) return;
    const chart = chartInstanceRef.current;

    // Remove existing series
    if (seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch (e: any) { /* ignore */ }
      seriesRef.current = null;
    }
    if (volumeSeriesRef.current) {
      try { chart.removeSeries(volumeSeriesRef.current); } catch (e: any) { /* ignore */ }
      volumeSeriesRef.current = null;
    }

    const ohlc = data.ohlc ?? [];
    if (ohlc.length === 0) return;

    // Deduplicate by time
    const seen = new Set<number>();
    const uniqueOhlc = ohlc.filter((d: any) => {
      if (seen.has(d.time)) return false;
      seen.add(d.time);
      return true;
    });

    if (chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderDownColor: '#EF4444',
        borderUpColor: '#22C55E',
        wickDownColor: '#EF4444',
        wickUpColor: '#22C55E',
      });
      series.setData(uniqueOhlc.map((d: any) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));
      seriesRef.current = series;
    } else if (chartType === 'bar') {
      const series = chart.addBarSeries({
        upColor: '#22C55E',
        downColor: '#EF4444',
      });
      series.setData(uniqueOhlc.map((d: any) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));
      seriesRef.current = series;
    } else {
      const series = chart.addAreaSeries({
        lineColor: '#3B82F6',
        topColor: 'rgba(59,130,246,0.3)',
        bottomColor: 'rgba(59,130,246,0.02)',
        lineWidth: 2,
      });
      series.setData(uniqueOhlc.map((d: any) => ({
        time: d.time,
        value: d.close,
      })));
      seriesRef.current = series;
    }

    // Volume series
    const volSeries = chart.addHistogramSeries({
      color: '#334155',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volSeries.setData(uniqueOhlc.map((d: any) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
    })));
    volumeSeriesRef.current = volSeries;

    chart.timeScale().fitContent();
  }, [data, chartType, chartReady]);

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

      {/* Chart Controls */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          {/* Chart type buttons */}
          <div className="flex items-center gap-1 bg-[#0F172A] rounded-lg p-1">
            <button
              onClick={() => setChartType('candlestick')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${chartType === 'candlestick' ? 'bg-[#3B82F6] text-white' : 'text-[#94A3B8] hover:text-white'}`}
            >
              <CandlestickChart className="w-4 h-4" /> Mum
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${chartType === 'bar' ? 'bg-[#3B82F6] text-white' : 'text-[#94A3B8] hover:text-white'}`}
            >
              <BarChart3 className="w-4 h-4" /> Çubuk
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${chartType === 'line' ? 'bg-[#3B82F6] text-white' : 'text-[#94A3B8] hover:text-white'}`}
            >
              <LineChartIcon className="w-4 h-4" /> Çizgi
            </button>
          </div>

          {/* Period buttons */}
          <div className="flex items-center gap-1">
            {PERIOD_OPTIONS.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${period === p.id ? 'bg-[#3B82F6] text-white' : 'bg-[#0F172A] text-[#94A3B8] hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart container */}
        <div ref={chartRef} className="w-full h-[400px] md:h-[500px] rounded-lg overflow-hidden" />
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
            <span className="text-[#94A3B8] text-sm ml-2">Yükleniyor...</span>
          </div>
        )}
      </motion.div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Açılış', value: formatCurrency(data.open), icon: DollarSign },
          { label: 'Önceki Kapanış', value: formatCurrency(data.prevClose), icon: ArrowUpDown },
          { label: 'Gün İçi Yüksek', value: formatCurrency(data.high), icon: TrendingUp },
          { label: 'Gün İçi Düşük', value: formatCurrency(data.low), icon: TrendingDown },
          { label: 'Hacim', value: formatNumber(data.volume), icon: Volume2 },
          { label: 'Ort. Hacim', value: formatNumber(data.indicators?.avgVolume ?? 0), icon: BarChart3 },
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

      {/* Technical indicators */}
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
