/* HQ · service worker: shell offline y avisos push. */
var CACHE = 'hq-v5';
var SHELL = ['/hq/', '/hq/manifest.webmanifest', '/hq/icon-192.png', '/hq/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/hq/') !== 0) return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (x) { x.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'HQ', {
    body: d.body || '', icon: '/hq/icon-192.png', badge: '/hq/icon-192.png', tag: d.tag || 'hq', renotify: true, data: { url: d.url || '/hq/', id: d.id || null }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var d = e.notification.data || {}, url = d.url || '/hq/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    // Si la app ya está abierta, se le pide que abra la tarjeta (navigate no funciona en la app instalada de iOS).
    for (var i = 0; i < ws.length; i++) { if (ws[i].url.indexOf('/hq/') >= 0) { if (d.id) ws[i].postMessage({ tipo: 'abrir', id: d.id }); return ws[i].focus ? ws[i].focus() : null; } }
    return clients.openWindow(url);
  }));
});
