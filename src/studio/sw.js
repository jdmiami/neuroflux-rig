const CACHE = 'neuroflux-local-__NFX_CACHE_VERSION__';
const ASSETS = __NFX_ASSETS__;
self.addEventListener('install', event => {
  // Do not activate halfway through a take; the next normal navigation gets the update.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async path => {
      const response = await fetch(new Request(path, { cache: 'reload' }));
      if (!response.ok) throw new Error(`Offline asset failed: ${path}`);
      await cache.put(path, response);
    }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    for (const key of await caches.keys()) if (key.startsWith('neuroflux-local-') && key !== CACHE) await caches.delete(key);
    for (const client of await self.clients.matchAll()) client.postMessage({ type: 'OFFLINE_READY' });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(url.pathname) || fetch(event.request);
  })());
});
