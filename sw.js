const STATIC_CACHE = 'aromatna-static-v2';
const API_CACHE = 'aromatna-api-v2';

const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/coffee.jpg',
  '/manifest.json',
  '/offline.html',
  '/api/menu.json'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![STATIC_CACHE, API_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// helpers
function isHTML(req) {
  return req.headers.get('accept')?.includes('text/html');
}
function isAPI(req) {
  return new URL(req.url).pathname.startsWith('/api/');
}

// Strategy 1: API = Network First
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(API_CACHE);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // якщо API не знайдено — вертаємо короткий fallback
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Strategy 2: Static = Stale-While-Revalidate (SWR)
// Віддаємо кеш одразу, але в фоні оновлюємо
async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  return cached || (await fetchPromise) || (isHTML(req) ? caches.match('/offline.html') : new Response('Offline', { status: 503 }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  if (isAPI(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

// відправка “замовлення”
self.addEventListener('sync', (event) => {
  if (event.tag !== 'send-order') return;

  event.waitUntil((async () => {
    // імітуємо успішну відправку.
    try {
      await fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, note: 'demo order' })
      });
    } catch {
    }

    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage('Замовлення відправлено!'));
  })());
});
