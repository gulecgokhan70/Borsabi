'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const AreaChartComp = dynamic(
  () => import('recharts').then((mod: any) => {
    const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } = mod;
    return function ChartInner({ data, color }: { data: any[]; color: string }) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data ?? []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={`grad-${color?.replace?.('#','')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px', fontSize: 11 }}
              labelStyle={{ color: '#94A3B8' }}
              itemStyle={{ color: color }}
            />
            <Area type="monotone" dataKey="close" stroke={color} fill={`url(#grad-${color?.replace?.('#','')})`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" /></div> }
);

interface PriceChartProps {
  symbol: string;
  period?: string;
  height?: string;
  color?: string;
}

export function PriceChart({ symbol, period = '1mo', height = 'h-48', color = '#3B82F6' }: PriceChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&period=${period}`)
      .then((r: any) => r?.json?.())
      .then((res: any) => {
        const quotes = (res?.data ?? []).map((q: any) => ({
          label: new Date(q?.date ?? '').toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
          close: q?.close ?? 0,
        }));
        setData(quotes);
      })
      .catch((e: any) => console.error('Chart data error:', e))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  if (loading) return <div className={`${height} flex items-center justify-center`}><Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" /></div>;
  if ((data?.length ?? 0) === 0) return <div className={`${height} flex items-center justify-center text-xs text-[#94A3B8]`}>Veri yok</div>;

  const first = data?.[0]?.close ?? 0;
  const last = data?.[(data?.length ?? 1) - 1]?.close ?? 0;
  const chartColor = last >= first ? '#22C55E' : '#EF4444';

  return (
    <div className={height}>
      <AreaChartComp data={data} color={color === '#3B82F6' ? chartColor : color} />
    </div>
  );
}
