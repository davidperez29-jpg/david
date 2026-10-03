/*
 * Service worker of the client app (§4.5, §9). Hand-written on purpose: small and auditable.
 *  - Static assets (/_next/static, icons): cache first (they are content-hashed).
 *  - Client pages (/me…): network first, falling back to the last cached copy when offline,
 *    so a session opened once can be reopened and logged without connection.
 *  - API calls are never cached: writes go through the IndexedDB queue in the page.
 */
const VERSION = 'tp-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll(['/icon.svg', '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Logout: forget cached pages (they may contain personal data).
  if (event.data === 'clear') event.waitUntil(caches.delete(PAGES));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname === '/me' || url.pathname.startsWith('/me/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (hit) =>
                hit ||
                new Response(
                  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title><body style="font-family:system-ui;padding:24px"><h1>Sin conexión</h1><p>Abre la sesión de hoy cuando tengas conexión y podrás registrarla después sin red.</p></body>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
                ),
            ),
        ),
    );
  }
});
