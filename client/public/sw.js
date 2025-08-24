const SW_VERSION = 'v2.0.0';  // Static version - bump on deploy
const CACHE_NAME = `houseguide-${SW_VERSION}`;
const ASSETS_CACHE = `houseguide-assets-${SW_VERSION}`;

const urlsToCache = [
  '/',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  // Force activation to ensure immediate cache updates
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.includes(SW_VERSION)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Ensure clients get updates immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Never cache API requests - always fetch fresh data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // Cache-first for hashed assets (immutable)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(cache => {
        return cache.match(request).then(response => {
          if (response) return response;
          return fetch(request).then(fetchResponse => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }
  
  // Network-first for navigations, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/'))
    );
    return;
  }
  
  // Default: try cache first, fallback to network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        return response || fetch(request);
      })
  );
});
