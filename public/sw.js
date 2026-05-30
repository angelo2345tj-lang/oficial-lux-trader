/* Lux Trader FX — Service Worker institucional */
const CACHE_VERSION = 'luxfx-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/maskable-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('luxfx-') && !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res.ok) {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);
  return cached || networkPromise || caches.match('/offline.html');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    event.respondWith(
      fetch(request)
        .then(async (res) => {
          if (res.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  const isHashedAsset =
    url.pathname.startsWith('/assets/') &&
    (url.pathname.includes('-') || url.pathname.match(/\.[a-f0-9]{8,}\./));

  const isStaticAsset =
    isHashedAsset ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico');

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? {
    title: 'Lux Trader FX',
    body: 'Novo alerta de mercado',
  };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Lux Trader FX', {
      body: data.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: data.tag ?? 'lux-alert',
      data: data.url ?? '/',
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'lux-sync-offline') {
    event.waitUntil(Promise.resolve());
  }
});
