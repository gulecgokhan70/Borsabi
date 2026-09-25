import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: {} }));
vi.mock('../lib/bot-lab/shared-portfolio', async importOriginal => ({ ...await importOriginal<any>(), configureBudget: vi.fn(), budgetView: vi.fn() }));
import { getServerSession } from 'next-auth';
import { configureBudget, budgetView } from '../lib/bot-lab/shared-portfolio';
import { GET, POST } from '../app/api/bot-lab/budget/route';
const input = { capital: 10000, allocationPercent: 30, perTradePercent: 10, version: 0 };
const site = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
const req = (body: unknown, origin = site) => new NextRequest(site + '/api/bot-lab/budget', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } }); vi.mocked(configureBudget).mockResolvedValue({} as any); vi.mocked(budgetView).mockResolvedValue({} as any); });
it('uses authenticated owner and rejects user ID injection', async () => {
  expect((await POST(req(input))).status).toBe(200);
  expect(configureBudget).toHaveBeenCalledWith({}, 'owner', input);
  expect((await POST(req({ ...input, userId: 'someone-else' }))).status).toBe(400);
});
it('rejects unauthenticated and cross-origin mutations', async () => {
  expect((await POST(req(input, 'https://evil.test'))).status).toBe(403);
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await POST(req(input))).status).toBe(401); expect((await GET()).status).toBe(401);
  expect(configureBudget).not.toHaveBeenCalled();
});
