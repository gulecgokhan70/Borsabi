// BIST Varlıkları - tüm hisseler, fonlar ve en likit hisseler
export { BIST_ALL_STOCKS, BIST_TOP_STOCKS, BIST_FUNDS, BIST_ALL_ASSETS } from './bist-data';
export type { BistAsset } from './bist-data';

// Geriye dönük uyumluluk: BIST_STOCKS = tüm hisseler
import { BIST_ALL_STOCKS as _ALL } from './bist-data';
export const BIST_STOCKS = _ALL;

// BIST Index
export const BIST_INDICES = [
  { symbol: 'XU100.IS', name: 'BIST 100' },
  { symbol: 'XU030.IS', name: 'BIST 30' },
];

// Crypto
export const CRYPTO_ASSETS = [
  { symbol: 'BTC-USD', name: 'Bitcoin', shortName: 'BTC' },
  { symbol: 'ETH-USD', name: 'Ethereum', shortName: 'ETH' },
  { symbol: 'BNB-USD', name: 'BNB', shortName: 'BNB' },
  { symbol: 'SOL-USD', name: 'Solana', shortName: 'SOL' },
  { symbol: 'XRP-USD', name: 'XRP', shortName: 'XRP' },
  { symbol: 'ADA-USD', name: 'Cardano', shortName: 'ADA' },
  { symbol: 'AVAX-USD', name: 'Avalanche', shortName: 'AVAX' },
  { symbol: 'DOGE-USD', name: 'Dogecoin', shortName: 'DOGE' },
  { symbol: 'DOT-USD', name: 'Polkadot', shortName: 'DOT' },
  { symbol: 'MATIC-USD', name: 'Polygon', shortName: 'MATIC' },
  { symbol: 'LINK-USD', name: 'Chainlink', shortName: 'LINK' },
  { symbol: 'UNI-USD', name: 'Uniswap', shortName: 'UNI' },
  { symbol: 'ATOM-USD', name: 'Cosmos', shortName: 'ATOM' },
  { symbol: 'LTC-USD', name: 'Litecoin', shortName: 'LTC' },
  { symbol: 'NEAR-USD', name: 'NEAR Protocol', shortName: 'NEAR' },
  { symbol: 'APT-USD', name: 'Aptos', shortName: 'APT' },
  { symbol: 'ARB-USD', name: 'Arbitrum', shortName: 'ARB' },
  { symbol: 'OP-USD', name: 'Optimism', shortName: 'OP' },
  { symbol: 'FIL-USD', name: 'Filecoin', shortName: 'FIL' },
  { symbol: 'SHIB-USD', name: 'Shiba Inu', shortName: 'SHIB' },
];

// Yahoo -> TradingView sembol dönüşümü
export function toTradingViewSymbol(yahooSymbol: string): string {
  if (yahooSymbol.endsWith('.IS')) {
    return `BIST:${yahooSymbol.replace('.IS', '')}`;
  }
  if (yahooSymbol.endsWith('-USD')) {
    const base = yahooSymbol.replace('-USD', '');
    return `BINANCE:${base}USDT`;
  }
  // Index mapping
  if (yahooSymbol === 'XU100.IS') return 'BIST:XU100';
  if (yahooSymbol === 'XU030.IS') return 'BIST:XU030';
  return yahooSymbol;
}

export const COMMISSION_RATE = 0.002; // 0.2%
export const MAX_RISK_PER_TRADE = 0.01; // 1%
export const DAILY_LOSS_LIMIT = 0.03; // 3%

export const SCORE_LABELS: Record<string, { label: string; color: string }> = {
  elite: { label: 'Elite', color: '#22C55E' },
  strong: { label: 'Güçlü', color: '#3B82F6' },
  watch: { label: 'İzleme', color: '#F59E0B' },
  weak: { label: 'Zayıf', color: '#EF4444' },
};

export function getScoreCategory(score: number) {
  if (score >= 90) return 'elite';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'watch';
  return 'weak';
}

export function formatCurrency(value: number | null | undefined, currency = 'TRY'): string {
  const v = value ?? 0;
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
  }
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  return (value ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(value: number | null | undefined): string {
  const v = value ?? 0;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
