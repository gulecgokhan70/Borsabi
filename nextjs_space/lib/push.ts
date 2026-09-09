import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function allowedPushEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && (!u.port || u.port === '443') && !u.username && !u.password && !u.hash &&
      (u.hostname === 'fcm.googleapis.com' || u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.apple.com') ||
       u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}
export const subscriptionSchema = z.object({ endpoint: z.string().max(2048).refine(allowedPushEndpoint),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,2}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/) }) });
export function pushConfigured() { return !!(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_SUBJECT); }
export async function deliverNotifications(db: PrismaClient) {
  if (!pushConfigured()) return;
  const started = Date.now();
  const queue = await db.appNotification.findMany({ where: { pushedAt: null, attempts: { lt: 5 } }, orderBy: { createdAt: 'asc' }, take: 30 });
  for (const event of queue) {
    if (Date.now() - started > 20_000) break;
    const subscriptions = await db.pushSubscription.findMany({ where: { userId: event.userId } });
    let failed = false;
    for (const sub of subscriptions) {
      if (Date.now() - started > 20_000) { failed = true; break; }
      if (!allowedPushEndpoint(sub.endpoint)) continue;
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ id: event.id, title: event.title, body: event.body, url: event.url }), {
            TTL: 300, timeout: 5000, vapidDetails: { subject: process.env.WEB_PUSH_SUBJECT!, publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
          });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.pushSubscription.deleteMany({ where: { id: sub.id } });
        else failed = true;
      }
    }
    await db.appNotification.update({ where: { id: event.id }, data: { attempts: { increment: 1 }, pushedAt: failed ? null : new Date() } });
  }
}
