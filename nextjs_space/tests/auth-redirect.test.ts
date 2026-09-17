import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextFetchEvent } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { encode } from 'next-auth/jwt';
import middleware from '@/middleware';

const secret = 'test-only-auth-redirect-secret';
const event = {} as NextFetchEvent;
afterEach(() => vi.unstubAllEnvs());
function setup(mode: string) {
  vi.stubEnv('NODE_ENV', mode);
  vi.stubEnv('NEXTAUTH_SECRET', secret);
  vi.stubEnv('NEXTAUTH_URL', 'https://borsabi.com');
}
describe('authentication behind reverse proxy', () => {
  it('keeps unauthenticated production redirects on the public host', async () => {
    setup('production');
    for (const origin of ['https://localhost:3000', 'https://untrusted.example']) {
      const request = new NextRequest(origin + '/dashboard?view=positions') as NextRequestWithAuth;
      const response = await middleware(request, event);
      expect(response?.status).toBe(307);
      const target = new URL(response!.headers.get('location')!);
      expect(target.origin).toBe('https://borsabi.com');
      expect(target.pathname).toBe('/login');
      expect(target.searchParams.get('callbackUrl')).toBe('/dashboard?view=positions');
    }
  });
  it('retains local redirects in development', async () => {
    setup('development');
    const request = new NextRequest('http://localhost:3000/dashboard') as NextRequestWithAuth;
    const response = await middleware(request, event);
    expect(new URL(response!.headers.get('location')!).origin).toBe('http://localhost:3000');
  });
  it('still permits a valid authenticated session', async () => {
    setup('production');
    const token = await encode({ token: { id: 'test-user', sub: 'test-user' }, secret });
    const request = new NextRequest('https://localhost:3000/dashboard', {
      headers: { cookie: `__Secure-next-auth.session-token=${token}` },
    }) as NextRequestWithAuth;
    const response = await middleware(request, event);
    expect(response?.headers.get('location')).toBeUndefined();
  });
});
