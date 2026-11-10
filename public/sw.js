// Service worker: caches the app shell so it opens fast and installs as an app.
// Data and /api calls always go to the network.
const VERSION = 'v2.3.1';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/main.js', '/js/boot.js', '/js/db.js', '/js/ai.js', '/js/ui.js', '/js/state.js', '/js/speech.js', '/js/tour.js', '/js/steps.js', '/js/onboarding.js', '/js/art.js', '/js/install.js', '/js/push.js', '/js/metrics.js', '/js/privacy.js', '/js/lib/recurring.js', '/js/lib/settle.js', '/js/photos.js', '/js/menu.js', '/js/coach.js', '/js/views/graficos.js', '/js/views/fechar.js', '/js/lib/closing.js', '/js/lib/charts.js', '/js/lib/receipt.js', '/js/lib/insights.js', '/js/lib/budget.js', '/js/lib/pricing.js', '/js/lib/faq.js', '/js/feedback.js', '/js/usage.js', '/js/lib/navlog.js', '/js/applepay.js', '/js/lib/quick.js', '/js/lib/feed.js', '/js/messages.js', '/js/lib/news.js',
  '/js/lib/format.js', '/js/lib/calc.js', '/js/lib/categorize.js', '/js/lib/parse.js', '/js/lib/validate.js',
  '/js/views/resumo.js', '/js/views/lancar.js', '/js/views/perguntar.js', '/js/views/extrato.js', '/js/views/ajustes.js',
  '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/badge-96.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'share').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Something shared with the app (Android: "Compartilhar" in the bank app): keep it for the page and open Lançar.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'POST' || u.origin !== location.origin || u.pathname !== '/compartilhar') return;
  e.respondWith((async () => {
    try {
      // One or several files (all the card bills and the statement at once), kept until the page reads them.
      const f = await e.request.formData(), files = f.getAll('file').filter(x => x && x.size).slice(0, 10), text = [f.get('title'), f.get('text'), f.get('url')].filter(Boolean).join(' ').trim();
      const c = await caches.open('share');
      for (const k of await c.keys()) if (/\/shared\/file/.test(k.url)) await c.delete(k);
      await c.put('/shared/meta', new Response(JSON.stringify({ text, name: files[0] && files[0].name || '', type: files[0] && files[0].type || '', files: files.map(x => ({ name: x.name || '', type: x.type || '' })), at: Date.now() }), { headers: { 'content-type': 'application/json' } }));
      for (let i = 0; i < files.length; i++) await c.put(i ? '/shared/file' + i : '/shared/file', new Response(files[i], { headers: { 'content-type': files[i].type || 'application/octet-stream' } }));
    } catch (x) { /* the page shows a message if nothing arrived */ }
    return Response.redirect('/?acao=compartilhar', 303);
  })());
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // Network first, so a new deploy shows up right away; cache is the offline fallback.
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('/'))));
});

// Notifications sent by the daily run (api/push-cron.js) or the test button.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  // Tells the open app that the notice reached this phone (the test uses it to tell "did not arrive" from
  // "arrived but the phone did not show it").
  e.waitUntil((async () => {
    let shown = true;
    try { await self.registration.showNotification(d.title || 'Pra Onde Foi', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: d.tag || 'aviso', renotify: true, data: { url: d.url || '/' }, lang: 'pt-BR' }); } catch (x) { shown = false; }
    (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).forEach(c => c.postMessage({ type: 'push', tag: d.tag || 'aviso', shown }));
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => new URL(c.url).origin === self.location.origin);
    if (w) { w.postMessage({ type: 'open', url }); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
