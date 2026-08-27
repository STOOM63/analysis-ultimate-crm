const CACHE = 'analysis-ultimate-v1.0.1';
const LOCAL_ASSETS = [
  './','./index.html','./manifest.webmanifest','./css/styles.css','./js/constants.js','./js/utils.js','./js/importer.js',
  './js/storage.js','./js/analytics.js','./js/ui.js','./js/app.js'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(LOCAL_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
    return resp;
  }).catch(() => cached)));
});
