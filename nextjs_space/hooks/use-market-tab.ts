'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisiblePoll } from './use-visible-poll';
export const marketGroups = { doviz: 'currencies', kripto: 'crypto', emtia: 'commodities', endeks: 'indices', bist: 'bistStocks' } as const;
export function useMarketTab(tab: keyof typeof marketGroups) {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const times = useRef<Record<string, number>>({});
  const active = useRef<AbortController | null>(null);
  const version = useRef(0);
  const group = marketGroups[tab];
  const fetchData = useCallback(async (parent?: AbortSignal) => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const current = ++version.current;
    const valid = () => current === version.current && !controller.signal.aborted;
    const cancel = () => controller.abort();
    parent?.addEventListener('abort', cancel, { once: true });
    if (parent?.aborted) { parent.removeEventListener('abort', cancel); return; }
    const timer = setTimeout(cancel, 20_000);
    setLoading(true); setError(''); setLastUpdate(times.current[group] ?? null);
    try {
      const response = await fetch(`/api/piyasalar?group=${group}`, { signal: controller.signal });
      if (!response.ok) throw new Error('unavailable');
      const result = await response.json();
      if (!valid()) return;
      if (!Array.isArray(result[group])) throw new Error('invalid');
      setData(previous => ({ ...previous, [group]: result[group] }));
      const checkedAt = Date.parse(result.checkedAt);
      times.current[group] = Number.isFinite(checkedAt) ? checkedAt : Date.now();
      setLastUpdate(times.current[group]); setLoading(false);
      if (result.unavailable) setError('Bazı varlıkların fiyatları alınamadı. Mevcut fiyatlar gösteriliyor.');
      // Optional sparklines follow prices and never delay the list becoming usable.
      if (group === 'indices') {
        try {
          const history = await fetch('/api/piyasalar?group=indices&history=1', { signal: controller.signal });
          if (history.ok) {
            const json = await history.json();
            if (valid() && Array.isArray(json.indices)) setData(previous => ({ ...previous,
              indices: (previous.indices ?? []).map(row => ({ ...row, sparkline: json.indices.find((i: any) => i.symbol === row.symbol)?.sparkline ?? row.sparkline })) }));
          }
        } catch { /* Optional history does not replace usable quotes with an error. */ }
      }
    } catch {
      if (current === version.current && !parent?.aborted) setError('Veriler alınamadı. Yeniden deneyebilirsin; varsa önceki değerler korunuyor.');
    } finally {
      clearTimeout(timer); parent?.removeEventListener('abort', cancel);
      if (current === version.current) setLoading(false);
    }
  }, [group]);
  const cancelRequests = useCallback(() => { version.current++; active.current?.abort(); }, []);
  useEffect(() => { void fetchData(); return cancelRequests; }, [fetchData, cancelRequests]);
  useVisiblePoll(fetchData, 30_000, 30_000);
  return { data, loading, error, lastUpdate, fetchData, group };
}
