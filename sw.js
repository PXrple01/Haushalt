// Offline-Start für die Kicherkiste.
// Immer zuerst aus dem Netz laden (neue Versionen kommen sofort an). Ohne Netz startet die zuletzt gespeicherte Version.
// Die Dateiliste wird mit `node tests/update-sw.mjs` neu erzeugt (Version hochzählen bei jeder Veröffentlichung).
const CACHE = 'kicherkiste-v1';
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/components.css",
  "./css/fonts.css",
  "./css/games.css",
  "./css/scene.css",
  "./css/screens.css",
  "./css/themes.css",
  "./js/art/heart.js",
  "./js/art/icons.js",
  "./js/art/mascots.js",
  "./js/core/dom.js",
  "./js/core/fx.js",
  "./js/core/router.js",
  "./js/core/scene.js",
  "./js/core/sound.js",
  "./js/core/store.js",
  "./js/core/theme.js",
  "./js/core/ui.js",
  "./js/core/util.js",
  "./js/main.js",
  "./js/screens/dev.js",
  "./assets/fonts/anton.woff2",
  "./assets/fonts/caveat.woff2",
  "./assets/fonts/mochiy-pop-one.woff2",
  "./assets/fonts/nunito.woff2",
  "./assets/fonts/space-grotesk.woff2",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon.svg",
  "./vendor/realtime.js"
]; // AUTO

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Live-Verbindung und fremde Server laufen direkt übers Netz
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true })
    .then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }
        if (r.status >= 500) return fromCache().then((x) => x || r);
        return r;
      })
      .catch(() => fromCache().then((x) => x || Response.error())),
  );
});
