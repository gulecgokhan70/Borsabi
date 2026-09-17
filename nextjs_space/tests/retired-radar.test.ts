import { expect, it, vi, afterEach } from 'vitest';
vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }));
import webpush from 'web-push';
import { deliverNotifications } from '../lib/push';
afterEach(() => vi.unstubAllEnvs());
it('excludes retired radar events from delivery and suppresses any stale queued radar event', async () => {
  for (const key of ['WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'WEB_PUSH_SUBJECT']) vi.stubEnv(key, 'test');
  const db: any = { appNotification: { findMany: vi.fn().mockResolvedValue([{ id: 'old', userId: 'u', eventKey: 'radar:u:old' }]), update: vi.fn() }, pushSubscription: { findMany: vi.fn() } };
  await deliverNotifications(db);
  expect(db.appNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { eventKey: { startsWith: 'radar:' } } }) }));
  expect(db.pushSubscription.findMany).not.toHaveBeenCalled();
  expect(webpush.sendNotification).not.toHaveBeenCalled();
});
