import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { scanCache: { findUnique: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() } } }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { GET, PUT } from '../app/api/event-radar/settings/route';
const req = (body: unknown, origin = 'http://localhost') => new NextRequest('http://localhost/api/event-radar/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { vi.stubEnv('NEXTAUTH_URL', 'http://localhost'); vi.resetAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } }); });
it('limits preference updates to the signed-in account and validates input and origin', async () => {
  expect((await PUT(req({ enabled: false, userId: 'victim' }))).status).toBe(400);
  expect((await PUT(req({ enabled: false }, 'https://evil.invalid'))).status).toBe(403);
  expect(prisma.scanCache.upsert).not.toHaveBeenCalled();
  expect((await PUT(req({ enabled: false }))).status).toBe(200);
  expect(prisma.scanCache.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'event-radar-disabled:owner' } }));
  expect((await PUT(req({ enabled: true }))).status).toBe(200);
  expect(prisma.scanCache.deleteMany).toHaveBeenCalledWith({ where: { id: 'event-radar-disabled:owner' } });
});
it('requires login and never presents a missing worker checkpoint as running', async () => {
  expect(await (await GET()).json()).toMatchObject({ enabled: true, running: false, checkedAt: null });
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET()).status).toBe(401); expect((await PUT(req({ enabled: false }))).status).toBe(401);
});
