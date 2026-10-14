// Bumped to v5: local development no longer registers this worker, and only
// same-origin HTTP(S) requests are eligible for runtime caching.
// The HTML shell (navigations + index.html) is served
// NETWORK-FIRST so a fresh deploy shows up immediately instead of being masked
// by a stale cached shell that points at old, content-hashed JS bundles. Other
// static assets keep stale-while-revalidate (hashed bundles are safe to reuse).
const CACHE_NAME = 'pitchnest-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/logo.png',
  '/logo.svg',
  '/logo-maskable-192.png',
  '/logo-maskable-512.png'
];

// Install event: cache initial static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 Clearing old PWA Cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// True when this request is for the app shell HTML (a page navigation or an
// explicit request for the document). These must be network-first so the user
// always boots the latest deploy.
function isHtmlRequest(request) {
  const url = new URL(request.url);
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    (request.headers.get('Accept') || '').includes('text/html')
  );
}

// Fetch event: serve from cache or network, bypassing API and WebSockets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache Storage only supports HTTP(S), and this worker should never cache
  // extension requests, third-party assets, API calls, or WebSockets.
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== self.location.origin ||
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    event.request.headers.get('Upgrade') === 'websocket'
  ) {
    return; // Let browser fetch naturally without intercepting
  }

  // ── HTML shell: NETWORK-FIRST ──────────────────────────────────────────────
  // Always try the network so a new deploy is picked up instantly; fall back to
  // the cached shell only when offline so the installed PWA still launches.
  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy))
              .catch((err) => console.warn('SW HTML cache update failed:', err));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then(async (cached) => {
            if (cached) return cached;
            const shell = await caches.match('/index.html');
            return shell || new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
          })
        )
    );
    return;
  }

  // ── Other static assets: STALE-WHILE-REVALIDATE ────────────────────────────
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh version in the background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, networkResponse))
              .catch((err) => console.warn('SW background cache update failed:', err));
          }
        }).catch(() => {}); // Silence background errors if offline
        return cachedResponse;
      }

      // Network fallback
      return fetch(event.request).then((response) => {
        // Cache dynamic static files if successful
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache))
            .catch((err) => console.warn('SW runtime cache update failed:', err));
        }
        return response;
      }).catch((err) => {
        console.error('SW fetch failed for:', url.href, err);
        return Response.error();
      });
    })
  );
});
