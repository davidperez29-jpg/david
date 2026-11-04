/*
 * Service worker de TrainPro (Fase 1).
 *
 * Política deliberadamente mínima por privacidad:
 * - Solo guarda en caché la página «sin conexión» y los iconos (nada con datos personales).
 * - Las páginas y los datos siempre se piden a la red; si no hay conexión, se muestra offline.html.
 * - Cambia CACHE_VERSION para invalidar la caché anterior.
 */
const CACHE_VERSION = 'trainpro-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((response) => response || Response.error()),
    ),
  );
});
