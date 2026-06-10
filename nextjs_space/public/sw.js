const CACHE_NAME = 'borsabi-v2';
const STATIC_ASSETS = [
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
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

// Activate - clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
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
  if (request.method !== 'GET') return;

  // Skip API requests, auth routes, and all _next requests (CSS/JS bundles)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/signup') ||
    url.pathname.startsWith('/_next/')
  ) return;

  // For navigation requests - always network, no caching
  if (request.mode === 'navigate') return;

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
