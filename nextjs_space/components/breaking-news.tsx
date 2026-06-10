'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Shield, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [ready, setReady] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right'>('left');

  // Touch / swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  // Check sessionStorage on mount — only show once per session
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('bn_dismissed')) {
        setSessionDismissed(true);
        return;
      }
    } catch { /* silent */ }
    const t = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const dismissSession = useCallback(() => {
    setSessionDismissed(true);
    try { sessionStorage.setItem('bn_dismissed', '1'); } catch { /* silent */ }
  }, []);

  const fetchBreaking = useCallback(async () => {
    try {
      const res = await fetch('/api/news?limit=30');
      const json = await res.json();
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

  const visibleNews = news.filter(n => !dismissed.has(n.title));

  const goNext = useCallback(() => {
    if (visibleNews.length <= 1) return;
    setSwipeDir('left');
    setCurrentIdx(i => {
      let next = (i + 1) % news.length;
      let tries = 0;
      while (dismissed.has(news[next]?.title) && tries < news.length) {
        next = (next + 1) % news.length;
        tries++;
      }
      return next;
    });
  }, [news, dismissed, visibleNews.length]);

  const goPrev = useCallback(() => {
    if (visibleNews.length <= 1) return;
    setSwipeDir('right');
    setCurrentIdx(i => {
      let prev = (i - 1 + news.length) % news.length;
      let tries = 0;
      while (dismissed.has(news[prev]?.title) && tries < news.length) {
        prev = (prev - 1 + news.length) % news.length;
        tries++;
      }
      return prev;
    });
  }, [news, dismissed, visibleNews.length]);

  // Auto-rotate
  useEffect(() => {
    if (visibleNews.length <= 1) return;
    const iv = setInterval(goNext, 6000);
    return () => clearInterval(iv);
  }, [visibleNews.length, goNext]);

  // Touch handlers for swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement > 40px and more horizontal than vertical
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiping.current = true;
      if (dx < 0) goNext(); // swipe left → next
      else goPrev(); // swipe right → prev
    }
  }, [goNext, goPrev]);

  // Don't render if session-dismissed or not ready yet
  if (sessionDismissed || !ready) return null;

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
    if (visibleNews.length === 0 && news.length > 0) dismissSession();
    return null;
  }

  const current = news[currentIdx];
  if (!current || dismissed.has(current.title)) return null;

  const isKap = current.category === 'kap';
  const isPositive = current.sentiment === 'positive';

  const bgColor = isKap ? 'from-[#F59E0B]/95 to-[#D97706]/95' : isPositive ? 'from-[#22C55E]/95 to-[#16A34A]/95' : 'from-[#EF4444]/95 to-[#DC2626]/95';
  const Icon = isKap ? Shield : isPositive ? TrendingUp : TrendingDown;
  const currentVisibleIdx = visibleNews.indexOf(current);

  const variants = {
    enter: (dir: 'left' | 'right') => ({ x: dir === 'left' ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'left' | 'right') => ({ x: dir === 'left' ? -80 : 80, opacity: 0 }),
  };

  return (
    <div
      className="fixed bottom-20 left-4 right-4 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-[420px] z-[60]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence mode="wait" custom={swipeDir}>
        <motion.div
          key={current.title}
          custom={swipeDir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className={`rounded-2xl bg-gradient-to-r ${bgColor} backdrop-blur-xl shadow-2xl overflow-hidden`}
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
                  onClick={() => { setMinimized(true); dismissSession(); }}
                  className="p-1 rounded-lg hover:bg-white/20 text-white/60 hover:text-white transition-colors text-[10px] font-bold"
                >
                  −
                </button>
              </div>
            </div>
            {/* Bottom bar: dots + arrows */}
            {visibleNews.length > 1 && (
              <div className="flex items-center justify-between mt-3">
                {/* Prev arrow (desktop) */}
                <button
                  onClick={goPrev}
                  className="hidden lg:flex w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                </button>
                {/* Swipe hint on mobile, dots everywhere */}
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <span className="text-[9px] text-white/40 mr-1 lg:hidden">◀</span>
                  {visibleNews.slice(0, 8).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentVisibleIdx ? 'bg-white w-4' : 'bg-white/30 w-1.5'
                      }`}
                    />
                  ))}
                  <span className="text-[9px] text-white/40 ml-1 lg:hidden">▶</span>
                </div>
                {/* Next arrow (desktop) */}
                <button
                  onClick={goNext}
                  className="hidden lg:flex w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
