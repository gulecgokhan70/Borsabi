'use client';

export function BorsaBiLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="logoChart" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22C55E" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logoBg)" />
      {/* Uptrend chart line */}
      <polyline
        points="12,44 22,38 30,42 38,28 46,32 52,18"
        fill="none"
        stroke="url(#logoChart)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow tip */}
      <polyline
        points="47,16 52,18 50,23"
        fill="none"
        stroke="#22C55E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bi text */}
      <text
        x="32"
        y="56"
        textAnchor="middle"
        fontFamily="system-ui,-apple-system,sans-serif"
        fontWeight="800"
        fontSize="14"
        fill="white"
        opacity="0.95"
      >
        Bi
      </text>
    </svg>
  );
}

export function BorsaBiLogoFull({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BorsaBiLogo size={size} />
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          Borsa<span className="text-[#3B82F6]">Bi</span>
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Trader</p>
      </div>
    </div>
  );
}
