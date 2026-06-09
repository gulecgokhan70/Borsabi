'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface PriceChartProps {
  symbol: string;
  period?: string;
  height?: string;
  color?: string;
  showPeriodSelector?: boolean;
}

export function PriceChart({ symbol, height = 'h-48', color }: PriceChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [positive, setPositive] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&period=1mo`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const pts = (json?.data ?? []).map((d: any) => ({ close: d?.close ?? 0 })).filter((d: any) => d.close > 0);
        setData(pts);
        if (pts.length >= 2) {
          setPositive(pts[pts.length - 1].close >= pts[0].close);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol]);

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

  const chartColor = color || (positive ? '#22C55E' : '#EF4444');

  return (
    <div className={`${height} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={1.5} fill={`url(#grad-${symbol.replace(/[^a-zA-Z0-9]/g, '')})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
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
