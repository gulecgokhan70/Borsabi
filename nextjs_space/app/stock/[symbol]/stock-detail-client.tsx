'use client';
import { readStockAnalysis } from '@/lib/stock-analysis-stream';
import { aiHttpError } from '@/lib/ai-stream-client';
import { formatQuoteTime } from '@/lib/quote-metadata';
import { percentagePoints } from '@/lib/ux-metrics';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, TrendingUp, TrendingDown, Loader2, Activity, DollarSign, Volume2,
  ArrowUpDown, BarChart3, Shield, Target, Gauge, Layers, ChevronDown, ChevronUp,
  Info, Percent, Building2, LineChart, Newspaper, ExternalLink, Clock, Brain,
  Sparkles, AlertTriangle, CheckCircle, ArrowRight, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Bookmark, Bell, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatNumber, formatPercent, isIndexSymbol } from '@/lib/constants';
import { assetCurrency, tradableMarketType } from '@/lib/asset-display';
import { TradeModal } from '@/components/trade-modal';
import { useHaptic } from '@/hooks/use-haptic';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell
} from 'recharts';
import { StockAnalysisSheet } from '@/components/stock-analysis-sheet';
import { CandlestickChart, SlidersHorizontal } from 'lucide-react';
import { ChartSurface } from '@/components/chart-surface';
import { ChartDrawingToolbar, ChartDrawingOverlay, type DrawingTool } from '@/components/chart-drawing-tools';

interface OHLCData {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
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
  priceSource?: string | null;
  priceAsOf?: string | null;
  priceTimeKind?: 'candle' | 'quote';
  checkedAt?: string;
  marketOpen?: boolean | null;
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
  { label: '1G', value: '1d', interval: '5m', key: '1d-daily' },
  { label: '1H', value: '1w', interval: '1h', key: '1w' },
  { label: '1A', value: '1mo', interval: '1d', key: '1mo' },
  { label: '3A', value: '3mo', interval: '1d', key: '3mo' },
  { label: '6A', value: '6mo', interval: '1d', key: '6mo' },
  { label: '1Y', value: '1y', interval: '1d', key: '1y' },
  { label: '5Y', value: '5y', interval: '1wk', key: '5y' },
];

type ChartOverlay = 'ema' | 'sma' | 'none';
type ChartType = 'candle' | 'line';

const CandlestickShape = (props: any) => {
  const { x, width, payload, yDomain, plotHeight } = props;
  if (!payload || !payload.open || !payload.close || !payload.high || !payload.low) return null;

  const { open, close, high, low, isUp } = payload;
  const color = isUp ? '#22C55E' : '#EF4444';

  const pixelPerPrice = plotHeight / (yDomain[1] - yDomain[0]);
  const priceY = (price: number) => 5 + (yDomain[1] - price) * pixelPerPrice;
  const bodyTop = priceY(Math.max(open, close));
  const bodyBottom = priceY(Math.min(open, close));
  const barCenter = x + width / 2;
  const wickTopY = priceY(high);
  const wickBottomY = priceY(low);

  const candleWidth = Math.max(Math.min(width * 0.7, 12), 3);
  const wickWidth = Math.max(Math.min(width * 0.12, 2), 1);

  return (
    <g>
      <rect x={barCenter - wickWidth / 2} y={wickTopY} width={wickWidth} height={Math.max(bodyTop - wickTopY, 0)} fill={color} />
      <rect x={barCenter - wickWidth / 2} y={bodyBottom} width={wickWidth} height={Math.max(wickBottomY - bodyBottom, 0)} fill={color} />
      <rect x={barCenter - candleWidth / 2} y={bodyTop} width={candleWidth} height={Math.max(bodyBottom - bodyTop, 1)} fill={isUp ? color : color} fillOpacity={isUp ? 0.3 : 0.8} stroke={color} strokeWidth={1} rx={1} />
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
  const [periodKey, setPeriodKey] = useState('1d-daily');
  const [chartInterval, setChartInterval] = useState('5m');
  const isIntraday = ['1d', '2d', '5d'].includes(period) || ['5m', '15m', '30m', '1h', '4h'].includes(chartInterval);
  const [overlay, setOverlay] = useState<ChartOverlay>('ema');
  const [advancedChart, setAdvancedChart] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('line');
  const [fullChart, setFullChart] = useState(false);
  const [showBands, setShowBands] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [drawings, setDrawings] = useState<any[]>([]);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 380 });
  const [showFundamentals, setShowFundamentals] = useState(true);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [news, setNews] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisTime, setAnalysisTime] = useState<string | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setAnalysis(null); setAnalysisError(''); setAnalysisTime(null); setAnalysisLoading(false);
    return () => { analysisRequest.current?.abort(); analysisRequest.current = null; };
  }, [symbol]);
  const [showAllNews, setShowAllNews] = useState(false);
  const [showAllStats, setShowAllStats] = useState(false);
  const [newsLoading, setNewsLoading] = useState(true);
  // İnteraktif grafik: hover/touch noktasının verileri
  const [activePoint, setActivePoint] = useState<any>(null);
  const [tooltipChart, setTooltipChart] = useState<'price' | 'volume' | 'macd' | 'rsi' | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeChartInfo = useCallback(() => {
    if (tooltipTimer.current !== null) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = null;
    setTooltipChart(null);
    setActivePoint(null);
  }, []);
  const showChartInfo = useCallback((chart: 'price' | 'volume' | 'macd' | 'rsi') => {
    if (tooltipTimer.current !== null) clearTimeout(tooltipTimer.current);
    setTooltipChart(chart);
    if (chart !== 'price') setActivePoint(null);
    tooltipTimer.current = setTimeout(closeChartInfo, 3000);
  }, [closeChartInfo]);
  useEffect(() => {
    closeChartInfo();
    return () => { if (tooltipTimer.current !== null) clearTimeout(tooltipTimer.current); };
  }, [symbol, period, chartInterval, chartType, fullChart, showVolume, showMACD, showRSI, closeChartInfo]);


  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setSaved(false);
    setWatchlistLoading(true);
    fetch('/api/watchlist').then(r => r.ok ? r.json() : null).then(body => {
      if (!cancelled) setSaved((body?.data ?? []).some((item: any) => item.symbol === assetSymbol));
    }).catch(() => {}).finally(() => { if (!cancelled) setWatchlistLoading(false); });
    return () => { cancelled = true; };
  }, [assetSymbol]);
  async function toggleSaved() {
    if (savePending.current || watchlistLoading || !data) return;
    savePending.current = true;
    setSaving(true);
    try {
      const res = await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: assetSymbol, name: data.name, type: marketType || 'BIST' }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Liste güncellenemedi');
      setSaved(!!body.added);
    } catch { toast.error('İzleme listesi güncellenemedi. Tekrar deneyin.'); }
    finally { savePending.current = false; setSaving(false); }
  }
  async function shareStock() {
    const url = `${window.location.origin}/stock/${encodeURIComponent(assetSymbol)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${data?.shortName || symbol} · BorsaBi`, url });
      else { await navigator.clipboard.writeText(url); toast.success('Hisse bağlantısı kopyalandı'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast.error('Paylaşım açılamadı. Sayfa adresini tarayıcıdan kopyalayabilirsiniz.'); }
  }

  const chartRequest = useRef(0);
  const fetchData = useCallback(async () => {
    const requestId = ++chartRequest.current;
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}?period=${period}&interval=${chartInterval}`);
      const json = await res.json();
      // error alanı olmasa veya kısmi veri geldiyse setData yap
      if (requestId === chartRequest.current && json && json.symbol) setData(json);
    } catch (e: any) {
      console.error('Stock data error:', e);
    } finally {
      if (requestId === chartRequest.current) setLoading(false);
    }
  }, [symbol, period, chartInterval]);

  useEffect(() => {
    setLoading(true);
    setActivePoint(null); // Periyod değişince aktif nokta sıfırla
    setDrawings([]);
    const requestState = chartRequest;
    fetchData();
    const refreshMs = isIntraday ? 30000 : 60000;
    const interval = setInterval(fetchData, refreshMs);
    return () => { clearInterval(interval); requestState.current++; };
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
    if (!data || analysisRequest.current) return;
    const controller = new AbortController();
    analysisRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90_000);
    setAnalysisLoading(true);
    setAnalysisError('');
    setAnalysis(null); setAnalysisTime(null);
    try {
      const res = await fetch('/api/stock-analysis', {
        method: 'POST', signal: controller.signal,
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
      if (!res.ok) throw new Error(aiHttpError(res.status));
      const result = await readStockAnalysis(res);
      if (analysisRequest.current === controller && !controller.signal.aborted) {
        setAnalysis(result); setAnalysisTime(new Date().toISOString());
      }
    } catch (error) {
      if (analysisRequest.current === controller) setAnalysisError(controller.signal.aborted ? 'Analiz zamanında tamamlanamadı. Tekrar deneyebilirsiniz.' : error instanceof Error ? error.message : 'Analiz yapılamadı.');
    } finally {
      clearTimeout(timeout);
      if (analysisRequest.current === controller) { analysisRequest.current = null; setAnalysisLoading(false); }
    }
  }, [data, news, currencyCode]);

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
      rsi: d.rsi,
      sma20: d.sma20, sma50: d.sma50, sma200: d.sma200,
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
    return ohlcData;
  }, [data?.ohlc, isIntraday, period]);

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
    const indicatorValues = advancedChart ? chartData.flatMap(d => [...(overlay === 'ema' ? [d.ema20, d.ema50, d.ema200] : overlay === 'sma' ? [d.sma20, d.sma50, d.sma200] : []), ...(showBands ? [d.bbUpper, d.bbLower] : [])]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) : [];
    const reference = !advancedChart && period === '1d' && data && Number.isFinite(data.prevClose) && data.prevClose > 0 ? [data.prevClose] : [];
    const allVals = [...closes, ...highs, ...lows, ...indicatorValues, ...reference];
    const mn = Math.min(...allVals);
    const mx = Math.max(...allVals);
    const pad = Math.max((mx - mn) * 0.05, Math.abs(mx) * 0.001, 0.01);
    return [mn - pad, mx + pad];
  }, [chartData, advancedChart, overlay, showBands, data, period]);

  // The chart moves into a dialog portal in full screen, so observe each mounted node.
  const chartObserver = useRef<ResizeObserver | null>(null);
  const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
    chartObserver.current?.disconnect();
    chartObserver.current = null;
    if (!node) return;
    chartObserver.current = new ResizeObserver(entries => {
      for (const entry of entries) {
        setChartDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    chartObserver.current.observe(node);
  }, []);

  // Recharts mouse/touch event handler
  const handleChartMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload) {
      showChartInfo('price');
      setActivePoint(e.activePayload[0].payload);
      // Haptic feedback (throttled)
      const now = Date.now();
      if (now - lastHapticTs.current > 120) {
        haptic.light();
        lastHapticTs.current = now;
      }
    }
  }, [haptic, showChartInfo]);

  const handleChartMouseLeave = closeChartInfo;

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

  const openTrade = (side: 'BUY' | 'SELL') => {
    setFullChart(false); setAdvancedChart(false); setDrawingTool('none');
    setTradeSide(side); setTradeOpen(true);
  };
  const tradeActions = data && marketType ? <div className="max-w-3xl mx-auto">
    <p className="text-[10px] text-muted-foreground text-center mb-2">Sanal işlem · Gerçek para kullanılmaz</p>
    <div className="grid grid-cols-2 gap-3">
      <button disabled={!Number.isFinite(data.price) || data.price <= 0} onClick={() => openTrade('SELL')} className="min-h-[48px] rounded-full bg-[#514CF0] text-white text-lg font-semibold disabled:opacity-40">Sat</button>
      <button disabled={!Number.isFinite(data.price) || data.price <= 0} onClick={() => openTrade('BUY')} className="min-h-[48px] rounded-full bg-[#514CF0] text-white text-lg font-semibold disabled:opacity-40">Al</button>
    </div>
  </div> : null;
  const chartControls = <>
    <div className="min-w-0 flex-1 flex items-center justify-between gap-0.5" aria-label="Grafik dönemi">
      {PERIODS.filter(p => ['1d-daily', '1w', '1mo', '3mo', '1y', '5y'].includes(p.key)).map(p =>
        <button key={p.key} aria-pressed={periodKey === p.key} onClick={() => { setPeriod(p.value); setChartInterval(p.interval); setPeriodKey(p.key); }}
          className={`h-11 min-w-[30px] px-1 sm:px-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${periodKey === p.key ? 'bg-black/[0.05] dark:bg-white/10 text-foreground' : 'text-foreground hover:bg-black/[0.03] dark:hover:bg-white/5'}`}>{p.label}</button>)}
    </div>
    <button aria-label={chartType === 'line' ? 'Mum grafiğine geç' : 'Çizgi grafiğine geç'} aria-pressed={chartType === 'candle'} title={chartType === 'line' ? 'Mum grafiği' : 'Çizgi grafiği'} onClick={() => setChartType(chartType === 'line' ? 'candle' : 'line')} className="shrink-0 w-11 h-11 grid place-items-center text-emerald-500">{chartType === 'line' ? <CandlestickChart className="w-5 h-5" /> : <Activity className="w-5 h-5" />}</button>
  </>;

  return (
    <div className="stock-focus min-h-screen bg-white dark:bg-[#0d0d0d] text-foreground px-5 md:px-8 pb-28 space-y-7 max-w-5xl mx-auto">
      <header className="sticky top-0 lg:top-[60px] z-20 -mx-5 md:-mx-8 px-4 md:px-8 py-3 bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur flex items-center gap-3 border-b border-transparent">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/piyasalar"); }} aria-label="Geri dön" className="min-h-[44px] min-w-[44px] grid place-items-center"><ArrowLeft className="w-6 h-6" /></button>
        <div className="min-w-0 flex-1"><p className="font-semibold truncate">{data?.shortName || symbol}</p><p className="text-xs text-muted-foreground">{data?.price && Number.isFinite(data.price) ? fp(data.price) : loading ? 'Yükleniyor…' : 'Fiyat alınamadı'}</p></div>
        <button onClick={toggleSaved} disabled={saving || watchlistLoading || !data} aria-label={saved ? 'İzleme listesinden çıkar' : 'İzleme listesine ekle'} aria-pressed={saved} className="min-h-[44px] min-w-[44px] grid place-items-center disabled:opacity-50"><Bookmark className={`w-5 h-5 ${saved ? 'fill-current text-indigo-500' : ''}`} /></button>
        <Link href="/alerts" aria-label="Fiyat alarmları" className="min-h-[44px] min-w-[44px] grid place-items-center"><Bell className="w-5 h-5" /></Link>
        <button onClick={shareStock} aria-label="Hisseyi paylaş" className="min-h-[44px] min-w-[44px] grid place-items-center"><Share2 className="w-5 h-5" /></button>
      </header>
      {data ? <section aria-label="Hisse fiyatı" className="space-y-3">
        <h1 className="text-lg font-normal leading-snug">{data.name}</h1>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[40px] leading-tight sm:text-5xl font-semibold tracking-tight tabular-nums">{displayPrice > 0 && Number.isFinite(displayPrice) ? fp(displayPrice) : 'Fiyat alınamadı'}{isIndex && <span className="text-sm font-normal ml-2 text-muted-foreground">Puan</span>}</p>
          <p className={`text-xl font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>{displayChangePercent >= 0 ? '+' : '-'}%{Math.abs(displayChangePercent).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <p className={`text-sm ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>{displayChange >= 0 ? '+' : ''}{fp(displayChange)} <span className="text-muted-foreground">{displayDate || 'Günlük değişim'}</span></p>
      </section> : <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      {/* ===== PRICE CHART ===== */}
      <ChartSurface title={data?.shortName || symbol} subtitle={data?.price ? fp(data.price) : 'Alınamadı'} full={fullChart}
        onFullChange={value => { setFullChart(value); setAdvancedChart(value); setDrawingTool('none'); if (value) setChartType('candle'); }}
        controls={chartControls} footer={tradeActions}>
        {advancedChart && <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Teknik göstergeler">
            {(['ema', 'sma'] as const).map(kind => <button key={kind} aria-pressed={overlay === kind} onClick={() => setOverlay(overlay === kind ? 'none' : kind)} className={`shrink-0 min-h-[44px] px-3 rounded-lg text-sm font-medium ${overlay === kind ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-black/[0.03] dark:bg-white/5'}`}>{kind.toUpperCase()}</button>)}
            <button aria-pressed={showBands} onClick={() => setShowBands(!showBands)} className={`shrink-0 min-h-[44px] px-3 rounded-lg text-sm ${showBands ? 'bg-amber-500/10 text-amber-600' : 'bg-black/[0.03] dark:bg-white/5'}`}>Bollinger</button>
            {([{ label: 'Hacim', value: showVolume, set: setShowVolume }, { label: 'RSI', value: showRSI, set: setShowRSI }, { label: 'MACD', value: showMACD, set: setShowMACD }]).map(item => <button key={item.label} aria-pressed={item.value} onClick={() => item.set(!item.value)} className={`shrink-0 min-h-[44px] px-3 rounded-lg text-sm ${item.value ? 'bg-black/[0.06] dark:bg-white/10' : 'text-muted-foreground'}`}>{item.label}</button>)}
          </div>
          {overlay !== 'none' && <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">{[20, 50, 200].map((n, i) => <span key={n} className="shrink-0 rounded-md bg-black/[0.03] dark:bg-white/5 px-3 py-2 text-sm"><span style={{ color: ['#a855f7', '#84a817', '#0ea5e9'][i] }}>●</span> {overlay.toUpperCase()}({n})</span>)}</div>}
          <details className="text-sm text-muted-foreground"><summary className="min-h-[44px] flex items-center gap-2 cursor-pointer"><SlidersHorizontal className="w-4 h-4" /> Grafik araçları ve aralık</summary>
            <div className="space-y-3 py-2">
              <label className="flex items-center gap-3">Mum aralığı / dönem<select aria-label="Mum aralığı ve dönem" value={periodKey} onChange={e => { const p = PERIODS.find(item => item.key === e.target.value); if (p) { setPeriod(p.value); setChartInterval(p.interval); setPeriodKey(p.key); } }} className="min-h-[44px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-3">{PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}{p.key === '1d-daily' ? ' · Günlük görünüm' : ''}</option>)}</select></label>
              <ChartDrawingToolbar activeTool={drawingTool} onToolChange={setDrawingTool} onClear={() => setDrawings([])} onUndo={() => setDrawings(prev => prev.slice(0, -1))} drawingCount={drawings.length} magnetEnabled={magnetEnabled} onToggleMagnet={() => setMagnetEnabled(prev => !prev)} />
              <p className="text-xs leading-5">EMA: son fiyatlara ağırlık veren ortalama. SMA: basit fiyat ortalaması. RSI: fiyat hareketinin gücü. MACD: ortalamalar arasındaki fark. Bollinger: fiyatın ortalama çevresindeki değişim bantları.</p>
            </div>
          </details>
        </div>}

        {/* Main Price Chart */}
        <div ref={chartContainerRef} style={{ height: 'var(--chart-height, clamp(260px, 46dvh, 460px))', position: 'relative' }}>
          {chartData.length > 0 ? (
            <>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                onMouseMove={handleChartMouseMove}
                onMouseDown={handleChartMouseMove}
                onMouseUp={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}>

                {advancedChart && <CartesianGrid strokeDasharray="1 5" stroke="currentColor" opacity={0.18} />}
                <XAxis height={25} hide={!advancedChart} dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis orientation="right" hide={!advancedChart} domain={yDomain} allowDataOverflow tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={65}
                  tickFormatter={(v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} />
                <Tooltip active={tooltipChart === 'price' ? undefined : false} content={<PriceTooltip />} cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 3' }} />
                {!advancedChart && period === '1d' && data && Number.isFinite(data.prevClose) && data.prevClose > 0 && <ReferenceLine y={data.prevClose} stroke="#94a3b8" strokeDasharray="1 5" label={{ value: fp(data.prevClose), position: 'insideTopLeft', fill: '#64748b', fontSize: 11 }} />}

                {/* Bollinger Bands */}
                {advancedChart && showBands && (
                  <>
                    <Line type="monotone" dataKey="bbUpper" stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="bbLower" stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="bbMiddle" stroke="#F59E0B" strokeWidth={1} strokeOpacity={0.5} dot={false} />
                  </>
                )}

                {/* Price rendering: Candle or Line */}
                {chartType === 'candle' ? (
                  <Bar dataKey="candleBody" shape={<CandlestickShape yDomain={yDomain} plotHeight={chartDimensions.height - (advancedChart ? 30 : 5)} />} isAnimationActive={false}>
                    {chartData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isUp ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                ) : (
                  <Area type="linear" isAnimationActive={false} dataKey="close" stroke={chartPositive ? '#22C55E' : '#EF4444'} strokeWidth={2} dot={({ cx, cy, index }: any) => !advancedChart && index === chartData.length - 1 ? <g key="last-price"><circle cx={cx} cy={cy} r={12} fill={chartPositive ? '#22C55E' : '#EF4444'} opacity={0.12} /><circle cx={cx} cy={cy} r={3.5} fill={chartPositive ? '#22C55E' : '#EF4444'} /></g> : <g key={index} />} activeDot={tooltipChart === 'price' ? undefined : false}
                    fill={advancedChart ? (chartPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent'} />
                )}

                {advancedChart && overlay !== 'none' && [20, 50, 200].map((n, i) => <Line key={`${overlay}${n}`} type="linear" dataKey={`${overlay}${n}`} stroke={['#a855f7', '#84a817', '#0ea5e9'][i]} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />)}
              </ComposedChart>
            </ResponsiveContainer>
            {advancedChart && chartDimensions.width > 0 && (
              <ChartDrawingOverlay axisSide="right"
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
              <p className="text-xs text-muted-foreground">Seçili zaman aralığı için veri alınamadı. Başka bir aralık deneyebilirsiniz.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => { setPeriod('1y'); setChartInterval('1d'); setPeriodKey('1y'); }} className="min-h-[44px] text-blue-500 underline">1 yıllık grafiği göster</button>
                <button onClick={() => void fetchData()} className="min-h-[44px] text-blue-500 underline">Yeniden dene</button>
              </div>
            </div>
          )}
        </div>

        {advancedChart && overlay !== 'none' && <p className="text-xs text-muted-foreground" role="status">{[20, 50, 200].filter(n => !chartData.some(d => Number.isFinite(d[`${overlay}${n}` as 'ema20']))).map(n => `${overlay.toUpperCase()}${n}: en az ${n} mum geçmişi gerekli.`).join(' ')}</p>}
        {advancedChart && showBands && !chartData.some(d => Number.isFinite(d.bbMiddle)) && <p className="text-xs text-muted-foreground" role="status">Bollinger için en az 20 mum geçmişi gerekli.</p>}
        {/* Independent indicator panels share the same candle timeline. */}
        <div className={advancedChart ? "mt-3 space-y-4" : "hidden"}>
          {advancedChart && showVolume && chartData.length > 0 && (
            <div><h3 className="text-xs text-muted-foreground mb-2">Hacim</h3><div style={{ height: '72px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}
                  onMouseMove={() => showChartInfo('volume')} onMouseDown={() => showChartInfo('volume')} onMouseUp={() => showChartInfo('volume')} onMouseLeave={closeChartInfo}>
                  <XAxis dataKey="date" hide />
                  <YAxis orientation="right" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={65}
                    tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} />
                  <Tooltip active={tooltipChart === 'volume' ? undefined : false} contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '8px', fontSize: '11px', backdropFilter: 'blur(16px)' }}
                    formatter={(value: any) => [formatNumber(value), 'Hacim']} />
                  <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
                    {chartData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isUp ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div></div>
          )}
          {advancedChart && showRSI && <div className="border-t border-black/5 dark:border-white/10 pt-3"><h3 className="text-sm mb-2">RSI(14)</h3>
            {chartData.some(d => Number.isFinite(d.rsi)) ? <div style={{ height: 110 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} onMouseMove={() => showChartInfo('rsi')} onMouseDown={() => showChartInfo('rsi')} onMouseUp={() => showChartInfo('rsi')} onMouseLeave={closeChartInfo}>
              <CartesianGrid strokeDasharray="1 5" stroke="currentColor" opacity={0.15} /><XAxis dataKey="date" hide /><YAxis orientation="right" width={65} domain={[0, 100]} ticks={[0, 50, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10 }} />
              <ReferenceLine y={30} stroke="#F59E0B" strokeDasharray="2 3" /><ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="2 3" />
              <Tooltip active={tooltipChart === 'rsi' ? undefined : false} formatter={(value: any) => [Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 }), 'RSI']} contentStyle={{ backgroundColor: 'var(--tooltip-bg)', borderRadius: 12 }} />
              <Line dataKey="rsi" stroke="#e68a16" dot={false} activeDot={false} strokeWidth={1.5} isAnimationActive={false} />
            </ComposedChart></ResponsiveContainer></div> : <p role="status" className="text-xs text-muted-foreground py-4">RSI için en az 15 mum geçmişi gerekli.</p>}
          </div>}
          {advancedChart && showMACD && !chartData.some(d => Number.isFinite(d.macd)) && <p className="text-xs text-muted-foreground py-3" role="status">MACD için en az 34 mum geçmişi gerekli.</p>}
          {advancedChart && showMACD && chartData.some(d => Number.isFinite(d.macd)) && (
            <div><h3 className="text-sm mb-2">MACD(12,26,9)</h3><div style={{ height: '100px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}
                  onMouseMove={() => showChartInfo('macd')} onMouseDown={() => showChartInfo('macd')} onMouseUp={() => showChartInfo('macd')} onMouseLeave={closeChartInfo}>
                  <XAxis dataKey="date" hide />
                  <YAxis orientation="right" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip active={tooltipChart === 'macd' ? undefined : false} content={<MacdTooltip />} />
                  <ReferenceLine y={0} stroke="#334155" />
                  <Bar dataKey="macdHistogram" radius={[1, 1, 0, 0]}>
                    {chartData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={(entry.macdHistogram ?? 0) >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="macd" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="macdSignal" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div></div>
          )}
        </div>
      </ChartSurface>

      {data && <StockAnalysisSheet symbol={data.symbol} name={data.shortName} analysis={analysis} generatedAt={analysisTime} loading={analysisLoading} error={analysisError} onGenerate={fetchAnalysis} formatPrice={fp} />}

      {data && <details className="text-xs text-muted-foreground border-b border-black/10 dark:border-white/10 pb-4">
        <summary className="min-h-[44px] cursor-pointer">Fiyat zamanı: {formatQuoteTime(data.priceAsOf)} · Veri bilgisi</summary>
        <div className="space-y-2 pt-2"><p>Son fiyat kaynağı: {data.priceSource || 'Bilinmiyor'} · {data.priceTimeKind === 'candle' ? 'Mum zamanı' : 'Fiyat zamanı'}: {formatQuoteTime(data.priceAsOf)}</p><p>Son kontrol: {formatQuoteTime(data.checkedAt)}</p><p>Seans: {data.marketOpen === true ? 'Kaynağa göre açık' : data.marketOpen === false ? 'Kaynağa göre kapalı' : 'Doğrulanmadı'}. Veriler gecikmeli olabilir. Kontrol saati fiyatın zamanı değildir.</p>{activePoint && <p>Üstteki fiyat grafikte seçilen muma aittir.</p>}</div>
      </details>}
      {tradeActions && !fullChart && <div role="region" aria-label="Sanal işlem" className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{tradeActions}</div>}
      {/* ===== QUICK STATS ROW ===== */}
      {data && (
        <section aria-label="İstatistikler"><h2 className="text-2xl font-semibold mb-5">İstatistikler</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
          {[
            { label: 'Açılış', value: fp(data.open), icon: DollarSign, color: 'text-[#3B82F6]' },
            { label: 'Önceki Kapanış', value: fp(data.prevClose), icon: ArrowUpDown, color: 'text-muted-foreground' },
            { label: 'Gün Yüksek', value: fp(data.high), icon: TrendingUp, color: 'text-[#22C55E]' },
            { label: 'Gün Düşük', value: fp(data.low), icon: TrendingDown, color: 'text-[#F87171]' },
            ...(data.tavan ? [{ label: 'Tavan ↑', value: fp(data.tavan), icon: TrendingUp, color: 'text-[#22C55E]' }] : []),
            ...(data.taban ? [{ label: 'Taban', value: fp(data.taban), icon: TrendingDown, color: 'text-[#EF4444]' }] : []),
            { label: 'Hacim', value: formatNumber(data.volume), icon: Volume2, color: 'text-[#8B5CF6]' },
            { label: 'Ort. Hacim', value: formatNumber(data.indicators?.avgVolume ?? 0), icon: Activity, color: 'text-slate-400 dark:text-slate-500' },
          ].filter((_, i) => showAllStats || i < 4).map((item: any, i: number) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}
              className="py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-foreground font-semibold text-base tabular-nums">{item.value}</p>
            </motion.div>
          ))}
        </div><button aria-expanded={showAllStats} onClick={() => setShowAllStats(!showAllStats)} className="min-h-[44px] text-indigo-600 dark:text-indigo-400 font-medium mt-3">{showAllStats ? 'Daha az göster' : 'Daha fazla göster'}</button></section>
      )}

      <section aria-label="İlgili haberler" className="py-4">
        <div className="flex items-center justify-between gap-3 mb-5"><h2 className="text-2xl font-semibold">İlgili haberler</h2>{news.length > 3 && <button onClick={() => setShowAllNews(!showAllNews)} className="min-h-[44px] text-indigo-600 dark:text-indigo-400 font-medium text-sm">{showAllNews ? 'Daha az göster' : 'Tümünü gör'}</button>}</div>
        {newsLoading ? <p role="status" className="text-muted-foreground text-sm">Haberler yükleniyor…</p> : news.length === 0 ? <p className="text-muted-foreground text-sm">Bu varlık için güncel haber bulunamadı.</p> : <div className="space-y-7">{news.slice(0, showAllNews ? news.length : 3).map((item: any, index: number) => <a key={index} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
          <p className="text-sm text-muted-foreground mb-2">{item.source} · {item.dateVerified === false ? 'Yayın zamanı bilinmiyor' : formatQuoteTime(item.date)}</p>
          <div className="flex gap-4 items-start"><h3 className="text-lg leading-relaxed flex-1 group-hover:text-indigo-600">{item.title}</h3><ExternalLink className="w-4 h-4 mt-2 shrink-0 text-muted-foreground" /></div>
        </a>)}</div>}
      </section>

      <details className="border-t border-black/10 dark:border-white/10 pt-3"><summary className="min-h-[44px] cursor-pointer font-medium">Diğer veriler ve göstergeler</summary>
      {/* ===== 52 WEEK RANGE ===== */}
      {data && (data.fiftyTwoWeekHigh > 0 || data.fiftyTwoWeekLow > 0) && (() => {
        const distToHigh = data.fiftyTwoWeekHigh > 0 ? ((data.fiftyTwoWeekHigh - data.price) / data.price) * 100 : 0;
        const distToLow = data.fiftyTwoWeekLow > 0 ? ((data.price - data.fiftyTwoWeekLow) / data.fiftyTwoWeekLow) * 100 : 0;
        return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="py-6 border-t border-black/5 dark:border-white/10">
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
          className="py-6 border-t border-black/5 dark:border-white/10">
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
              {marketType === 'BIST' ? (
                <div className="glass-inner rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Serbest Dolaşım</p>
                  <p className="text-foreground font-bold font-mono">{percentagePoints(data.freeFloat) === null ? 'Veri doğrulanamadı' : `%${percentagePoints(data.freeFloat)!.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`}</p>
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
          className="py-6 border-t border-black/5 dark:border-white/10">
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
          className="py-6 border-t border-black/5 dark:border-white/10">
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


      </details>
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
