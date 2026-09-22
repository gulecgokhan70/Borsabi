import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware';
import type { NextFetchEvent } from 'next/server';

const authenticate = withAuth({
  pages: {
    signIn: '/login',
  },
});

// A reverse proxy can expose its internal localhost origin to Next.js.
// Authentication still runs first; only its redirect origin is normalized.
export default async function middleware(request: NextRequestWithAuth, event: NextFetchEvent) {
  const response = await authenticate(request, event);
  const location = response?.headers.get('location');
  if (response && process.env.NODE_ENV === 'production' && location) {
    const target = new URL(location, 'https://borsabi.com');
    target.protocol = 'https:';
    target.host = 'borsabi.com';
    target.port = '';
    response.headers.set('location', target.toString());
  }
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/portfolio/:path*',
    '/ai-assistant/:path*',
    '/screening/:path*',
    '/trade-log/:path*',
    '/watchlist/:path*',
    '/day-trading/:path*',
    '/swing-trading/:path*',
    '/risk-center/:path*',
    '/academy/:path*',
    '/baslangic-rehberi/:path*',
    '/backtest/:path*',
    '/replay/:path*',
    '/algo-scan/:path*',
    '/strategy-builder/:path*',
    '/leaderboard/:path*',
    '/alerts/:path*',
    '/achievements/:path*',
    '/profile/:path*',
    '/stock/:path*',
    '/aksam-analizi/:path*',
    '/piyasalar/:path*',
    '/kesfet/:path*',
    '/brokers/:path*',
    '/social/:path*',
  ],
};
