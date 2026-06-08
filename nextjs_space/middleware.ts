import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

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
    '/backtest/:path*',
  ],
};
