const CACHE = 'neuroflux-local-ac4bb658ec6b8a41';
const ASSETS = ["/","/index.html","/studio.js","/studio.css","/performance.js","/performance.css","/vision.worker.js","/guide.js","/guide.css","/guide-index.json","/manual.html","/export.worker.js","/pcm.worklet.js","/c0.bin","/c1.bin","/c2.bin","/c3.bin","/c4.bin","/THIRD-PARTY-NOTICES.txt","/vendor-licenses/FFmpeg-core-GPL-2.0.txt","/vendor-licenses/FFmpeg-wasm-MIT.txt","/vendor-licenses/MediaPipe-Apache-2.0.txt","/vendor-licenses/Mediabunny-MPL-2.0.txt","/manual-assets/camera-000.png","/manual-assets/camera-050.png","/manual-assets/camera-100.png","/vendor/ffmpeg/classes.js","/vendor/ffmpeg/const.js","/vendor/ffmpeg/errors.js","/vendor/ffmpeg/index.js","/vendor/ffmpeg/types.js","/vendor/ffmpeg/utils.js","/vendor/ffmpeg/worker.js","/vendor/ffmpeg-core/ffmpeg-core.js","/vendor/ffmpeg-core/ffmpeg-core.wasm","/vendor/vision/wasm/vision_wasm_internal.js","/vendor/vision/wasm/vision_wasm_internal.wasm","/vendor/vision/wasm/vision_wasm_nosimd_internal.js","/vendor/vision/wasm/vision_wasm_nosimd_internal.wasm"];
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
