import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { prisma } from '../lib/db';
import { authOptions } from '../lib/auth';
const jwt = authOptions.callbacks!.jwt!, session = authOptions.callbacks!.session!;
beforeEach(() => vi.clearAllMocks());
it('refreshes current privileges from the account id rather than trusting old JWT claims', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'New', avatar: 'fox', role: 'user', email: 'owner@example.test' } as any);
  const token = await jwt({ token: { id: 'owner', role: 'admin' } } as any);
  expect(token.role).toBe('user'); expect(token.accountValid).toBe(true);
  expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'owner' } }));
});
it('invalidates deleted accounts even if the same email is registered again', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  const token = await jwt({ token: { id: 'deleted', email: 'reused@example.test' } } as any);
  expect(await session({ token, session: { user: { email: 'reused@example.test' } } } as any)).toBeNull();
});
it('fails closed during database errors and recovers after a valid fresh check', async () => {
  vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('db down'));
  const token = await jwt({ token: { id: 'owner' } } as any);
  expect(await session({ token, session: { user: {} } } as any)).toBeNull();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Owner', role: 'user', email: 'owner@example.test' } as any);
  const recovered = await jwt({ token } as any);
  expect((await session({ token: recovered, session: { user: {} } } as any))?.user).toMatchObject({ id: 'owner', role: 'user' });
});
