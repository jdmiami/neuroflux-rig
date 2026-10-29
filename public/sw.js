const CACHE = 'neuroflux-local-e14a938f57439a1f';
const ASSETS = ["/","/index.html","/launch.html","/release.json","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png","/releases/e14a938f57439a1f/app.html","/releases/e14a938f57439a1f/studio.js","/releases/e14a938f57439a1f/studio.css","/releases/e14a938f57439a1f/performance.js","/releases/e14a938f57439a1f/performance.css","/releases/e14a938f57439a1f/vision.worker.js","/releases/e14a938f57439a1f/guide.js","/releases/e14a938f57439a1f/guide.css","/releases/e14a938f57439a1f/guide-index.json","/releases/e14a938f57439a1f/export.worker.js","/releases/e14a938f57439a1f/pcm.worklet.js"];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Only core app files gate activation. Large models/export runtimes load on demand.
    await Promise.all(ASSETS.map(async path => {
      const response = await fetch(new Request(path, { cache: 'reload' }));
      if (!response.ok) throw new Error(`App asset failed: ${path}`);
      await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    // Keep earlier release caches while an old tab might still use them.
    // Explicit update recovery removes app caches without touching user data.
    for (const client of await self.clients.matchAll()) client.postMessage({ type: 'OFFLINE_READY' });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  const fresh=event.request.mode==='navigate'||url.pathname==='/release.json';
  const asset=ASSETS.includes(url.pathname)||url.pathname.startsWith('/releases/')||url.pathname.startsWith('/vendor/');
  if(!fresh&&!asset)return;
  // Recovery stays network-only, even when offline.
  if(url.pathname==='/update.html')return;
  event.respondWith((async () => {
    const cache=await caches.open(CACHE);
    if(fresh){
      try{const response=await fetch(event.request,{cache:'no-store'});if(response.ok){try{await cache.put(url.pathname,response.clone());}catch{}return response;}throw Error('Network response failed');}
      catch(error){const saved=await cache.match(url.pathname)||await caches.match(url.pathname);if(saved)return saved;throw error;}
    }
    const saved=await cache.match(url.pathname)||await caches.match(url.pathname);if(saved)return saved;
    const response=await fetch(event.request);if(response.ok)try{await cache.put(url.pathname,response.clone());}catch{}
    return response;
  })());
});
