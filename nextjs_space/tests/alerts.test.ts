import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: {
  appNotification: { findMany: vi.fn() }, scanCache: { findUnique: vi.fn() },
} }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { GET } from '../app/api/alerts/check/route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.appNotification.findMany).mockResolvedValue([]);
  vi.mocked(prisma.scanCache.findUnique).mockResolvedValue(null);
});
it('reads only the authenticated user events; polling no longer evaluates or writes orders', async () => {
  const r = await GET();
  expect(r.status).toBe(200);
  expect(prisma.appNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
  expect((await r.json()).automation.active).toBe(false);
});
it('requires a user session before exposing notifications', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(prisma.appNotification.findMany).not.toHaveBeenCalled();
});
