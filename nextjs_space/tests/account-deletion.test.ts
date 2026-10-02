import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: {} }));
vi.mock('../lib/account-deletion', () => ({ deleteOwnAccount: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn(() => ({ allowed: true })) }));
import { getServerSession } from 'next-auth';
import { deleteOwnAccount } from '../lib/account-deletion';
import { takeRequestSlot } from '../lib/request-limit';
import { RequestError } from '../lib/request-json';
import { DELETE } from '../app/api/account/route';
const req = (patch = {}, headers = {}) => new NextRequest('http://localhost/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ password: 'test-password', confirmation: 'HESABIMI SİL', ...patch }) });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } }); vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 }); vi.mocked(deleteOwnAccount).mockResolvedValue(); });
it('deletes only the signed-in owner after explicit confirmation', async () => {
  expect((await DELETE(req())).status).toBe(200);
  expect(deleteOwnAccount).toHaveBeenCalledWith(expect.anything(), 'owner', 'test-password');
});
it('rejects an injected owner, missing confirmation, missing auth, and cross-origin requests', async () => {
  expect((await DELETE(req({ userId: 'victim' }))).status).toBe(400);
  expect((await DELETE(req({ confirmation: '' }))).status).toBe(400);
  expect((await DELETE(req({}, { origin: 'https://evil.invalid' }))).status).toBe(403);
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await DELETE(req())).status).toBe(401);
  expect(deleteOwnAccount).not.toHaveBeenCalled();
});
it('limits password guesses and does not leak internal deletion errors', async () => {
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 60 });
  const limited = await DELETE(req()); expect(limited.status).toBe(429); expect(limited.headers.get('retry-after')).toBe('60');
  expect(deleteOwnAccount).not.toHaveBeenCalled();
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(deleteOwnAccount).mockRejectedValue(new RequestError('Şifreniz doğru değil.', 403));
  expect((await DELETE(req())).status).toBe(403);
  vi.mocked(deleteOwnAccount).mockRejectedValue(new Error('private database details'));
  const failed = await DELETE(req()); expect(failed.status).toBe(500); expect(await failed.text()).not.toContain('private');
});
