import type { Market } from './engine';
import type { Observation } from './auto-engine';
import type { ScanProgress } from './catalog';

type Batch = { observations: Observation[]; progress: ScanProgress };
type Cursor = { offset: number; startedAt: number; completedAt: number | null; result?: Batch; pending?: Promise<Batch> };
/** One bounded, shared batch per market per minute; every symbol gets a turn. */
export class CatalogScanner {
  private cursors = new Map<Market, Cursor>();
  constructor(private batchSize = 48, private ttl = 60000) {}
  async scan(market: Market, symbols: string[], load: (symbols: string[]) => Promise<Observation[]>, now = Date.now()): Promise<Batch> {
    let cursor = this.cursors.get(market);
    if (!cursor) { cursor = { offset: 0, startedAt: now, completedAt: null }; this.cursors.set(market, cursor); }
    if (cursor.pending) return cursor.pending;
    if (cursor.result && now - cursor.result.progress.checkedAt < this.ttl) return cursor.result;
    const current = cursor;
    const start = current.offset >= symbols.length ? 0 : current.offset;
    const batch = symbols.slice(start, start + this.batchSize);
    current.pending = load(batch).then(observations => {
      const checkedAt = Date.now();
      if (start === 0) current.startedAt = now;
      current.offset = start + batch.length;
      if (current.offset === symbols.length) current.completedAt = checkedAt;
      const progress: ScanProgress = { total: symbols.length, processed: current.offset, batchSize: batch.length,
        cycleStartedAt: current.startedAt, cycleCompletedAt: current.completedAt, checkedAt };
      current.result = { observations, progress };
      return current.result;
    }).finally(() => { current.pending = undefined; });
    return current.pending;
  }
}
