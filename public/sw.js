/* Service worker: offline-first for the app, runtime caching for fonts.
 * Bump VERSION whenever you deploy a new build so phones pick up the update. */
const VERSION = 'hpm-v34';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Precache the shell AND the hashed JS/CSS bundles referenced by index.html,
// so the app works offline right after the very first visit.
async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(SHELL);
  const html = await (await fetch('./index.html', { cache: 'no-cache' })).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map((m) => m[1])
    .filter((u) => !u.startsWith('http'));
  await cache.addAll(assets);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page navigations: network first (fresh deploys), fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Google Fonts: stale-while-revalidate.
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Own assets (hashed JS/CSS, icons): cache first, then network and store.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});

/* ---------- push: "you were added to a game" ---------- */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Home Poker', {
    body: d.body || '', tag: d.tag || 'home-poker', icon: './icons/icon-192.png', badge: './icons/icon-192.png',
    dir: 'rtl', lang: 'he', data: { url: d.url || './' }, renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if ('navigate' in w) { await w.navigate(url); return w.focus(); } }
    return self.clients.openWindow(url);
  })());
});
