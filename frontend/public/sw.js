// VistaraX - minimal service worker. Its only real job is to make the app
// installable (Chrome requires a registered SW with a fetch handler) and to
// keep the app shell available if the network briefly drops. It deliberately
// does NOT cache API responses (/api/...) or socket.io traffic - visitor
// data must always come from the network, never a stale cache.
const CACHE_NAME = 'vistarax-shell-v1';
const APP_SHELL = ['/', '/login', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/vistarax-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // don't block install if one shell asset 404s
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept writes
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return; // always live

  // Navigations: try the network first (so users always see the latest
  // build/data when online), fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/login').then((res) => res || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first, refresh the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
