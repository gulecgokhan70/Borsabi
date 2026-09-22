import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() }, aiContentReport: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() } } }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { takeRequestSlot } from '../lib/request-limit';
import { POST } from '../app/api/ai-reports/route';
import { GET, PATCH } from '../app/api/admin/ai-reports/route';
const body = { source: 'ai-assistant', content: 'Test response', reason: 'inaccurate', comment: 'Check this response' };
const req = (data: unknown, method = 'POST', headers = {}) => new NextRequest('http://localhost/api/ai-reports', { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner', role: 'admin' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'owner', role: 'user' } as any);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(prisma.aiContentReport.upsert).mockResolvedValue({ id: 'report-1' } as any);
});
it('associates reports with the authenticated account and deduplicates retry submissions', async () => {
  expect((await POST(req(body))).status).toBe(201);
  const create = vi.mocked(prisma.aiContentReport.upsert).mock.calls[0][0].create;
  expect(create).toMatchObject({ ...body, userId: 'owner', fingerprint: expect.any(String) });
  vi.mocked(prisma.aiContentReport.findUnique).mockResolvedValue({ id: 'report-1' } as any);
  expect(await (await POST(req(body))).json()).toEqual({ id: 'report-1', received: true });
  expect(prisma.aiContentReport.upsert).toHaveBeenCalledTimes(1); expect(takeRequestSlot).toHaveBeenCalledTimes(1);
});
it('rejects forged ownership, excessive bodies, invalid reasons and cross-origin submissions', async () => {
  for (const invalid of [{ ...body, userId: 'someone' }, { ...body, reason: 'invalid' }, { ...body, content: '' }, { ...body, content: 'a'.repeat(12001) }]) expect((await POST(req(invalid))).status).toBe(400);
  expect((await POST(req({ ...body, content: 'a'.repeat(60001) }, 'POST', { 'Content-Length': '1' }))).status).toBe(413);
  expect((await POST(req(body, 'POST', { Origin: 'https://elsewhere.invalid' }))).status).toBe(403);
  expect(prisma.aiContentReport.upsert).not.toHaveBeenCalled();
});
it('requires a current account and applies a per-account limit to new reports', async () => {
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 90 });
  const limited = await POST(req(body)); expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('90');
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null); expect((await POST(req(body))).status).toBe(401);
  vi.mocked(getServerSession).mockResolvedValue(null); expect((await POST(req(body))).status).toBe(401);
  expect(prisma.aiContentReport.upsert).not.toHaveBeenCalled();
});
it('ignores stale admin claims for both listing and resolving reports', async () => {
  expect((await GET(new NextRequest('http://localhost/api/admin/ai-reports'))).status).toBe(403);
  expect((await PATCH(req({ id: 'report-1', status: 'REVIEWED' }, 'PATCH'))).status).toBe(403);
  expect(prisma.aiContentReport.findMany).not.toHaveBeenCalled(); expect(prisma.aiContentReport.updateMany).not.toHaveBeenCalled();
});
it('lets a verified administrator paginate and resolve reports without exposing account details', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'admin' } as any);
  vi.mocked(prisma.aiContentReport.findMany).mockResolvedValue([]); vi.mocked(prisma.aiContentReport.count).mockResolvedValue(21);
  const response = await GET(new NextRequest('http://localhost/api/admin/ai-reports?page=2'));
  expect(await response.json()).toEqual({ reports: [], total: 21, page: 2 });
  const query = vi.mocked(prisma.aiContentReport.findMany).mock.calls[0][0]!;
  expect(query.skip).toBe(20); expect(query.take).toBe(20); expect(query.select).not.toHaveProperty('user');
  vi.mocked(prisma.aiContentReport.updateMany).mockResolvedValue({ count: 1 });
  expect((await PATCH(req({ id: 'report-1', status: 'REVIEWED' }, 'PATCH'))).status).toBe(200);
  expect(prisma.aiContentReport.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REVIEWED', reviewedAt: expect.any(Date) } }));
});
