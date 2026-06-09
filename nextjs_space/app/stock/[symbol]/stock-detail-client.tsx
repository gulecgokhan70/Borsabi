'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, TrendingUp, TrendingDown, Loader2, Activity, DollarSign, Volume2,
  ArrowUpDown, BarChart3, Shield, Target, Gauge, Layers, ChevronDown, ChevronUp,
  Info, Percent, Building2, LineChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/constants';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell
} from 'recharts';

interface OHLCData {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
}

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
  indicators: {
    rsi: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    avgVolume: number;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
  };
  ohlc: OHLCData[];
  vwap?: number;
  tavan?: number;
  taban?: number;
  fk?: number;
  pddd?: number;
  freeFloat?: number;
  volatility?: number;
}

const PERIODS = [
  { label: 'Günlük', value: '1d', interval: '5m' },
  { label: '1H', value: '1w', interval: '1d' },
  { label: '1A', value: '1mo', interval: '1d' },
  { label: '3A', value: '3mo', interval: '1d' },
  { label: '6A', value: '6mo', interval: '1d' },
  { label: '1Y', value: '1y', interval: '1d' },
];

type ChartOverlay = 'ema' | 'bb' | 'none';
type BottomIndicator = 'volume' | 'macd';
type ChartType = 'candle' | 'line';

const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || !payload.open || !payload.close || !payload.high || !payload.low) return null;

  const { open, close, high, low, isUp } = payload;
  const color = isUp ? '#22C55E' : '#EF4444';

  const bodyTop = y;
  const bodyBottom = y + Math.abs(height);
  const barCenter = x + width / 2;

  const bodyRange = Math.abs(open - close) || 0.001;
  const pixelPerPrice = Math.abs(height) / bodyRange;

  const wickTopPrice = high - Math.max(open, close);
  const wickTopY = bodyTop - wickTopPrice * pixelPerPrice;
  const wickBottomPrice = Math.min(open, close) - low;
  const wickBottomY = bodyBottom + wickBottomPrice * pixelPerPrice;

  const candleWidth = Math.max(Math.min(width * 0.7, 12), 3);
  const wickWidth = Math.max(Math.min(width * 0.12, 2), 1);

  return (
    <g>
      <rect x={barCenter - wickWidth / 2} y={wickTopY} width={wickWidth} height={Math.max(bodyTop - wickTopY, 0)} fill={color} />
      <rect x={barCenter - wickWidth / 2} y={bodyBottom} width={wickWidth} height={Math.max(wickBottomY - bodyBottom, 0)} fill={color} />
      <rect x={barCenter - candleWidth / 2} y={bodyTop} width={candleWidth} height={Math.max(Math.abs(height), 1)} fill={isUp ? color : color} fillOpacity={isUp ? 0.3 : 0.8} stroke={color} strokeWidth={1} rx={1} />
    </g>
  );
};

export default function StockDetailClient({ symbol }: { symbol: string }) {
  const router = useRouter();
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1mo');
  const [chartInterval, setChartInterval] = useState('1d');
  const [overlay, setOverlay] = useState<ChartOverlay>('ema');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [bottomIndicator, setBottomIndicator] = useState<BottomIndicator>('volume');
  const [showFundamentals, setShowFundamentals] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}?period=${period}&interval=${chartInterval}`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (e: any) {
      console.error('Stock data error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, chartInterval]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const refreshMs = period === '1d' ? 30000 : 60000;
    const interval = setInterval(fetchData, refreshMs);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isPositive = (data?.change ?? 0) >= 0;
  const isIntraday = period === '1d';

  const chartData = useMemo(() => {
    return (data?.ohlc ?? []).map((d: OHLCData) => ({
      date: isIntraday
        ? new Date(d.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : new Date(d.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      ema20: d.ema20,
      ema50: d.ema50,
      ema200: d.ema200,
      macd: d.macd,
      macdSignal: d.macdSignal,
      macdHistogram: d.macdHistogram,
      bbUpper: d.bbUpper,
      bbMiddle: d.bbMiddle,
      bbLower: d.bbLower,
      // For candlestick body
      candleBody: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
      candleWick: [d.low, d.high],
      isUp: d.close >= d.open,
    }));
  }, [data?.ohlc, isIntraday]);

  const chartPositive = chartData.length >= 2 ? (chartData[chartData.length - 1]?.close ?? 0) >= (chartData[0]?.close ?? 0) : true;

  // Calculate 52-week range position
  const range52Pct = data && data.fiftyTwoWeekHigh > data.fiftyTwoWeekLow
    ? ((data.price - data.fiftyTwoWeekLow) / (data.fiftyTwoWeekHigh - data.fiftyTwoWeekLow)) * 100
    : 50;

  const PriceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="glass-card rounded-lg p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-400 dark:text-slate-500">Açılış:</span><span className="text-foreground font-mono">{formatCurrency(d.open)}</span>
          <span className="text-slate-400 dark:text-slate-500">Yüksek:</span><span className="text-foreground font-mono">{formatCurrency(d.high)}</span>
          <span className="text-slate-400 dark:text-slate-500">Düşük:</span><span className="text-foreground font-mono">{formatCurrency(d.low)}</span>
          <span className="text-slate-400 dark:text-slate-500">Kapanış:</span><span className={`font-mono font-semibold ${d.close >= d.open ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{formatCurrency(d.close)}</span>
          <span className="text-slate-400 dark:text-slate-500">Hacim:</span><span className="text-foreground font-mono">{formatNumber(d.volume)}</span>
        </div>
      </div>
    );
  };

  const MacdTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d || d.macd === undefined) return null;
    return (
      <div className="glass-card rounded-lg p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        <div className="space-y-0.5">
          <p><span className="text-[#3B82F6]">MACD:</span> <span className="text-foreground font-mono">{d.macd?.toFixed(3)}</span></p>
          <p><span className="text-[#F59E0B]">Sinyal:</span> <span className="text-foreground font-mono">{d.macdSignal?.toFixed(3)}</span></p>
          <p><span className={d.macdHistogram >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}>Histogram:</span> <span className="text-foreground font-mono">{d.macdHistogram?.toFixed(3)}</span></p>
        </div>
      </div>
    );
  };

  if (!loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-foreground">
        <p className="text-muted-foreground mb-4">Hisse verisi bulunamadı</p>
        <button onClick={() => router.back()} className="text-[#3B82F6] hover:underline">Geri Dön</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen glass-inner p-4 md:p-6 space-y-5">
      {/* Header */}
      {data ? (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-lg glass-card hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{data.shortName}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${isPositive ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#EF4444]/20 text-[#F87171]'}`}>
                  {isPositive ? '+' : ''}{formatPercent(data.changePercent)}
                </span>
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">{data.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground">{formatCurrency(data.price)}</p>
            <p className={`text-sm font-medium ${isPositive ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
              {isPositive ? '+' : ''}{formatCurrency(data.change)}
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
        </div>
      )}

      {/* ===== PRICE CHART ===== */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-4">
        {/* Chart controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
            <div className="flex glass-inner rounded-lg p-0.5">
              <button onClick={() => setChartType('candle')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${chartType === 'candle' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500 hover:text-muted-foreground'}`}>🕯️ Mum</button>
              <button onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${chartType === 'line' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500 hover:text-muted-foreground'}`}>📈 Çizgi</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {PERIODS.map((p: any) => (
              <button key={p.value} onClick={() => { setPeriod(p.value); setChartInterval(p.interval); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.value ? 'bg-[#3B82F6] text-white' : 'bg-slate-100 dark:bg-[#0F172A] text-muted-foreground hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overlay toggles */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setOverlay(overlay === 'ema' ? 'none' : 'ema')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              overlay === 'ema' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40' : 'bg-slate-100 dark:bg-[#0F172A] text-slate-400 dark:text-slate-500 border border-transparent hover:text-muted-foreground'
            }`}>EMA</button>
          <button onClick={() => setOverlay(overlay === 'bb' ? 'none' : 'bb')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              overlay === 'bb' ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40' : 'bg-slate-100 dark:bg-[#0F172A] text-slate-400 dark:text-slate-500 border border-transparent hover:text-muted-foreground'
            }`}>Bollinger</button>
          <span className="border-l border-black/[0.08] dark:border-white/[0.08] mx-1" />
          <button onClick={() => setBottomIndicator('volume')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              bottomIndicator === 'volume' ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40' : 'bg-slate-100 dark:bg-[#0F172A] text-slate-400 dark:text-slate-500 border border-transparent hover:text-muted-foreground'
            }`}>Hacim</button>
          <button onClick={() => setBottomIndicator('macd')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              bottomIndicator === 'macd' ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40' : 'bg-slate-100 dark:bg-[#0F172A] text-slate-400 dark:text-slate-500 border border-transparent hover:text-muted-foreground'
            }`}>MACD</button>
        </div>

        {/* Main Price Chart */}
        <div style={{ height: '380px' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>

                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={65}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(2)} />
                <Tooltip content={<PriceTooltip />} />

                {/* Bollinger Bands */}
                {overlay === 'bb' && (
                  <>
                    <Line type="monotone" dataKey="bbUpper" stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="bbLower" stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="bbMiddle" stroke="#F59E0B" strokeWidth={1} strokeOpacity={0.5} dot={false} />
                  </>
                )}

                {/* Price rendering: Candle or Line */}
                {chartType === 'candle' ? (
                  <Bar dataKey="candleBody" shape={<CandlestickShape />} isAnimationActive={false}>
                    {chartData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isUp ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                ) : (
                  <Area type="monotone" dataKey="close" stroke={chartPositive ? '#22C55E' : '#EF4444'} strokeWidth={2} dot={false}
                    fill={chartPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'} />
                )}

                {/* EMA overlays */}
                {overlay === 'ema' && (
                  <>
                    <Line type="monotone" dataKey="ema20" stroke="#3B82F6" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
                    <Line type="monotone" dataKey="ema50" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
                    <Line type="monotone" dataKey="ema200" stroke="#EF4444" strokeWidth={1.5} dot={false} strokeOpacity={0.6} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
            </div>
          )}
        </div>

        {/* EMA Legend */}
        {overlay === 'ema' && (
          <div className="flex flex-wrap gap-4 mt-2 px-2">
            <span className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-0.5 bg-[#3B82F6] inline-block rounded" /> <span className="text-muted-foreground">EMA20</span></span>
            <span className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-0.5 bg-[#F59E0B] inline-block rounded" /> <span className="text-muted-foreground">EMA50</span></span>
            <span className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-0.5 bg-[#EF4444] inline-block rounded" /> <span className="text-muted-foreground">EMA200</span></span>
          </div>
        )}
        {overlay === 'bb' && (
          <div className="flex flex-wrap gap-4 mt-2 px-2">
            <span className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-0.5 bg-[#F59E0B] inline-block rounded" style={{ borderTop: '1px dashed #F59E0B' }} /> <span className="text-muted-foreground">Bollinger Bantları (20, 2)</span></span>
          </div>
        )}

        {/* Bottom Indicator: Volume or MACD */}
        <div className="mt-3 border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
          {bottomIndicator === 'volume' && chartData.length > 0 && (
            <div style={{ height: '100px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={65}
                    tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [formatNumber(value), 'Hacim']} />
                  <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
                    {chartData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isUp ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {bottomIndicator === 'macd' && chartData.length > 0 && (
            <div style={{ height: '120px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData.filter((d: any) => d.macd !== undefined)} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip content={<MacdTooltip />} />
                  <ReferenceLine y={0} stroke="#334155" />
                  <Bar dataKey="macdHistogram" radius={[1, 1, 0, 0]}>
                    {chartData.filter((d: any) => d.macd !== undefined).map((entry: any, idx: number) => (
                      <Cell key={idx} fill={(entry.macdHistogram ?? 0) >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="macd" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="macdSignal" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.div>

      {/* ===== QUICK STATS ROW ===== */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Açılış', value: formatCurrency(data.open), icon: DollarSign, color: 'text-[#3B82F6]' },
            { label: 'Önceki Kapanış', value: formatCurrency(data.prevClose), icon: ArrowUpDown, color: 'text-muted-foreground' },
            { label: 'Gün Yüksek', value: formatCurrency(data.high), icon: TrendingUp, color: 'text-[#22C55E]' },
            { label: 'Gün Düşük', value: formatCurrency(data.low), icon: TrendingDown, color: 'text-[#F87171]' },
            ...(data.tavan ? [{ label: 'Tavan', value: formatCurrency(data.tavan), icon: TrendingUp, color: 'text-[#F97316]' }] : []),
            ...(data.taban ? [{ label: 'Taban', value: formatCurrency(data.taban), icon: TrendingDown, color: 'text-[#EF4444]' }] : []),
            { label: 'Hacim', value: formatNumber(data.volume), icon: Volume2, color: 'text-[#8B5CF6]' },
            { label: 'Ort. Hacim', value: formatNumber(data.indicators?.avgVolume ?? 0), icon: Activity, color: 'text-slate-400 dark:text-slate-500' },
          ].map((item: any, i: number) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}
              className="glass-card rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">{item.label}</span>
              </div>
              <p className="text-foreground font-semibold text-sm font-mono">{item.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ===== 52 WEEK RANGE ===== */}
      {data && (data.fiftyTwoWeekHigh > 0 || data.fiftyTwoWeekLow > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card rounded-xl p-4">
          <h3 className="text-foreground font-semibold text-sm mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#3B82F6]" /> 52 Haftalık Aralık
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#F87171] font-mono whitespace-nowrap">{formatCurrency(data.fiftyTwoWeekLow)}</span>
            <div className="flex-1 relative h-3 glass-inner rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#EF4444]/30 via-[#F59E0B]/30 to-[#22C55E]/30 rounded-full" />
              <div className="absolute top-0 h-full w-2 bg-white rounded-full shadow-lg shadow-white/20 transition-all"
                style={{ left: `calc(${Math.min(Math.max(range52Pct, 2), 98)}% - 4px)` }} />
            </div>
            <span className="text-xs text-[#22C55E] font-mono whitespace-nowrap">{formatCurrency(data.fiftyTwoWeekHigh)}</span>
          </div>
        </motion.div>
      )}

      {/* ===== MIDAS EXTRA DATA (BIST ONLY) ===== */}
      {data && (data.vwap || data.tavan || data.fk || data.pddd) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-4">
          <button onClick={() => setShowFundamentals(!showFundamentals)}
            className="w-full flex items-center justify-between mb-3">
            <h3 className="text-foreground font-semibold text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#8B5CF6]" /> Temel Veriler
            </h3>
            {showFundamentals ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          </button>
          {showFundamentals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.vwap ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">VWAP</p>
                  <p className="text-foreground font-bold font-mono">{formatCurrency(data.vwap)}</p>
                  <p className={`text-[10px] mt-0.5 ${data.price > data.vwap ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                    Fiyat {data.price > data.vwap ? 'üstünde ↑' : 'altında ↓'}
                  </p>
                </div>
              ) : null}
              {data.tavan ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Tavan</p>
                  <p className="text-[#22C55E] font-bold font-mono">{formatCurrency(data.tavan)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{data.taban ? `Taban: ${formatCurrency(data.taban)}` : ''}</p>
                </div>
              ) : null}
              {data.fk ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">F/K Oranı</p>
                  <p className="text-foreground font-bold font-mono">{data.fk.toFixed(2)}</p>
                  <p className={`text-[10px] mt-0.5 ${data.fk < 10 ? 'text-[#22C55E]' : data.fk < 20 ? 'text-[#F59E0B]' : 'text-[#F87171]'}`}>
                    {data.fk < 10 ? 'Ucuz' : data.fk < 20 ? 'Normal' : 'Pahalı'}
                  </p>
                </div>
              ) : null}
              {data.pddd ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">PD/DD</p>
                  <p className="text-foreground font-bold font-mono">{data.pddd.toFixed(2)}</p>
                  <p className={`text-[10px] mt-0.5 ${data.pddd < 1 ? 'text-[#22C55E]' : data.pddd < 3 ? 'text-[#F59E0B]' : 'text-[#F87171]'}`}>
                    {data.pddd < 1 ? 'Değerinin altında' : data.pddd < 3 ? 'Normal' : 'Primli'}
                  </p>
                </div>
              ) : null}
              {data.marketCap ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Piyasa Değeri</p>
                  <p className="text-foreground font-bold font-mono">
                    {data.marketCap >= 1e9 ? `₺${(data.marketCap / 1e9).toFixed(1)} Milyar` : `₺${(data.marketCap / 1e6).toFixed(0)} Milyon`}
                  </p>
                </div>
              ) : null}
              {data.freeFloat ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Serbest Dolaşım</p>
                  <p className="text-foreground font-bold font-mono">%{(data.freeFloat * 100).toFixed(1)}</p>
                </div>
              ) : null}
              {data.volatility ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Volatilite</p>
                  <p className="text-foreground font-bold font-mono">{data.volatility.toFixed(2)}</p>
                  <p className={`text-[10px] mt-0.5 ${data.volatility < 2 ? 'text-[#22C55E]' : data.volatility < 5 ? 'text-[#F59E0B]' : 'text-[#F87171]'}`}>
                    {data.volatility < 2 ? 'Düşük' : data.volatility < 5 ? 'Orta' : 'Yüksek'}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
      )}

      {/* ===== TECHNICAL INDICATORS ===== */}
      {data && (data.indicators?.rsi !== null || data.indicators?.macd !== null) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-card rounded-xl p-4">
          <h3 className="text-foreground font-semibold text-sm mb-4 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-[#3B82F6]" /> Teknik Göstergeler
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* RSI */}
            {data.indicators.rsi !== null && (
              <div className="glass-inner rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">RSI (14)</p>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    (data.indicators.rsi ?? 50) > 70 ? 'bg-[#EF4444]/20 text-[#F87171]' : (data.indicators.rsi ?? 50) < 30 ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#3B82F6]/20 text-[#3B82F6]'
                  }`}>
                    {(data.indicators.rsi ?? 50) > 70 ? 'Aşırı Alım' : (data.indicators.rsi ?? 50) < 30 ? 'Aşırı Satım' : 'Nötr'}
                  </span>
                </div>
                <p className={`text-2xl font-bold font-mono ${(data.indicators.rsi ?? 50) > 70 ? 'text-[#F87171]' : (data.indicators.rsi ?? 50) < 30 ? 'text-[#22C55E]' : 'text-foreground'}`}>
                  {(data.indicators.rsi ?? 0).toFixed(1)}
                </p>
                <div className="w-full bg-[#334155] rounded-full h-2 mt-2 relative">
                  <div className="absolute left-[30%] top-0 w-px h-2 bg-[#64748B]/50" />
                  <div className="absolute left-[70%] top-0 w-px h-2 bg-[#64748B]/50" />
                  <div className={`h-2 rounded-full transition-all ${(data.indicators.rsi ?? 50) > 70 ? 'bg-[#EF4444]' : (data.indicators.rsi ?? 50) < 30 ? 'bg-[#22C55E]' : 'bg-[#3B82F6]'}`}
                    style={{ width: `${Math.min(data.indicators.rsi ?? 0, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-[#475569]">
                  <span>0</span><span>30</span><span>70</span><span>100</span>
                </div>
              </div>
            )}

            {/* MACD */}
            {data.indicators.macd !== null && (
              <div className="glass-inner rounded-lg p-3">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">MACD</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">MACD</span>
                    <span className="text-xs font-mono text-[#3B82F6] font-semibold">{(data.indicators.macd ?? 0).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Sinyal</span>
                    <span className="text-xs font-mono text-[#F59E0B] font-semibold">{(data.indicators.macdSignal ?? 0).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Histogram</span>
                    <span className={`text-xs font-mono font-semibold ${(data.indicators.macdHistogram ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                      {(data.indicators.macdHistogram ?? 0).toFixed(3)}
                    </span>
                  </div>
                </div>
                <p className={`text-[10px] mt-2 font-medium ${(data.indicators.macdHistogram ?? 0) > 0 ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                  {(data.indicators.macdHistogram ?? 0) > 0 ? '↑ Yükseliş Sinyali' : '↓ Düşüş Sinyali'}
                </p>
              </div>
            )}

            {/* EMA Summary */}
            {(data.indicators.ema20 !== null || data.indicators.ema50 !== null) && (
              <div className="glass-inner rounded-lg p-3">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Hareketli Ortalamalar</p>
                <div className="space-y-1.5">
                  {data.indicators.ema20 !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">EMA 20</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-foreground">{formatCurrency(data.indicators.ema20 ?? 0)}</span>
                        <span className={`w-2 h-2 rounded-full ${data.price > (data.indicators.ema20 ?? 0) ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      </div>
                    </div>
                  )}
                  {data.indicators.ema50 !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">EMA 50</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-foreground">{formatCurrency(data.indicators.ema50 ?? 0)}</span>
                        <span className={`w-2 h-2 rounded-full ${data.price > (data.indicators.ema50 ?? 0) ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      </div>
                    </div>
                  )}
                  {data.indicators.ema200 !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">EMA 200</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-foreground">{formatCurrency(data.indicators.ema200 ?? 0)}</span>
                        <span className={`w-2 h-2 rounded-full ${data.price > (data.indicators.ema200 ?? 0) ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      </div>
                    </div>
                  )}
                </div>
                {data.indicators.ema20 !== null && data.indicators.ema50 !== null && (
                  <p className={`text-[10px] mt-2 font-medium ${
                    (data.indicators.ema20 ?? 0) > (data.indicators.ema50 ?? 0) ? 'text-[#22C55E]' : 'text-[#F87171]'
                  }`}>
                    {(data.indicators.ema20 ?? 0) > (data.indicators.ema50 ?? 0) ? '↑ Yükseliş Trendi' : '↓ Düşüş Trendi'}
                  </p>
                )}
              </div>
            )}

            {/* Bollinger Bands */}
            {data.indicators.bbUpper !== null && (
              <div className="glass-inner rounded-lg p-3">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Bollinger Bantları</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Üst Bant</span>
                    <span className="text-xs font-mono text-[#F59E0B]">{formatCurrency(data.indicators.bbUpper ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Orta</span>
                    <span className="text-xs font-mono text-foreground">{formatCurrency(data.indicators.bbMiddle ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Alt Bant</span>
                    <span className="text-xs font-mono text-[#F59E0B]">{formatCurrency(data.indicators.bbLower ?? 0)}</span>
                  </div>
                </div>
                <p className={`text-[10px] mt-2 font-medium ${
                  data.price > (data.indicators.bbUpper ?? 0) ? 'text-[#F87171]' : data.price < (data.indicators.bbLower ?? 0) ? 'text-[#22C55E]' : 'text-muted-foreground'
                }`}>
                  {data.price > (data.indicators.bbUpper ?? 0) ? 'Üst bant aşımı — aşırı alım' : data.price < (data.indicators.bbLower ?? 0) ? 'Alt bant altı — aşırı satım' : 'Bantlar içinde'}
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
