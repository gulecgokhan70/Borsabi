'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BIST_INDICES, BIST_TOP_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { useVisiblePoll } from './use-visible-poll';
const urls = {
  indices: `/api/market?symbols=${BIST_INDICES.map(i => i.symbol).join(',')}`,
  stocks: `/api/market?symbols=${BIST_TOP_STOCKS.slice(0, 20).map(s => s.symbol).join(',')}`,
  cryptos: `/api/market?symbols=${CRYPTO_ASSETS.slice(0, 8).map(c => c.symbol).join(',')}`,
  portfolio: '/api/portfolio',
};
type Section = keyof typeof urls;
const emptyPending = { indices: false, stocks: false, cryptos: false, portfolio: false };
export function useDashboardData() {
  const [data, setData] = useState<{ indices: any[]; stocks: any[]; cryptos: any[]; portfolio: any; bistOpen: boolean | null }>({ indices: [], stocks: [], cryptos: [], portfolio: null, bistOpen: null });
  const [pending, setPending] = useState({ indices: true, stocks: true, cryptos: true, portfolio: true });
  const [errors, setErrors] = useState<Partial<Record<Section, boolean>>>({});
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const active = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => () => { version.current++; active.current?.abort(); }, []);
  const fetchData = useCallback(async (parent?: AbortSignal) => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const current = ++version.current;
    const abort = () => controller.abort();
    parent?.addEventListener('abort', abort, { once: true });
    if (parent?.aborted) controller.abort();
    const valid = () => version.current === current && !controller.signal.aborted;
    if (!valid()) { parent?.removeEventListener('abort', abort); return; }
    setPending({ indices: true, stocks: true, cryptos: true, portfolio: true });
    // Commit each section as soon as it arrives. A slow quote cannot hold the balance hostage.
    await Promise.all((Object.keys(urls) as Section[]).map(async key => {
      const request = new AbortController();
      const cancel = () => request.abort();
      controller.signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(cancel, 20_000);
      try {
        const response = await fetch(urls[key], { signal: request.signal });
        if (!response.ok) throw new Error('unavailable');
        const result = await response.json();
        if (!valid() || request.signal.aborted) return;
        if (key !== 'portfolio' && !Array.isArray(result.data)) throw new Error('invalid market response');
        setData(previous => ({ ...previous, [key]: key === 'portfolio' ? result : result.data,
          ...(key === 'indices' ? { bistOpen: result.marketOpen ?? null } : {}) }));
        setErrors(previous => ({ ...previous, [key]: false }));
        setLastUpdate(Date.now());
      } catch {
        if (valid()) setErrors(previous => ({ ...previous, [key]: true }));
      } finally {
        clearTimeout(timer); controller.signal.removeEventListener('abort', cancel);
        if (valid()) setPending(previous => ({ ...previous, [key]: false }));
      }
    }));
    parent?.removeEventListener('abort', abort);
    if (version.current === current && controller.signal.aborted) setPending(emptyPending);
  }, []);
  useVisiblePoll(fetchData, 30_000);
  return { ...data, pending, loading: Object.values(pending).some(Boolean), lastUpdate, fetchData,
    refreshError: Object.values(errors).some(Boolean) ? 'Bazı bölümler yüklenemedi. Varsa önceki değerler korunuyor; yeniden deneyebilirsin.' : '' };
}
