// Service worker: caches the app shell so it opens fast and installs as an app.
// Data and /api calls always go to the network.
const VERSION = 'v9';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/main.js', '/js/db.js', '/js/ai.js', '/js/ui.js', '/js/state.js', '/js/speech.js', '/js/tour.js', '/js/steps.js', '/js/onboarding.js', '/js/art.js', '/js/install.js', '/js/photos.js', '/js/menu.js', '/js/coach.js', '/js/views/graficos.js', '/js/lib/charts.js', '/js/lib/receipt.js', '/js/lib/insights.js',
  '/js/lib/format.js', '/js/lib/calc.js', '/js/lib/categorize.js', '/js/lib/parse.js', '/js/lib/validate.js',
  '/js/views/resumo.js', '/js/views/lancar.js', '/js/views/perguntar.js', '/js/views/extrato.js', '/js/views/ajustes.js',
  '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // Network first, so a new deploy shows up right away; cache is the offline fallback.
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('/'))));
});
