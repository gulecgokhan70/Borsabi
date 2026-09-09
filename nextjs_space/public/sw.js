const CACHE_NAME = 'borsabi-v4';
const STATIC_ASSETS = [
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
  '/offline.html',
];

// Install - cache only essential static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('push', event => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data || typeof data.title !== 'string') return;
  const url = typeof data.url === 'string' && /^\/(portfolio|trade-log|alerts)(?:[/?#]|$)/.test(data.url) ? data.url : '/portfolio';
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon-192x192.png', tag: data.id, data: { url } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/portfolio', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(url.href));
});

// Activate - clean only this app's old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith('borsabi-') && key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - minimal interception, network-first for everything
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache or replay API requests or application bundles.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/')
  ) return;

  // Network-only navigation. Cache no account HTML, prices or portfolio data.
  // Only a generic, public offline page may be served when the network fails.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('/offline.html')) || new Response('Bağlantı yok / Offline. Lütfen yeniden deneyin.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }));
    return;
  }

  // For pre-cached static assets only (icons, manifest) - cache first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request);
      })
    );
    return;
  }
});
