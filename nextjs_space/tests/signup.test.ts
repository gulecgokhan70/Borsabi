import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn(), create: vi.fn() } } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn() } }));
vi.mock('../lib/request-limit', () => ({ signupClientKey: () => 'test-ip', takeRequestSlot: vi.fn() }));
import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';
import { takeRequestSlot } from '../lib/request-limit';
import { POST } from '../app/api/signup/route';
const valid = { email: 'test@example.com', password: 'eight-or-more', name: 'Test' };
const request = (body: unknown) => new NextRequest('http://localhost/api/signup', {
  method: 'POST', body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
  vi.mocked(prisma.user.create).mockResolvedValue({ id: 'test-id', email: valid.email, name: 'Test' } as any);
});

it('rejects malformed email, weak password and invalid field types before touching storage', async () => {
  for (const body of [
    { ...valid, email: 'invalid' }, { ...valid, password: 'a' },
    { ...valid, password: 'ı'.repeat(37) }, { ...valid, password: 'a'.repeat(73) },
    { ...valid, name: 'n'.repeat(81) }, { ...valid, email: {} },
    { ...valid, password: null }, { ...valid, name: [] }, null,
  ]) expect((await POST(request(body))).status).toBe(400);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(bcrypt.hash).not.toHaveBeenCalled();
});

it('normalizes allowed fields, hashes the password and ignores client balance or membership', async () => {
  const response = await POST(request({ ...valid, email: ` ${valid.email} `, name: '   ', balance: 999999, membershipTier: 'pro' }));
  expect(response.status).toBe(200);
  expect(bcrypt.hash).toHaveBeenCalledWith(valid.password, 12);
  expect(prisma.user.create).toHaveBeenCalledWith({ data: {
    email: valid.email, password: 'hashed-password', name: 'Trader', balance: 100000, initialBalance: 100000,
  } });
  expect(await response.json()).not.toHaveProperty('password');
});

it('returns a readable duplicate response even if simultaneous requests race at the unique constraint', async () => {
  vi.mocked(prisma.user.create).mockRejectedValue({ code: 'P2002' });
  const response = await POST(request(valid));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain('zaten kayıtlı');
});

it('rejects broken JSON without processing a password', async () => {
  expect((await POST(new NextRequest('http://localhost/api/signup', { method: 'POST', body: '{' }))).status).toBe(400);
  expect(bcrypt.hash).not.toHaveBeenCalled();
});

it('limits signup attempts before hashing or database work', async () => {
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 900 });
  const response = await POST(request(valid));
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('900');
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(bcrypt.hash).not.toHaveBeenCalled();
});
