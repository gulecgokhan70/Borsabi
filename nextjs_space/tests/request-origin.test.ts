import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readMutationJson } from '../lib/request-json';
afterEach(() => vi.unstubAllEnvs());
const req = (origin: string) => new NextRequest('http://127.0.0.1:3000/api/profile', { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{"name":"Test"}' });
it('accepts both configured canonical and www HTTPS origins behind the loopback proxy', async () => {
  vi.stubEnv('NEXTAUTH_URL', 'https://borsabi.com');
  expect(await readMutationJson(req('https://borsabi.com'))).toEqual({ name: 'Test' });
  expect(await readMutationJson(req('https://www.borsabi.com'))).toEqual({ name: 'Test' });
});
it('rejects other subdomains, lookalikes, ports, schemes and malformed origins', async () => {
  vi.stubEnv('NEXTAUTH_URL', 'https://borsabi.com');
  for (const origin of ['https://evil.borsabi.com', 'https://borsabi.com.evil.test', 'https://borsabi.com:8443', 'http://borsabi.com', 'null', 'https://borsabi.com/path']) await expect(readMutationJson(req(origin))).rejects.toMatchObject({ status: 403 });
});
