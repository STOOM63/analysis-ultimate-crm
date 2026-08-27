const CACHE = 'analysis-ultimate-v2.0.0-ultimate';
const LOCAL_ASSETS = [
  './','./index.html','./manifest.webmanifest','./css/styles.css?v=2.0.0',
  './js/constants.js?v=2.0.0','./js/utils.js?v=2.0.0','./js/csv.js?v=2.0.0','./js/xlsx-lite.js?v=2.0.0',
  './js/importer.js?v=2.0.0','./js/storage.js?v=2.0.0','./js/analytics.js?v=2.0.0','./js/intelligence.js?v=2.0.0',
  './js/ui.js?v=2.0.0','./js/app.js?v=2.0.0'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(LOCAL_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(resp=>{
    if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}return resp;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
});
