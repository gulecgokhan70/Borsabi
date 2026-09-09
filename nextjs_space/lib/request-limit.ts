import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

type Bucket = { count: number; resetAt: number };
// Shared by route bundles in the current single-process VPS deployment.
const state = globalThis as typeof globalThis & { borsabiRequestLimits?: Map<string, Bucket> };
const buckets = state.borsabiRequestLimits ??= new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function takeRequestSlot(key: string, limit: number, windowMs: number, now = Date.now()) {
  let bucket = buckets.get(key);
  if (bucket && now >= bucket.resetAt) { buckets.delete(key); bucket = undefined; }
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [id, item] of buckets) if (now >= item.resetAt) buckets.delete(id);
      if (buckets.size >= MAX_BUCKETS) return { allowed: false, retryAfter: 60 };
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  bucket.count++;
  return { allowed: true, retryAfter: 0 };
}

export function signupClientKey(headers: Headers) {
  // Our Nginx appends the TCP client address. Never trust the spoofable first entry.
  // The Node port must remain bound to 127.0.0.1 behind that proxy.
  const address = headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || '';
  return 'signup:' + createHash('sha256').update(isIP(address) ? address : 'unknown').digest('hex');
}
