const CACHE = 'pixel-wave-stage-sequencer-m3-v2';
const SHELL = [
  './stage-sequencer.html',
  './stage-sequencer.css',
  './stage-sequencer.js',
  './stage-sequencer-manifest.webmanifest',
  './barrage-icon.svg',
  '../js/config.js',
  '../js/assets.js',
  '../js/spriteRenderer.js',
  '../js/backgroundRenderer.js',
  '../js/stage/random.js',
  '../js/stage/path.js',
  '../js/stage/formation.js',
  '../js/stage/registry.js',
  '../js/stage/compiler.js',
  '../js/stage/simulation.js',
  '../js/stage/document.js',
  '../js/stage/persistence.js',
  '../docs/stage-editor/stage3.v1.draft.json',
  '../assets/fonts/Galmuri11.woff2',
  '../assets/sprites.png',
  '../assets/bosses.png',
  '../assets/backgrounds/stage3-sea-strip.png',
  '../assets/backgrounds/stage3-far-strip.png',
  '../assets/backgrounds/stage3-mid-strip.png',
  '../assets/backgrounds/stage3-near-strip.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('pixel-wave-stage-sequencer-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./stage-sequencer.html');
        return new Response('', { status: 504, statusText: 'Offline resource unavailable' });
      })),
  );
});
