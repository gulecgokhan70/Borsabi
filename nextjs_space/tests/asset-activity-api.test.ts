import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock('../lib/asset-activity', async original => ({ ...await original<any>(), readAssetActivity: vi.fn(), presentAssetActivity: vi.fn() }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { readAssetActivity, presentAssetActivity } from '../lib/asset-activity';
import { GET } from '../app/api/stock/[symbol]/activity/route';
const request = (symbol = 'A1CAP.IS') => GET(new Request('http://localhost/api/stock/A1CAP.IS/activity?userId=other'), { params: Promise.resolve({ symbol }) });
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.$transaction).mockImplementation(async fn => (fn as any)('snapshot'));
  vi.mocked(presentAssetActivity).mockResolvedValue({ open: [], closed: [], trades: [], moreClosed: false, moreTrades: false, valuationUnavailable: false });
});
it('only uses authenticated owner and disables caching of private responses', async () => {
  const r = await request(); expect(r.status).toBe(200);
  expect(readAssetActivity).toHaveBeenCalledWith('snapshot', 'owner', { symbol: 'A1CAP.IS', aliases: ['A1CAP.IS', 'A1CAP'], market: 'BIST' });
  expect(r.headers.get('cache-control')).toBe('private, no-store'); expect(r.headers.get('vary')).toBe('Cookie');
});
it('rejects missing identity and unsupported symbols before database reads', async () => {
  expect((await request('bad-symbol')).status).toBe(404);
  vi.mocked(getServerSession).mockResolvedValue({ user: {} }); expect((await request()).status).toBe(401);
  vi.mocked(getServerSession).mockResolvedValue(null); expect((await request()).status).toBe(401);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
