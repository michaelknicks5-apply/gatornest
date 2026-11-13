// GatorNest service worker: keeps the app shell and the last good data available offline.
// Map tiles and anything from another origin go straight to the network.
const CACHE = 'gatornest-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname; // ignore cache-busting query strings
  const hashed = url.pathname.includes('/assets/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (hashed) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(key, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(key);
      if (!hit) throw err;
      // Tell the app this is a saved copy so it can show its warning chip.
      const headers = new Headers(hit.headers);
      headers.set('X-From-Cache', '1');
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
    }
  })());
});
