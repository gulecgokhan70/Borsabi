'use client';

export function PageSkeleton({ title, cards = 4, rows = 5 }: { title?: string; cards?: number; rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 rounded-lg glass-inner" />
          <div className="h-4 w-64 rounded-lg glass-inner mt-2" />
        </div>
        <div className="h-9 w-9 rounded-lg glass-inner" />
      </div>

      {/* Cards */}
      <div className={`grid grid-cols-2 lg:grid-cols-${Math.min(cards, 4)} gap-4`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="h-4 w-20 rounded glass-inner" />
            <div className="h-7 w-28 rounded glass-inner" />
            <div className="h-3 w-16 rounded glass-inner" />
          </div>
        ))}
      </div>

      {/* List */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="w-10 h-10 rounded-xl glass-inner flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded glass-inner" />
              <div className="h-3 w-40 rounded glass-inner" />
            </div>
            <div className="h-5 w-20 rounded glass-inner" />
          </div>
        ))}
      </div>
    </div>
  );
}
