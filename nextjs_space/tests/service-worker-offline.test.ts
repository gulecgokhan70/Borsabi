import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker(online = false) {
  const listeners: Record<string, (event: any) => void> = {};
  const offline = new Response('generic offline page');
  const cache = { match: vi.fn().mockResolvedValue(offline), addAll: vi.fn(), put: vi.fn() };
  const caches = { open: vi.fn().mockResolvedValue(cache), match: vi.fn(), keys: vi.fn().mockResolvedValue(['other-app', 'borsabi-v3', 'borsabi-v4']), delete: vi.fn() };
  const fetch = online ? vi.fn().mockResolvedValue(new Response('private account page')) : vi.fn().mockRejectedValue(new Error('offline'));
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://borsabi.com' }, addEventListener: (name: string, fn: any) => { listeners[name] = fn; }, clients: { claim: vi.fn() } },
    URL, Response, caches, fetch,
  });
  return { listeners, cache, caches, fetch, offline };
}
describe('offline navigation without cached personal data', () => {
  it('shows only the public offline page on a failed authenticated navigation', async () => {
    const w = worker();
    const event = { request: { method: 'GET', mode: 'navigate', url: 'https://borsabi.com/portfolio' }, respondWith: vi.fn() };
    w.listeners.fetch(event);
    expect(await event.respondWith.mock.calls[0][0]).toBe(w.offline);
    expect(w.cache.match).toHaveBeenCalledWith('/offline.html');
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it('returns live navigation without storing account HTML', async () => {
    const w = worker(true);
    const event = { request: { method: 'GET', mode: 'navigate', url: 'https://borsabi.com/login' }, respondWith: vi.fn() };
    w.listeners.fetch(event);
    expect(await (await event.respondWith.mock.calls[0][0]).text()).toBe('private account page');
    expect(w.caches.open).not.toHaveBeenCalled();
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it('never intercepts a trade, API request, bundle, or third-party URL', () => {
    const w = worker();
    for (const [method, url] of [['POST', '/api/trade'], ['GET', '/api/portfolio'], ['GET', '/_next/static/chunk.js'], ['GET', 'https://other.example/manifest.json']]) {
      const event = { request: { method, mode: 'navigate', url: new URL(url, 'https://borsabi.com').href }, respondWith: vi.fn() };
      w.listeners.fetch(event);
      expect(event.respondWith).not.toHaveBeenCalled();
    }
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it('preserves caches owned by other applications', async () => {
    const w = worker();
    const event = { waitUntil: vi.fn() };
    w.listeners.activate(event);
    await event.waitUntil.mock.calls[0][0];
    expect(w.caches.delete.mock.calls).toEqual([['borsabi-v3']]);
  });
});
