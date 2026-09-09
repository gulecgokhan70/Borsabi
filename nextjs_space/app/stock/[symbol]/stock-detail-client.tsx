'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, TrendingUp, TrendingDown, Loader2, Activity, DollarSign, Volume2,
  ArrowUpDown, BarChart3, Shield, Target, Gauge, Layers, ChevronDown, ChevronUp,
  Info, Percent, Building2, LineChart, Newspaper, ExternalLink, Clock, Brain,
  Sparkles, AlertTriangle, CheckCircle, ArrowRight, RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatNumber, formatPercent, isIndexSymbol } from '@/lib/constants';
import { assetCurrency, tradableMarketType } from '@/lib/asset-display';
import { TradeModal } from '@/components/trade-modal';
import { useHaptic } from '@/hooks/use-haptic';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell
} from 'recharts';
import { ChartDrawingToolbar, ChartDrawingOverlay, type DrawingTool } from '@/components/chart-drawing-tools';

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
  supportResistance?: {
    supports: { price: number; strength: number }[];
    resistances: { price: number; strength: number }[];
  };
}

const PERIODS = [
  { label: '5dk', value: '1d', interval: '5m', key: '5m' },
  { label: '15dk', value: '2d', interval: '15m', key: '15m' },
  { label: '30dk', value: '5d', interval: '30m', key: '30m' },
  { label: '1sa', value: '5d', interval: '1h', key: '1h' },
  { label: '4sa', value: '1mo', interval: '4h', key: '4h' },
  { label: '1G', value: '3mo', interval: '1d', key: '1d-daily' },
  { label: '1H', value: '1w', interval: '1h', key: '1w' },
  { label: '1A', value: '1mo', interval: '1d', key: '1mo' },
  { label: '3A', value: '3mo', interval: '1d', key: '3mo' },
  { label: '6A', value: '6mo', interval: '1d', key: '6mo' },
  { label: '1Y', value: '1y', interval: '1d', key: '1y' },
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
  const haptic = useHaptic();
  const lastHapticTs = useRef(0);
  const [data, setData] = useState<StockData | null>(null);
  const assetSymbol = data?.symbol ?? symbol;
  const isIndex = isIndexSymbol(assetSymbol);
  const currencyCode = assetCurrency(assetSymbol, data?.currency);
  const marketType = tradableMarketType(assetSymbol);
  const fp = (v: number) => isIndex ? formatNumber(v) : formatCurrency(v, currencyCode);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1d');
  const [chartInterval, setChartInterval] = useState('5m');
  const isIntraday = ['1d', '2d', '5d'].includes(period) || ['5m', '15m', '30m', '1h', '4h'].includes(chartInterval);
  const [overlay, setOverlay] = useState<ChartOverlay>('ema');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [bottomIndicator, setBottomIndicator] = useState<BottomIndicator>('volume');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [drawings, setDrawings] = useState<any[]>([]);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 380 });
  const [showFundamentals, setShowFundamentals] = useState(true);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [news, setNews] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [insightTab, setInsightTab] = useState<'analysis' | 'news'>('analysis');
  const [newsLoading, setNewsLoading] = useState(true);
  // İnteraktif grafik: hover/touch noktasının verileri
  const [activePoint, setActivePoint] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}?period=${period}&interval=${chartInterval}`);
      const json = await res.json();
      // error alanı olmasa veya kısmi veri geldiyse setData yap
      if (json && json.symbol) setData(json);
    } catch (e: any) {
      console.error('Stock data error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, chartInterval]);

  useEffect(() => {
    setLoading(true);
    setActivePoint(null); // Periyod değişince aktif nokta sıfırla
    fetchData();
    const refreshMs = isIntraday ? 30000 : 60000;
    const interval = setInterval(fetchData, refreshMs);
    return () => clearInterval(interval);
  }, [fetchData, isIntraday]);

  // Fetch news for this symbol
  useEffect(() => {
    setNewsLoading(true);
    fetch(`/api/news?symbol=${encodeURIComponent(symbol)}&limit=10`)
      .then(r => r.json())
      .then(d => setNews(d?.news ?? []))
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [symbol]);

  const fetchAnalysis = useCallback(async () => {
    if (!data || analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisError('');
    setAnalysis(null);
    try {
      const res = await fetch('/api/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.symbol, name: data.name, price: data.price, currency: currencyCode,
          change: data.change, changePercent: data.changePercent,
          high: data.high, low: data.low, open: data.open, prevClose: data.prevClose,
          volume: data.volume, marketCap: data.marketCap,
          fiftyTwoWeekHigh: data.fiftyTwoWeekHigh, fiftyTwoWeekLow: data.fiftyTwoWeekLow,
          indicators: data.indicators, vwap: data.vwap, tavan: data.tavan, taban: data.taban,
          fk: data.fk, pddd: data.pddd, supportResistance: data.supportResistance,
          recentNews: news.slice(0, 8).map((n: any) => ({ title: n.title, sentiment: n.sentiment, source: n.source, category: n.category })),
        }),
      });
      if (!res.ok) throw new Error('Analiz isteği başarısız');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const d = line.slice(6);
            if (d === '[DONE]') return;
            try {
              const parsed = JSON.parse(d);
              if (parsed.status === 'completed' && parsed.result) {
                setAnalysis(parsed.result);
                return;
              } else if (parsed.status === 'error') {
                throw new Error(parsed.message || 'Analiz hatası');
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e: any) {
      setAnalysisError(e?.message || 'Analiz yapılamadı');
    } finally {
      setAnalysisLoading(false);
    }
  }, [data, news, analysisLoading, currencyCode]);

  // Data yüklenince otomatik analiz başlat
  const analysisTriggered = useRef(false);
  useEffect(() => {
    if (data && !analysis && !analysisLoading && !analysisTriggered.current) {
      analysisTriggered.current = true;
      // Haberlerin yüklenmesini biraz bekle
      const t = setTimeout(() => fetchAnalysis(), 500);
      return () => clearTimeout(t);
    }
  }, [data, analysis, analysisLoading, fetchAnalysis]);


  const chartData = useMemo(() => {
    const ohlcData = (data?.ohlc ?? []).map((d: OHLCData) => ({
      date: isIntraday
        ? (['1d'].includes(period)
          ? new Date(d.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : new Date(d.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))
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
      candleBody: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
      candleWick: [d.low, d.high],
      isUp: d.close >= d.open,
    }));
    // Son fiyat verisini grafik sonuna ekle (tüm zaman dilimlerinde güncel fiyat görünsün)
    if (data?.price && ohlcData.length > 0) {
      const lastEntry = ohlcData[ohlcData.length - 1];
      const nowLabel = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      const intraLabel = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const currentLabel = isIntraday ? intraLabel : nowLabel;
      // Sadece son veri noktasından farklıysa ekle
      if (lastEntry.date !== currentLabel && Math.abs(lastEntry.close - data.price) > 0.001) {
        ohlcData.push({
          date: currentLabel,
          open: lastEntry.close,
          high: Math.max(lastEntry.close, data.price),
          low: Math.min(lastEntry.close, data.price),
          close: data.price,
          volume: data.volume || 0,
          ema20: lastEntry.ema20,
          ema50: lastEntry.ema50,
          ema200: lastEntry.ema200,
          macd: lastEntry.macd,
          macdSignal: lastEntry.macdSignal,
          macdHistogram: lastEntry.macdHistogram,
          bbUpper: lastEntry.bbUpper,
          bbMiddle: lastEntry.bbMiddle,
          bbLower: lastEntry.bbLower,
          candleBody: [Math.min(lastEntry.close, data.price), Math.max(lastEntry.close, data.price)],
          candleWick: [Math.min(lastEntry.close, data.price), Math.max(lastEntry.close, data.price)],
          isUp: data.price >= lastEntry.close,
        });
      }
    }
    return ohlcData;
  }, [data?.ohlc, data?.price, data?.volume, isIntraday, period]);

  // Aktif nokta varsa o noktanın verisini göster, yoksa güncel fiyatı göster
  const firstClose = chartData.length > 0 ? chartData[0]?.close ?? 0 : 0;
  const displayPrice = activePoint ? activePoint.close : (data?.price ?? 0);
  const displayChange = activePoint
    ? (firstClose > 0 ? activePoint.close - firstClose : 0)
    : (data?.change ?? 0);
  const displayChangePercent = activePoint
    ? (firstClose > 0 ? ((activePoint.close - firstClose) / firstClose) * 100 : 0)
    : (data?.changePercent ?? 0);
  const displayDate = activePoint ? activePoint.date : null;
  const isPositive = displayChange >= 0;

  const chartPositive = activePoint
    ? (activePoint.close >= firstClose)
    : (chartData.length >= 2 ? (chartData[chartData.length - 1]?.close ?? 0) >= (chartData[0]?.close ?? 0) : true);

  // Chart Y domain for drawing tools
  const yDomain: [number, number] = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const closes = chartData.map((d: any) => d.close).filter(Boolean);
    const highs = chartData.map((d: any) => d.high).filter(Boolean);
    const lows = chartData.map((d: any) => d.low).filter(Boolean);
    const allVals = [...closes, ...highs, ...lows];
    const mn = Math.min(...allVals);
    const mx = Math.max(...allVals);
    const pad = (mx - mn) * 0.05;
    return [mn - pad, mx + pad];
  }, [chartData]);

  // Chart container dimensions for drawing overlay
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setChartDimensions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(chartContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Recharts mouse/touch event handler
  const handleChartMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload) {
      setActivePoint(e.activePayload[0].payload);
      // Haptic feedback (throttled)
      const now = Date.now();
      if (now - lastHapticTs.current > 120) {
        haptic.light();
        lastHapticTs.current = now;
      }
    }
  }, [haptic]);

  const handleChartMouseLeave = useCallback(() => {
    setActivePoint(null);
  }, []);

  // Calculate 52-week range position
  const range52Pct = data && data.fiftyTwoWeekHigh > data.fiftyTwoWeekLow
    ? ((data.price - data.fiftyTwoWeekLow) / (data.fiftyTwoWeekHigh - data.fiftyTwoWeekLow)) * 100
    : 50;

  const PriceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="rounded-lg p-3 shadow-xl text-xs border border-black/10 dark:border-white/10" style={{ background: 'var(--tooltip-bg, #fff)', backdropFilter: 'blur(16px)' }}>
        <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-500 dark:text-slate-400">Açılış:</span><span className="text-foreground font-mono">{fp(d.open)}</span>
          <span className="text-slate-500 dark:text-slate-400">Yüksek:</span><span className="text-foreground font-mono">{fp(d.high)}</span>
          <span className="text-slate-500 dark:text-slate-400">Düşük:</span><span className="text-foreground font-mono">{fp(d.low)}</span>
          <span className="text-slate-500 dark:text-slate-400">Kapanış:</span><span className={`font-mono font-semibold ${d.close >= d.open ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>{fp(d.close)}</span>
          <span className="text-slate-500 dark:text-slate-400">Hacim:</span><span className="text-foreground font-mono">{formatNumber(d.volume)}</span>
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
        <BarChart3 className="w-12 h-12 text-[#475569] mb-3" />
        <p className="text-muted-foreground mb-2 text-lg font-medium">Hisse verisi bulunamadı</p>
        <p className="text-sm text-[#475569] mb-4">Bu sembol için şu an veri alınamıyor</p>
        <button onClick={() => router.back()} className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors">Geri Dön</button>
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
                <span className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors duration-150 ${isPositive ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#EF4444]/20 text-[#F87171]'}`}>
                  {displayChangePercent >= 0 ? '+' : ''}{displayChangePercent.toFixed(2)}%
                </span>
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                {displayDate ? <span className="text-[#3B82F6] font-medium">{displayDate}</span> : data.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`text-3xl font-bold transition-colors duration-150 ${activePoint ? 'text-[#3B82F6]' : 'text-foreground'}`}>
                {fp(displayPrice)}
              </p>
              <p className={`text-sm font-medium transition-colors duration-150 ${isPositive ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
                {isIndex ? `${displayChangePercent >= 0 ? '+' : ''}${displayChangePercent.toFixed(2)}%` : `${displayChange >= 0 ? '+' : ''}${fp(displayChange)}`}
              </p>
            </div>
            {marketType && (
              <div className="flex flex-col gap-2">
                <button onClick={() => { setTradeSide('BUY'); setTradeOpen(true); }}
                  className="px-5 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Al
                </button>
                <button onClick={() => { setTradeSide('SELL'); setTradeOpen(true); }}
                  className="px-5 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626] transition-colors flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Sat
                </button>
              </div>
            )}
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
            <span className="text-xs text-muted-foreground">{isIndex ? 'Puan' : currencyCode}</span>
            <div className="flex glass-inner rounded-lg p-0.5">
              <button onClick={() => setChartType('candle')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${chartType === 'candle' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500 hover:text-muted-foreground'}`}>🕯️ Mum</button>
              <button onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${chartType === 'line' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 dark:text-slate-500 hover:text-muted-foreground'}`}>📈 Çizgi</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {PERIODS.map((p: any) => (
              <button key={p.key} onClick={() => { setPeriod(p.value); setChartInterval(p.interval); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${(period === p.value && chartInterval === p.interval) ? 'bg-[#3B82F6] text-white' : 'glass-inner text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overlay toggles */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setOverlay(overlay === 'ema' ? 'none' : 'ema')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              overlay === 'ema' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40' : 'glass-inner text-muted-foreground border border-transparent hover:text-foreground'
            }`}>EMA</button>
          <button onClick={() => setOverlay(overlay === 'bb' ? 'none' : 'bb')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              overlay === 'bb' ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40' : 'glass-inner text-muted-foreground border border-transparent hover:text-foreground'
            }`}>Bollinger</button>
          <span className="border-l border-black/[0.08] dark:border-white/[0.08] mx-1" />
          <button onClick={() => setBottomIndicator('volume')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              bottomIndicator === 'volume' ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40' : 'glass-inner text-muted-foreground border border-transparent hover:text-foreground'
            }`}>Hacim</button>
          <button onClick={() => setBottomIndicator('macd')}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
              bottomIndicator === 'macd' ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40' : 'glass-inner text-muted-foreground border border-transparent hover:text-foreground'
            }`}>MACD</button>
          <span className="border-l border-black/[0.08] dark:border-white/[0.08] mx-1" />
          <ChartDrawingToolbar activeTool={drawingTool} onToolChange={setDrawingTool}
            onClear={() => setDrawings([])} onUndo={() => setDrawings(prev => prev.slice(0, -1))} drawingCount={drawings.length}
            magnetEnabled={magnetEnabled} onToggleMagnet={() => setMagnetEnabled(prev => !prev)} />
        </div>

        {/* Main Price Chart */}
        <div ref={chartContainerRef} style={{ height: '380px', position: 'relative' }} onTouchEnd={() => setActivePoint(null)}>
          {chartData.length > 0 ? (
            <>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}>

                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={65}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(2)} />
                <Tooltip content={<PriceTooltip />} cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 3' }} />

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
            {chartDimensions.width > 0 && (
              <ChartDrawingOverlay
                chartHeight={chartDimensions.height}
                chartWidth={chartDimensions.width}
                yDomain={yDomain}
                activeTool={drawingTool}
                drawings={drawings}
                setDrawings={setDrawings}
                chartData={chartData}
                magnetEnabled={magnetEnabled}
              />
            )}
            </>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <BarChart3 className="w-10 h-10 text-[#475569]" />
              <p className="text-sm text-muted-foreground">Grafik verisi şu an mevcut değil</p>
              <p className="text-xs text-[#475569]">Bu hisse için geçmiş fiyat verisi alınamadı</p>
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
                  <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '8px', fontSize: '11px', backdropFilter: 'blur(16px)' }}
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

      {/* ===== AI ANALİZ & HABERLER ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl overflow-hidden">
        {/* Tab Header */}
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04]">
            <button
              onClick={() => { setInsightTab('analysis'); if (!analysis && !analysisLoading) fetchAnalysis(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                insightTab === 'analysis'
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Brain className="w-3.5 h-3.5" /> AI Analiz
            </button>
            <button
              onClick={() => setInsightTab('news')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                insightTab === 'news'
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              Haberler
              {news.length > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                insightTab === 'news' ? 'bg-white/20 text-white' : 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
              }`}>{news.length}</span>}
            </button>
          </div>
        </div>

        {/* ===== AI ANALİZ TAB ===== */}
        {insightTab === 'analysis' && (
          <div className="p-4">
            {/* Loading */}
            {analysisLoading && (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] animate-spin" />
                  <Brain className="w-5 h-5 text-[#8B5CF6] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-muted-foreground">Teknik göstergeler ve haberler analiz ediliyor...</p>
              </div>
            )}

            {/* Error */}
            {analysisError && !analysisLoading && (
              <div className="py-6 flex flex-col items-center gap-2">
                <AlertTriangle className="w-7 h-7 text-[#F59E0B]" />
                <p className="text-xs text-muted-foreground">{analysisError}</p>
                <button onClick={fetchAnalysis} className="text-xs text-[#8B5CF6] hover:underline mt-1">Tekrar Dene</button>
              </div>
            )}

            {/* No Analysis - CTA */}
            {!analysis && !analysisLoading && !analysisError && (
              <div className="py-6 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#6366F1]/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#8B5CF6]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Yapay Zekâ Analizi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Teknik göstergeleri ve haberleri analiz eder</p>
                </div>
                <button
                  onClick={fetchAnalysis}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white hover:opacity-90 transition-opacity shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Analiz Et
                </button>
              </div>
            )}

            {/* Analysis Result */}
            {analysis && !analysisLoading && (
              <div className="space-y-3">
                {/* Sinyal + Trend + Güven Row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`rounded-xl p-3 text-center ${
                    analysis.sinyal === 'AL' ? 'bg-[#22C55E]/10 border border-[#22C55E]/20' :
                    analysis.sinyal === 'SAT' ? 'bg-[#EF4444]/10 border border-[#EF4444]/20' :
                    'bg-[#F59E0B]/10 border border-[#F59E0B]/20'
                  }`}>
                    <p className="text-[10px] text-muted-foreground uppercase">Sinyal</p>
                    <p className={`text-lg font-bold ${
                      analysis.sinyal === 'AL' ? 'text-[#22C55E]' :
                      analysis.sinyal === 'SAT' ? 'text-[#EF4444]' :
                      'text-[#F59E0B]'
                    }`}>{analysis.sinyal}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${
                    analysis.trend === 'YUKARI' ? 'bg-[#22C55E]/10 border border-[#22C55E]/20' :
                    analysis.trend === 'AŞAĞI' ? 'bg-[#EF4444]/10 border border-[#EF4444]/20' :
                    'bg-[#6366F1]/10 border border-[#6366F1]/20'
                  }`}>
                    <p className="text-[10px] text-muted-foreground uppercase">Trend</p>
                    <div className="flex items-center justify-center gap-1">
                      {analysis.trend === 'YUKARI' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> :
                       analysis.trend === 'AŞAĞI' ? <TrendingDown className="w-4 h-4 text-[#EF4444]" /> :
                       <ArrowRight className="w-4 h-4 text-[#6366F1]" />}
                      <p className={`text-xs font-bold ${
                        analysis.trend === 'YUKARI' ? 'text-[#22C55E]' :
                        analysis.trend === 'AŞAĞI' ? 'text-[#EF4444]' :
                        'text-[#6366F1]'
                      }`}>{analysis.trend}</p>
                    </div>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${
                    (analysis.guven_skoru ?? 0) >= 70 ? 'bg-[#22C55E]/10 border border-[#22C55E]/20' :
                    (analysis.guven_skoru ?? 0) >= 40 ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/20' :
                    'bg-[#EF4444]/10 border border-[#EF4444]/20'
                  }`}>
                    <p className="text-[10px] text-muted-foreground uppercase">Güven</p>
                    <p className={`text-lg font-bold ${
                      (analysis.guven_skoru ?? 0) >= 70 ? 'text-[#22C55E]' :
                      (analysis.guven_skoru ?? 0) >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                    }`}>{analysis.guven_skoru ?? '-'}<span className="text-[10px] font-normal">/100</span></p>
                  </div>
                </div>

                {/* Genel Görünüm */}
                <div className="glass-inner rounded-xl p-3.5">
                  <p className="text-xs text-foreground leading-relaxed">{analysis.genel_gorunum}</p>
                </div>

                {/* Haber Etkisi */}
                {analysis.haber_etkisi && (typeof analysis.haber_etkisi === 'object' ? analysis.haber_etkisi.ozet : analysis.haber_etkisi) && (
                  <div className={`rounded-xl border p-3 ${
                    (analysis.haber_etkisi?.duygu || '') === 'OLUMLU' ? 'bg-[#22C55E]/5 border-[#22C55E]/15' :
                    (analysis.haber_etkisi?.duygu || '') === 'OLUMSUZ' ? 'bg-[#EF4444]/5 border-[#EF4444]/15' :
                    'bg-[#8B5CF6]/5 border-[#8B5CF6]/15'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Newspaper className={`w-3.5 h-3.5 ${
                        (analysis.haber_etkisi?.duygu || '') === 'OLUMLU' ? 'text-[#22C55E]' :
                        (analysis.haber_etkisi?.duygu || '') === 'OLUMSUZ' ? 'text-[#EF4444]' :
                        'text-[#8B5CF6]'
                      }`} />
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Haber Etkisi</p>
                      {analysis.haber_etkisi?.duygu && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          analysis.haber_etkisi.duygu === 'OLUMLU' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                          analysis.haber_etkisi.duygu === 'OLUMSUZ' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                          'bg-[#6366F1]/10 text-[#6366F1]'
                        }`}>{analysis.haber_etkisi.duygu}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground leading-relaxed">
                      {typeof analysis.haber_etkisi === 'string' ? analysis.haber_etkisi : analysis.haber_etkisi.ozet}
                    </p>
                    {analysis.haber_etkisi?.onemli_gelismeler?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {analysis.haber_etkisi.onemli_gelismeler.map((g: string, i: number) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-[#8B5CF6] text-[10px] mt-0.5">▸</span>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{g}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Teknik Analiz 4'lü Grid */}
                {analysis.teknik_analiz && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[{
                      title: 'Trend', text: analysis.teknik_analiz.trend_analizi,
                      icon: <TrendingUp className="w-3.5 h-3.5" />, color: '#6366F1'
                    }, {
                      title: 'Momentum', text: analysis.teknik_analiz.momentum,
                      icon: <Activity className="w-3.5 h-3.5" />, color: '#F59E0B'
                    }, {
                      title: 'Hacim', text: analysis.teknik_analiz.hacim_analizi,
                      icon: <BarChart3 className="w-3.5 h-3.5" />, color: '#22C55E'
                    }, {
                      title: 'Destek/Direnç', text: analysis.teknik_analiz.destek_direnc,
                      icon: <Layers className="w-3.5 h-3.5" />, color: '#8B5CF6'
                    }].map((item, i) => (
                      <div key={i} className="glass-inner rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: item.color + '15', color: item.color }}>
                            {item.icon}
                          </div>
                          <h4 className="text-[11px] font-semibold text-foreground">{item.title}</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Önemli Seviyeler + Strateji yan yana */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Önemli Seviyeler */}
                  {analysis.onemli_seviyeler && (
                    <div className="glass-inner rounded-xl p-3">
                      <h4 className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-[#F59E0B]" /> Seviyeler
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[{ label: 'Destek 1', value: analysis.onemli_seviyeler.destek1, color: '#22C55E' },
                          { label: 'Destek 2', value: analysis.onemli_seviyeler.destek2, color: '#16A34A' },
                          { label: 'Direnç 1', value: analysis.onemli_seviyeler.direnc1, color: '#EF4444' },
                          { label: 'Direnç 2', value: analysis.onemli_seviyeler.direnc2, color: '#DC2626' },
                        ].filter(s => s.value).map((s, i) => (
                          <div key={i} className="text-center p-1.5 rounded-lg" style={{ backgroundColor: s.color + '08', border: `1px solid ${s.color}15` }}>
                            <p className="text-[9px] text-muted-foreground">{s.label}</p>
                            <p className="text-xs font-bold" style={{ color: s.color }}>{typeof s.value === 'number' ? fp(s.value) : s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strateji */}
                  {analysis.strateji && (
                    <div className="glass-inner rounded-xl p-3">
                      <h4 className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5 text-[#8B5CF6]" /> Strateji
                      </h4>
                      <div className="space-y-1.5">
                        {analysis.strateji.kisa_vade && (
                          <div className="p-2 rounded-lg bg-[#6366F1]/5 border border-[#6366F1]/10">
                            <p className="text-[9px] font-medium text-[#6366F1] uppercase">Kısa Vade</p>
                            <p className="text-[11px] text-foreground leading-relaxed mt-0.5">{analysis.strateji.kisa_vade}</p>
                          </div>
                        )}
                        {analysis.strateji.orta_vade && (
                          <div className="p-2 rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/10">
                            <p className="text-[9px] font-medium text-[#8B5CF6] uppercase">Orta Vade</p>
                            <p className="text-[11px] text-foreground leading-relaxed mt-0.5">{analysis.strateji.orta_vade}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Riskler */}
                {analysis.riskler?.length > 0 && (
                  <div className="glass-inner rounded-xl p-3">
                    <h4 className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" /> Riskler
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.riskler.map((risk: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/10 text-muted-foreground">
                          ⚠️ {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Yenile butonu */}
                <div className="flex justify-center pt-1">
                  <button
                    onClick={fetchAnalysis}
                    disabled={analysisLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Analizi Yenile
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== HABERLER TAB ===== */}
        {insightTab === 'news' && (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06] max-h-[400px] overflow-y-auto">
            {newsLoading ? (
              <div className="px-5 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6] mx-auto" /></div>
            ) : news.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                {symbol.endsWith('.IS') ? 'Bu hisse için güncel haber veya KAP bildirimi bulunamadı' : 'Güncel haber bulunamadı'}
              </div>
            ) : (
              news.map((n: any, i: number) => (
                <a
                  key={i}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    n.category === 'kap' ? 'bg-[#F59E0B]/10' : n.sentiment === 'positive' ? 'bg-[#22C55E]/10' : n.sentiment === 'negative' ? 'bg-[#EF4444]/10' : 'bg-[#8B5CF6]/10'
                  }`}>
                    {n.category === 'kap' ? <Shield className="w-4 h-4 text-[#F59E0B]" /> :
                     n.sentiment === 'positive' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> :
                     n.sentiment === 'negative' ? <TrendingDown className="w-4 h-4 text-[#EF4444]" /> :
                     <Newspaper className="w-4 h-4 text-[#8B5CF6]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{n.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        n.category === 'kap' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                      }`}>{n.source}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {n.date ? new Date(n.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                </a>
              ))
            )}
          </div>
        )}
      </motion.div>

      {/* ===== QUICK STATS ROW ===== */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Açılış', value: fp(data.open), icon: DollarSign, color: 'text-[#3B82F6]' },
            { label: 'Önceki Kapanış', value: fp(data.prevClose), icon: ArrowUpDown, color: 'text-muted-foreground' },
            { label: 'Gün Yüksek', value: fp(data.high), icon: TrendingUp, color: 'text-[#22C55E]' },
            { label: 'Gün Düşük', value: fp(data.low), icon: TrendingDown, color: 'text-[#F87171]' },
            ...(data.tavan ? [{ label: 'Tavan ↑', value: fp(data.tavan), icon: TrendingUp, color: 'text-[#22C55E]' }] : []),
            ...(data.taban ? [{ label: 'Taban', value: fp(data.taban), icon: TrendingDown, color: 'text-[#EF4444]' }] : []),
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
      {data && (data.fiftyTwoWeekHigh > 0 || data.fiftyTwoWeekLow > 0) && (() => {
        const distToHigh = data.fiftyTwoWeekHigh > 0 ? ((data.fiftyTwoWeekHigh - data.price) / data.price) * 100 : 0;
        const distToLow = data.fiftyTwoWeekLow > 0 ? ((data.price - data.fiftyTwoWeekLow) / data.fiftyTwoWeekLow) * 100 : 0;
        return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card rounded-xl p-4">
          <h3 className="text-foreground font-semibold text-sm mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#3B82F6]" /> 52 Haftalık Aralık
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#F87171] font-mono whitespace-nowrap">{fp(data.fiftyTwoWeekLow)}</span>
            <div className="flex-1 relative h-3 glass-inner rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#EF4444]/30 via-[#F59E0B]/30 to-[#22C55E]/30 rounded-full" />
              <div className="absolute top-0 h-full w-2 bg-white dark:bg-white rounded-full shadow-lg shadow-black/20 dark:shadow-white/20 transition-all"
                style={{ left: `calc(${Math.min(Math.max(range52Pct, 2), 98)}% - 4px)` }} />
            </div>
            <span className="text-xs text-[#22C55E] font-mono whitespace-nowrap">{fp(data.fiftyTwoWeekHigh)}</span>
          </div>
          {/* Distance indicators */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="glass-inner rounded-lg p-2.5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Zirveye Uzaklık</p>
                <p className="text-sm font-bold text-[#22C55E] font-mono">%{distToHigh.toFixed(1)}</p>
              </div>
            </div>
            <div className="glass-inner rounded-lg p-2.5 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#F87171] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Dipten Uzaklık</p>
                <p className="text-sm font-bold text-[#F87171] font-mono">%{distToLow.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </motion.div>
        );
      })()}

      {/* ===== FUNDAMENTALS (NATIVE QUOTE CURRENCY) ===== */}
      {data && (data.vwap || data.fk || data.pddd || data.marketCap) && (
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
                  <p className="text-foreground font-bold font-mono">{fp(data.vwap)}</p>
                  <p className={`text-[10px] mt-0.5 ${data.price > data.vwap ? 'text-[#22C55E]' : 'text-[#F87171]'}`}>
                    Fiyat {data.price > data.vwap ? 'üstünde ↑' : 'altında ↓'}
                  </p>
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
                    {data.marketCap >= 1e9 ? `${formatCurrency(data.marketCap / 1e9, currencyCode)} Milyar` : `${formatCurrency(data.marketCap / 1e6, currencyCode)} Milyon`}
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
                        <span className="text-xs font-mono text-foreground">{fp(data.indicators.ema20 ?? 0)}</span>
                        <span className={`w-2 h-2 rounded-full ${data.price > (data.indicators.ema20 ?? 0) ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      </div>
                    </div>
                  )}
                  {data.indicators.ema50 !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">EMA 50</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-foreground">{fp(data.indicators.ema50 ?? 0)}</span>
                        <span className={`w-2 h-2 rounded-full ${data.price > (data.indicators.ema50 ?? 0) ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      </div>
                    </div>
                  )}
                  {data.indicators.ema200 !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">EMA 200</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-foreground">{fp(data.indicators.ema200 ?? 0)}</span>
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
                    <span className="text-xs font-mono text-[#F59E0B]">{fp(data.indicators.bbUpper ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Orta</span>
                    <span className="text-xs font-mono text-foreground">{fp(data.indicators.bbMiddle ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Alt Bant</span>
                    <span className="text-xs font-mono text-[#F59E0B]">{fp(data.indicators.bbLower ?? 0)}</span>
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

      {/* Destek / Direnç Seviyeleri */}
      {data && data.supportResistance && (data.supportResistance.supports.length > 0 || data.supportResistance.resistances.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-4">
          <h3 className="text-foreground font-semibold text-sm mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#8B5CF6]" /> Destek & Direnç Seviyeleri
          </h3>

          {/* Visual price ladder */}
          <div className="relative">
            {/* Direnç Seviyeleri */}
            {data.supportResistance.resistances.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-[10px] text-[#EF4444] font-semibold uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Direnç Seviyeleri
                </p>
                {data.supportResistance.resistances.map((r: any, i: number) => {
                  const distPercent = ((r.price - data.price) / data.price * 100);
                  return (
                    <div key={`r-${i}`} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-bold text-[#EF4444]">{fp(r.price)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#EF4444]/70 font-mono">+{distPercent.toFixed(2)}%</span>
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <div key={si} className={`w-1.5 h-3 rounded-sm ${
                                  si < r.strength ? 'bg-[#EF4444]' : 'bg-[#EF4444]/15'
                                }`} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#EF4444]/10">
                          <div className="h-full rounded-full bg-[#EF4444]/40" style={{ width: `${Math.min(100, Math.max(20, (r.strength / 5) * 100))}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mevcut Fiyat */}
            <div className="flex items-center gap-3 py-2.5 my-1 border-y border-dashed border-[#3B82F6]/30">
              <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
              <span className="text-sm font-bold font-mono text-[#3B82F6]">{fp(data.price)}</span>
              <span className="text-[10px] text-muted-foreground">Mevcut Fiyat</span>
            </div>

            {/* Destek Seviyeleri */}
            {data.supportResistance.supports.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-[10px] text-[#22C55E] font-semibold uppercase tracking-wide flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Destek Seviyeleri
                </p>
                {data.supportResistance.supports.map((s: any, i: number) => {
                  const distPercent = ((data.price - s.price) / data.price * 100);
                  return (
                    <div key={`s-${i}`} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-bold text-[#22C55E]">{fp(s.price)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#22C55E]/70 font-mono">-{distPercent.toFixed(2)}%</span>
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <div key={si} className={`w-1.5 h-3 rounded-sm ${
                                  si < s.strength ? 'bg-[#22C55E]' : 'bg-[#22C55E]/15'
                                }`} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#22C55E]/10">
                          <div className="h-full rounded-full bg-[#22C55E]/40" style={{ width: `${Math.min(100, Math.max(20, (s.strength / 5) * 100))}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-3">Pivot Points, Swing High/Low ve Fibonacci Retracement bazlı hesaplama. Güç: birden fazla kaynağın aynı seviyeyi onaylaması.</p>
        </motion.div>
      )}


      {/* Disclaimer */}
      <p className="text-center text-xs text-[#475569] py-4">
        ⚠️ Bu sayfa yalnızca eğitim amaçlıdır. Yatırım tavsiyesi değildir.
      </p>

      {/* Trade Modal */}
      {data && marketType && (() => {
        // Destek/direnç seviyelerinden otomatik SL/TP hesapla
        const supports = data.supportResistance?.supports ?? [];
        const resistances = data.supportResistance?.resistances ?? [];
        // En yakın destek (fiyatın altında) -> Stop Loss
        const nearestSupport = supports.filter((s: any) => s.price < data.price).sort((a: any, b: any) => b.price - a.price)[0];
        // En yakın direnç (fiyatın üstünde) -> Take Profit
        const nearestResistance = resistances.filter((r: any) => r.price > data.price).sort((a: any, b: any) => a.price - b.price)[0];
        const autoSL = nearestSupport ? nearestSupport.price : undefined;
        const autoTP = nearestResistance ? nearestResistance.price : undefined;
        return (
          <TradeModal
            isOpen={tradeOpen}
            onClose={() => setTradeOpen(false)}
            symbol={data.symbol}
            name={data.name}
            price={data.price}
            marketType={marketType}
            side={tradeSide}
            initialStopLoss={autoSL}
            initialTakeProfit={autoTP}
            onSuccess={() => fetchData()}
          />
        );
      })()}
    </div>
  );
}
