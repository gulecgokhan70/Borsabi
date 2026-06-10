'use client';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/constants';

export default function EquityChart({ equity, positive }: { equity: number[]; positive: boolean }) {
  const data = equity.map((v: number, i: number) => ({ day: i, value: v }));
  const color = positive ? '#22C55E' : '#EF4444';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
          formatter={(val: any) => [formatCurrency(val), 'Sermaye']}
          labelFormatter={(l: any) => `Gün ${l}`}
        />
        <Area type="monotone" dataKey="value" stroke={color} fill="url(#eqGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
