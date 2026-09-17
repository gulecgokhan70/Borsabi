import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { scanCache: { findUnique: vi.fn(), upsert: vi.fn() } } }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { GET, PATCH } from '../app/api/onboarding/route';
const request = (body: unknown) => new NextRequest('http://localhost/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } }); });
it('existing accounts without a signup marker are not forced into a new tour', async () => {
  vi.mocked(prisma.scanCache.findUnique).mockResolvedValue(null);
  expect(await (await GET()).json()).toEqual({ step: 0, status: 'available' });
});
it('reads and saves progress only for the session owner', async () => {
  vi.mocked(prisma.scanCache.findUnique).mockResolvedValue({ data: JSON.stringify({ step: 2, status: 'skipped' }) } as any);
  expect(await (await GET()).json()).toEqual({ step: 2, status: 'skipped' });
  expect(prisma.scanCache.findUnique).toHaveBeenCalledWith({ where: { id: 'beginner-guide-v1:owner' } });
  expect((await PATCH(request({ step: 3, status: 'in_progress' }))).status).toBe(200);
  expect(prisma.scanCache.upsert).toHaveBeenCalledWith({ where: { id: 'beginner-guide-v1:owner' }, create: { id: 'beginner-guide-v1:owner', data: JSON.stringify({ step: 3, status: 'in_progress' }) }, update: { data: JSON.stringify({ step: 3, status: 'in_progress' }) } });
});
it('does not mark skipping as completion and validates step and ownership fields', async () => {
  for (const body of [{ step: 2, status: 'completed' }, { step: -1, status: 'skipped' }, { step: 5, status: 'in_progress' }, { step: 1, status: 'new' }, { step: 1, status: 'skipped', userId: 'other' }]) expect((await PATCH(request(body))).status).toBe(400);
  expect(prisma.scanCache.upsert).not.toHaveBeenCalled();
  expect((await PATCH(request({ step: 2, status: 'skipped' }))).status).toBe(200);
});
it('rejects signed-out requests and handles storage failures without leaking details', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET()).status).toBe(401); expect((await PATCH(request({}))).status).toBe(401);
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.scanCache.upsert).mockRejectedValue(new Error('secret database message'));
  const r = await PATCH(request({ step: 1, status: 'skipped' }));
  expect(r.status).toBe(503); expect(await r.text()).not.toContain('secret');
});

it('rejects cross-origin attempts to reset guide progress', async () => {
  const response = await PATCH(new NextRequest('http://localhost/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: JSON.stringify({ step: 0, status: 'skipped' }) }));
  expect(response.status).toBe(403); expect(prisma.scanCache.upsert).not.toHaveBeenCalled();
});
