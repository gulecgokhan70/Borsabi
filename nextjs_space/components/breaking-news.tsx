'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Shield, AlertTriangle, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  category: string;
  sentiment?: string;
  importance?: number;
}

/* Benzersiz haber kimliği oluştur */
function newsKey(n: NewsItem): string {
  return n.title.toLowerCase().substring(0, 60);
}

/* localStorage ile gösterilen haberleri takip et */
const SEEN_KEY = 'bn_seen_news';
const SEEN_MAX = 50;

function getSeenNews(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markSeen(keys: string[]) {
  try {
    const existing = getSeenNews();
    for (const k of keys) existing.add(k);
    // Son 50 haber tut, eskileri temizle
    const arr = [...existing].slice(-SEEN_MAX);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch { /* silent */ }
}

export function BreakingNewsBanner() {
  const [breakingNews, setBreakingNews] = useState<NewsItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right'>('left');

  // Touch / swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  /* Arka planda önemli haber tara */
  const scanForBreaking = useCallback(async () => {
    try {
      const res = await fetch('/api/news?breaking=true&limit=10');
      const json = await res.json();
      const items: NewsItem[] = json?.news ?? [];

      if (items.length === 0) return;

      // Daha önce gösterilmemiş haberleri filtrele
      const seen = getSeenNews();
      const fresh = items.filter(n => !seen.has(newsKey(n)));

      if (fresh.length === 0) return;

      // Önem skoruna göre sırala (yüksekten düşüğe)
      fresh.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

      // En fazla 5 haber göster
      const toShow = fresh.slice(0, 5);

      // Gösterilen haberleri işaretle
      markSeen(toShow.map(newsKey));

      setBreakingNews(toShow);
      setCurrentIdx(0);
      setDismissed(false);
      setVisible(true);

      // 30 saniye sonra otomatik gizle
      setTimeout(() => {
        setVisible(false);
      }, 30000);
    } catch {
      // silent
    }
  }, []);

  // İlk tarama: 5 saniye sonra
  useEffect(() => {
    const t = setTimeout(scanForBreaking, 5000);
    return () => clearTimeout(t);
  }, [scanForBreaking]);

  // Periyodik tarama: her 5 dakikada
  useEffect(() => {
    const iv = setInterval(scanForBreaking, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [scanForBreaking]);

  // Swipe / navigasyon
  const goNext = useCallback(() => {
    if (breakingNews.length <= 1) return;
    setSwipeDir('left');
    setCurrentIdx(i => (i + 1) % breakingNews.length);
  }, [breakingNews.length]);

  const goPrev = useCallback(() => {
    if (breakingNews.length <= 1) return;
    setSwipeDir('right');
    setCurrentIdx(i => (i - 1 + breakingNews.length) % breakingNews.length);
  }, [breakingNews.length]);

  // Auto-rotate (8 sn)
  useEffect(() => {
    if (!visible || breakingNews.length <= 1) return;
    const iv = setInterval(goNext, 8000);
    return () => clearInterval(iv);
  }, [visible, breakingNews.length, goNext]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [goNext, goPrev]);

  // Kapatma
  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
  }, []);

  // Render
  if (!visible || dismissed || breakingNews.length === 0) return null;

  const current = breakingNews[currentIdx];
  if (!current) return null;

  const isKap = current.category === 'kap';
  const isPositive = current.sentiment === 'positive';
  const isNegative = current.sentiment === 'negative';

  const bgColor = isKap
    ? 'from-[#F59E0B]/95 to-[#D97706]/95'
    : isPositive
      ? 'from-[#22C55E]/95 to-[#16A34A]/95'
      : isNegative
        ? 'from-[#EF4444]/95 to-[#DC2626]/95'
        : 'from-[#8B5CF6]/95 to-[#6D28D9]/95';

  const Icon = isKap ? Shield : isPositive ? TrendingUp : isNegative ? TrendingDown : AlertTriangle;
  const label = isKap ? '📢 KAP' : isPositive ? '📈 Yükseliş' : isNegative ? '📉 Düşüş' : '🔔 Son Dakika';

  const variants = {
    enter: (dir: 'left' | 'right') => ({ x: dir === 'left' ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'left' | 'right') => ({ x: dir === 'left' ? -80 : 80, opacity: 0 }),
  };

  return (
    <div
      className="relative mb-4 w-full"
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
            {/* Üst kısım: ikon + başlık + kapat */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-[10px] text-white/60">{current.source}</span>
                  {(current.importance ?? 0) >= 7 && (
                    <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                      ÖNEMLİ
                    </span>
                  )}
                </div>
                <a href={current.url} target="_blank" rel="noopener noreferrer" className="block">
                  <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{current.title}</p>
                </a>
              </div>
              <button
                onClick={handleDismiss}
                aria-label="Haberi kapat"
                className="min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alt kısım: dot göstergeleri + swipe */}
            {breakingNews.length > 1 && (
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={goPrev}
                  className="hidden lg:flex w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <span className="text-[9px] text-white/40 mr-1 lg:hidden">◀</span>
                  {breakingNews.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentIdx ? 'bg-white w-4' : 'bg-white/30 w-1.5'
                      }`}
                    />
                  ))}
                  <span className="text-[9px] text-white/40 ml-1 lg:hidden">▶</span>
                </div>
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
