'use client';
import { Loader2, ArrowDown } from 'lucide-react';

export function PullRefreshIndicator({ pullDistance, refreshing }: { pullDistance: number; refreshing: boolean }) {
  if (pullDistance <= 0 && !refreshing) return null;
  const progress = Math.min(pullDistance / 80, 1);

  return (
    <div className="flex justify-center items-center transition-all" style={{ height: refreshing ? 48 : pullDistance, opacity: progress }}>
      {refreshing ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
      ) : (
        <ArrowDown className="w-5 h-5 text-muted-foreground transition-transform" style={{ transform: `rotate(${progress >= 1 ? 180 : 0}deg)` }} />
      )}
    </div>
  );
}
