'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  category: string;
  sentiment?: string;
}

export function BreakingNewsBanner() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [minimized, setMinimized] = useState(false);

  const fetchBreaking = useCallback(async () => {
    try {
      const res = await fetch('/api/news?limit=30');
      const json = await res.json();
      // Filter for important/breaking news: sentiment-tagged or KAP
      const important = (json?.news ?? []).filter((n: NewsItem) =>
        n.sentiment === 'positive' || n.sentiment === 'negative' || n.category === 'kap'
      ).slice(0, 8);
      setNews(important);
    } catch (e) {
      // silent
    }
  }, []);

  useEffect(() => { fetchBreaking(); }, [fetchBreaking]);
  useEffect(() => {
    const iv = setInterval(fetchBreaking, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchBreaking]);

  // Auto-rotate
  useEffect(() => {
    if (news.length <= 1) return;
    const iv = setInterval(() => {
      setCurrentIdx(i => {
        let next = (i + 1) % news.length;
        // Skip dismissed
        let tries = 0;
        while (dismissed.has(news[next]?.title) && tries < news.length) {
          next = (next + 1) % news.length;
          tries++;
        }
        return next;
      });
    }, 6000);
    return () => clearInterval(iv);
  }, [news, dismissed]);

  const visibleNews = news.filter(n => !dismissed.has(n.title));
  if (visibleNews.length === 0 || minimized) {
    if (minimized && visibleNews.length > 0) {
      return (
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-20 right-4 lg:bottom-4 lg:right-4 z-[60] w-10 h-10 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg hover:bg-[#7C3AED] transition-colors"
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
      );
    }
    return null;
  }

  const current = news[currentIdx];
  if (!current || dismissed.has(current.title)) return null;

  const isKap = current.category === 'kap';
  const isPositive = current.sentiment === 'positive';
  const isNegative = current.sentiment === 'negative';

  const bgColor = isKap ? 'from-[#F59E0B]/95 to-[#D97706]/95' : isPositive ? 'from-[#22C55E]/95 to-[#16A34A]/95' : 'from-[#EF4444]/95 to-[#DC2626]/95';
  const Icon = isKap ? Shield : isPositive ? TrendingUp : TrendingDown;

  return (
    <AnimatePresence>
      <motion.div
        key={current.title}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className={`fixed bottom-20 left-4 right-4 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-[420px] z-[60] rounded-2xl bg-gradient-to-r ${bgColor} backdrop-blur-xl shadow-2xl`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
                  {isKap ? '📢 KAP Bildirimi' : isPositive ? '📈 Piyasa Yükseldi' : '📉 Piyasa Düştü'}
                </span>
                <span className="text-[10px] text-white/60">{current.source}</span>
              </div>
              <a href={current.url} target="_blank" rel="noopener noreferrer" className="block">
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{current.title}</p>
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setDismissed(prev => new Set(prev).add(current.title))}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/60 hover:text-white transition-colors text-[10px] font-bold"
              >
                −
              </button>
            </div>
          </div>
          {visibleNews.length > 1 && (
            <div className="flex gap-1 mt-2 justify-center">
              {visibleNews.slice(0, 8).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === visibleNews.indexOf(current) ? 'bg-white w-4' : 'bg-white/30'}`} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
