'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { useHaptic } from '@/hooks/use-haptic';
import { chartPerformance } from '@/lib/chart-performance';

interface PriceChartProps {
  symbol: string;
  period?: string;
  height?: string;
  color?: string;
  showPeriodSelector?: boolean;
  refreshKey?: string;
}

export function PriceChart({ symbol, period = '1mo', height = 'h-48', color, refreshKey }: PriceChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [percent, setPercent] = useState<number | null>(null);
  const haptic = useHaptic();
  const lastHapticTs = useRef(0);
  const handleTouch = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticTs.current > 150) { haptic.light(); lastHapticTs.current = now; }
  }, [haptic]);

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    setLoading(true);
    setData([]);
    setPercent(null);
    setDirection('neutral');

    const url = period === '1d' ? `/api/stock/${encodeURIComponent(symbol)}?period=1d&interval=5m`
      : `/api/market/history?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`;
    fetch(url, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Grafik alınamadı'); return r.json(); })
      .then(json => {
        if (controller.signal.aborted) return;
        const pts = (period === '1d' ? json?.ohlc ?? [] : json?.data ?? [])
          .filter((d: any) => Number.isFinite(d?.close) && d.close > 0).map((d: any) => ({ close: d.close, date: d.date }));
        setData(pts);
        const result = chartPerformance(pts, period, symbol.endsWith('.IS'), json?.chartPreviousClose);
        setDirection(result.direction);
        setPercent(result.percent);
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [symbol, period, refreshKey]);

  if (loading) {
    return (
      <div className={`${height} flex items-center justify-center`}>
        <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  if (data.length < 2) {
    return <div className={`${height} flex items-center justify-center text-xs text-slate-400 dark:text-slate-500`}>Veri yok</div>;
  }

  const chartColor = color || (direction === 'up' ? '#22C55E' : direction === 'down' ? '#EF4444' : '#94A3B8');

  return (
    <div>
    <p className="text-[10px] text-muted-foreground mb-1">{period === '1d' ? 'Günlük grafik · 5 dakikalık mumlar' : period === '1mo' ? '1 aylık grafik' : `${period} grafik`}{percent !== null ? ` · ${percent >= 0 ? '+' : ''}%${percent.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : ' · Referans fiyat yok'}</p>
    <div className={`${height} w-full`} onTouchMove={handleTouch}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area type="linear" dataKey="close" stroke={chartColor} strokeWidth={1.5} fill={`url(#grad-${symbol.replace(/[^a-zA-Z0-9]/g, '')})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}

// Mini sparkline for inline use in lists
export function MiniSparkline({ symbol, width = 80, height = 32 }: { symbol: string; width?: number; height?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [positive, setPositive] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&period=1w`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const pts = (json?.data ?? []).map((d: any) => ({ close: d?.close ?? 0 })).filter((d: any) => d.close > 0);
        setData(pts);
        if (pts.length >= 2) {
          setPositive(pts[pts.length - 1].close >= pts[0].close);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [symbol]);

  if (data.length < 2) return null;

  const chartColor = positive ? '#22C55E' : '#EF4444';

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={1} fill="transparent" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
