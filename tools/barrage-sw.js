'use strict';

const CACHE = 'pixel-wave-barrage-lab-v2';
const APP_FILES = [
  './barrage-editor.html',
  './barrage-editor.css',
  './barrage-editor.js',
  './barrage-manifest.webmanifest',
  './barrage-icon.svg',
  '../js/barrage.js',
  '../js/barragePatterns.generated.js',
  '../assets/fonts/Galmuri11.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('pixel-wave-barrage-lab-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./barrage-editor.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      })
  );
});
