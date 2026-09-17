/* HQ v2 · service worker: cachea el shell estatico (network-first, con caida a cache); nunca la API de
   Supabase ni el payload omc_hq_v2 (van a otro origen, asi que ya quedan fuera del filtro de fetch).
   Push y notificationclick son el mismo comportamiento real que public/hq/v1/sw.js (mismo payload que
   envia hq-push en el servidor: title, body, url, tag, id, lic). */
var CACHE = 'hq-v13';
var SHELL = ['/hq/', '/hq/app/main.js', '/hq/app/api.js', '/hq/app/estado.js', '/hq/app/recargador.js', '/hq/app/ui.js', '/hq/app/tarjeta.js', '/hq/app/detalle.js', '/hq/app/dnd.js', '/hq/app/vistas/inicio.js', '/hq/app/vistas/plan.js', '/hq/app/vistas/tablero.js', '/hq/app/vistas/decisiones.js', '/hq/app/vistas/equipo.js', '/hq/app/vistas/expedientes.js', '/hq/app/tokens.css', '/hq/app/hq.css', '/hq/manifest.webmanifest', '/hq/icon-192.png', '/hq/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  // Fix ronda 2 (revision final, F-d/D2): borrar solo caches de la propia familia v2 ('hq-v' seguido
  // de digitos, p.ej. 'hq-v13'), nunca 'hq-v1-legado' (esa es del sw de v1, mismo origen, misma
  // CacheStorage). Antes borraba cualquier clave que no fuera CACHE, incluida la del otro sw.
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && /^hq-v\d+$/.test(k); }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  // Solo GET del propio origen y bajo /hq/ (nunca /hq/v1/, que tiene su sw y cache propios); todo lo
  // demas (Supabase, api.77delta.com, POST/PUT/DELETE) pasa de largo sin respondWith: red directa.
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/hq/') || u.pathname.startsWith('/hq/v1/')) return;
  // Fix ronda 2 (F-f/D4): solo se cachea una respuesta si r.ok; una 4xx/5xx (p.ej. un 404 tras un
  // rename de fichero) ya no se guarda como si fuera valida para servirla luego en modo offline.
  e.respondWith(fetch(e.request).then(function (r) { if (r.ok) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); } return r; })
    .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('/hq/'); }); }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'HQ', {
    body: d.body || '', icon: '/hq/icon-192.png', badge: '/hq/icon-192.png', tag: d.tag || 'hq', renotify: true, data: { url: d.url || '/hq/', id: d.id || null, lic: d.lic || null }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  // Fix ronda 2 (F-g/D5): sin d.url (push generico sin enlace) pero con d.id, abrir directamente la
  // tarjeta en vez de caer siempre en /hq/ y perder el deep link.
  var d = e.notification.data || {}, url = d.url || (d.id ? '/hq/#decisiones/' + d.id : '/hq/');
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    var abierta = false;
    for (var i = 0; i < ws.length; i++) {
      // NIT #14 (revision final, parado en el informe, aplicado aqui por ser trivial): '/hq/v1/...'
      // tambien contiene la subcadena '/hq/', asi que una pestaña de v1 abierta se marcaba como si
      // fuera la v2 ya abierta y nunca se abria una ventana nueva para el deep link de v2.
      if (ws[i].url.indexOf('/hq/') >= 0 && ws[i].url.indexOf('/hq/v1/') < 0) {
        abierta = true;
        if (d.id) { try { ws[i].postMessage({ tipo: 'abrir', id: d.id }); } catch (err) {} }
        if (d.lic) { try { ws[i].postMessage({ tipo: 'abrir-lic', lic: d.lic }); } catch (err) {} }
        if (ws[i].navigate) { try { ws[i].navigate(url); } catch (err) {} }
        if (ws[i].focus) { try { ws[i].focus(); } catch (err) {} }
      }
    }
    if (!abierta) return clients.openWindow(url);
  }));
});
