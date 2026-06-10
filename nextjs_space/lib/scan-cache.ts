import { prisma } from '@/lib/db';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 dakika

// In-memory lock to prevent concurrent scans for the same key
const runningScans = new Map<string, Promise<any>>();

export interface CacheResult<T> {
  data: T;
  cachedAt: string; // ISO timestamp
  fresh: boolean;   // true if within TTL
}

/**
 * Get cached scan data. Returns null if no cache exists.
 */
export async function getScanCache<T>(key: string): Promise<CacheResult<T> | null> {
  try {
    const row = await prisma.scanCache.findUnique({ where: { id: key } });
    if (!row) return null;
    const age = Date.now() - row.updatedAt.getTime();
    return {
      data: JSON.parse(row.data) as T,
      cachedAt: row.updatedAt.toISOString(),
      fresh: age < CACHE_TTL_MS,
    };
  } catch (e) {
    console.error(`[ScanCache] Read error for ${key}:`, e);
    return null;
  }
}

/**
 * Write scan data to cache.
 */
export async function setScanCache(key: string, data: any): Promise<void> {
  try {
    const json = JSON.stringify(data);
    await prisma.scanCache.upsert({
      where: { id: key },
      update: { data: json },
      create: { id: key, data: json },
    });
  } catch (e) {
    console.error(`[ScanCache] Write error for ${key}:`, e);
  }
}

/**
 * Stale-while-revalidate pattern:
 * 1. Return cached data immediately if available
 * 2. If stale (>15min), trigger background refresh
 * 3. If no cache, run scan synchronously
 */
export async function cachedScan<T>(
  key: string,
  scanFn: () => Promise<T>,
): Promise<{ result: T; cachedAt: string; fresh: boolean }> {
  const cached = await getScanCache<T>(key);

  if (cached && cached.fresh) {
    // Fresh cache — return immediately
    return { result: cached.data, cachedAt: cached.cachedAt, fresh: true };
  }

  if (cached && !cached.fresh) {
    // Stale cache — return stale data but trigger background refresh
    triggerBackgroundRefresh(key, scanFn);
    return { result: cached.data, cachedAt: cached.cachedAt, fresh: false };
  }

  // No cache — run synchronously
  const result = await runScanWithLock(key, scanFn);
  return { result, cachedAt: new Date().toISOString(), fresh: true };
}

/**
 * Run scan with de-duplication lock so multiple requests
 * don't trigger the same heavy scan simultaneously.
 */
async function runScanWithLock<T>(key: string, scanFn: () => Promise<T>): Promise<T> {
  const existing = runningScans.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const result = await scanFn();
      await setScanCache(key, result);
      return result;
    } finally {
      runningScans.delete(key);
    }
  })();

  runningScans.set(key, promise);
  return promise;
}

/**
 * Fire-and-forget background refresh.
 */
function triggerBackgroundRefresh<T>(key: string, scanFn: () => Promise<T>): void {
  if (runningScans.has(key)) return; // Already refreshing
  runScanWithLock(key, scanFn).catch(e => {
    console.error(`[ScanCache] Background refresh error for ${key}:`, e);
  });
}
