import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { update: vi.fn() } } }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { PUT } from '../app/api/profile/route';
const req = (body: unknown, headers = {}) => new NextRequest('http://localhost/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner', email: 'same@example.test' } }); vi.mocked(prisma.user.update).mockResolvedValue({ name: 'Gökhan', tier: 'free' } as any); });
it('blocks tier, role, balance and account-id injection without changing any field', async () => {
  for (const patch of [{ tier: 'pro' }, { tier: 'free' }, { role: 'admin' }, { balance: 999999 }, { userId: 'other' }, { name: 'Valid', tier: 'pro' }]) expect((await PUT(req(patch))).status).toBe(400);
  expect(prisma.user.update).not.toHaveBeenCalled();
});
it('preserves zero and decimal-comma commission and updates by immutable identity', async () => {
  for (const [value, expected] of [[0, 0], ['0,001', .001]]) {
    expect((await PUT(req({ commissionRate: value }))).status).toBe(200);
    expect(prisma.user.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'owner' }, data: { commissionRate: expected } }));
  }
});
it('rejects invalid fields, empty patches and cross-origin mutations', async () => {
  for (const patch of [{}, { name: ' ' }, { name: {} }, { commissionRate: -1 }, { commissionRate: .011 }, { commissionRate: '' }, { avatar: '<script>' }]) expect((await PUT(req(patch))).status).toBe(400);
  expect((await PUT(req({ name: 'Test' }, { origin: 'https://elsewhere.invalid' }))).status).toBe(403);
  expect((await PUT(req({ name: 'Test' }, { 'Content-Type': 'text/plain' }))).status).toBe(415);
  expect(prisma.user.update).not.toHaveBeenCalled();
});
it('requires an account id even when an old session contains an email', async () => {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'same@example.test' } });
  expect((await PUT(req({ name: 'Test' }))).status).toBe(401);
  expect(prisma.user.update).not.toHaveBeenCalled();
});
