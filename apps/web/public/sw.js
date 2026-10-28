/*
 * Service worker of the client app (§4.5, §9). Hand-written on purpose: small and auditable.
 *  - Static assets (/_next/static, icons): cache first (they are content-hashed).
 *  - Client pages (/me…): network first, falling back to the last cached copy when offline,
 *    so a session opened once can be reopened and logged without connection.
 *  - API calls are never cached: writes go through the IndexedDB queue in the page.
 *  - The installed app opens at "/" (restructure phase 24), which sends each person to their area.
 *    Without connection, a client who has opened «Hoy» before is taken to its last copy.
 */
const VERSION = 'tp-v2';
const ICONS = ['/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-touch-icon.png'];
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([...ICONS, '/manifest.webmanifest'])));
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

  if (url.pathname.startsWith('/_next/static/') || ICONS.includes(url.pathname)) {
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

  if (url.pathname === '/' && req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches
          .match('/me', { ignoreVary: true })
          .then((hit) =>
            hit ? Response.redirect(new URL('/me', self.location.origin).href, 302) : offline(),
          ),
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
        .catch(() => caches.match(req).then((hit) => hit || offline())),
    );
  }
});

function offline() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title><body style="font-family:system-ui;padding:24px"><h1>Sin conexión</h1><p>Abre la sesión de hoy cuando tengas conexión y podrás registrarla después sin red.</p></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
