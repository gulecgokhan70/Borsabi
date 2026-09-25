import { yf } from '@/lib/yahoo-finance';
import { SharedFetchCache } from '@/lib/shared-fetch-cache';

// Only used by the worker. Catalogue scanning never shares the web chart queue.
const history = new SharedFetchCache<any>(1024, 240000);
const priorityHistory = new SharedFetchCache<any>(256, 60000);
let active = 0;
const waiting: (() => void)[] = [];
export function botChart(symbol: string, priority = false) {
  return (priority ? priorityHistory : history).get(symbol, async () => {
    if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        yf.chart(symbol, { period1: new Date(Date.now() - 7 * 86400000), interval: '15m' }, { fetchOptions: { signal: controller.signal } }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Bot chart timeout')); }, 6000); }),
      ]);
    } finally {
      clearTimeout(timer);
      const next = waiting.shift();
      if (next) next(); else active--;
    }
  });
}
