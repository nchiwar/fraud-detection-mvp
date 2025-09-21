const CACHE_NAME = 'fraud-detection-v1';
const urlsToCache = [
  '/',
  'index.html',
  'dashboard.html',
  'reports.html',
  'settings.html',
  'details.html',
  'alerts.html',
  'history.html',
  'styles.css',
  'script.js',
  'worker.js',
  'data.json',
  'manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});