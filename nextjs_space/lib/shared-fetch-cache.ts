// Bounded LRU cache with one in-flight request per key. Caller owns validation
// and stale-data labels; failed refreshes never change the original value/time.
export class SharedFetchCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private pending = new Map<string, Promise<T>>();
  constructor(private capacity: number, private ttl: number) {}
  get size() { return this.entries.size; }
  get pendingCount() { return this.pending.size; }
  async get(key: string, load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expires > Date.now()) {
      this.entries.delete(key); this.entries.set(key, entry);
      return entry.value;
    }
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= this.capacity) {
      if (entry) return entry.value;
      throw new Error('Piyasa verisi istek sınırına ulaşıldı.');
    }
    const promise = Promise.resolve().then(load).then(value => {
      this.entries.delete(key);
      this.entries.set(key, { value, expires: Date.now() + this.ttl });
      while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
      return value;
    }).catch(error => { if (entry) return entry.value; throw error; }).finally(() => { this.pending.delete(key); });
    this.pending.set(key, promise);
    return promise;
  }
}
