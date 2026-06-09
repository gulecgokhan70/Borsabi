'use client';
import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { toTradingViewSymbol } from '@/lib/constants';

interface PriceChartProps {
  symbol: string;
  period?: string;
  height?: string;
  color?: string;
  showPeriodSelector?: boolean;
}

export function PriceChart({ symbol, height = 'h-48' }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !symbol) return;
    const container = containerRef.current;
    container.innerHTML = '';
    setLoaded(false);
    setError(false);

    const tvSymbol = toTradingViewSymbol(symbol);

    try {
      // Create a unique wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'tradingview-widget-container';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';

      const widgetDiv = document.createElement('div');
      widgetDiv.className = 'tradingview-widget-container__widget';
      widgetDiv.style.width = '100%';
      widgetDiv.style.height = '100%';
      wrapper.appendChild(widgetDiv);

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        symbol: tvSymbol,
        width: '100%',
        height: '100%',
        locale: 'tr',
        dateRange: '1M',
        colorTheme: 'dark',
        isTransparent: true,
        autosize: true,
        largeChartUrl: '',
        noTimeScale: false,
      });

      script.onload = () => setLoaded(true);
      script.onerror = () => {
        setError(true);
        setLoaded(true);
      };

      wrapper.appendChild(script);
      container.appendChild(wrapper);

      // Fallback timeout
      const timer = setTimeout(() => setLoaded(true), 4000);
      return () => {
        clearTimeout(timer);
        container.innerHTML = '';
      };
    } catch (e: any) {
      console.error('TradingView widget error:', e);
      setError(true);
      setLoaded(true);
    }
  }, [symbol, height]);

  if (error) {
    return <div className={`${height} flex items-center justify-center text-xs text-[#94A3B8]`}>Grafik yüklenemedi</div>;
  }

  return (
    <div className={`${height} relative overflow-hidden rounded-lg`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
