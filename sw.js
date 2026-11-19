// Offline-Start für die Kicherkiste.
// Immer zuerst aus dem Netz laden (neue Versionen kommen sofort an). Ohne Netz startet die zuletzt gespeicherte Version.
// Die Dateiliste wird mit `node tests/update-sw.mjs` neu erzeugt (Version hochzählen bei jeder Veröffentlichung).
const CACHE = 'kicherkiste-v4';
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/components.css",
  "./css/escape.css",
  "./css/fonts.css",
  "./css/games.css",
  "./css/rounds.css",
  "./css/scene.css",
  "./css/screens.css",
  "./css/ships.css",
  "./css/themes.css",
  "./js/art/heart.js",
  "./js/art/icons.js",
  "./js/art/mascots.js",
  "./js/core/dom.js",
  "./js/core/fx.js",
  "./js/core/net.js",
  "./js/core/notify.js",
  "./js/core/router.js",
  "./js/core/scene.js",
  "./js/core/sound.js",
  "./js/core/stats.js",
  "./js/core/store.js",
  "./js/core/sync.js",
  "./js/core/theme.js",
  "./js/core/ui.js",
  "./js/core/util.js",
  "./js/data/characters.js",
  "./js/data/questions.js",
  "./js/data/terms.js",
  "./js/data/words.js",
  "./js/games/common.js",
  "./js/games/draw/canvas.js",
  "./js/games/draw/logic.js",
  "./js/games/draw/view.js",
  "./js/games/escape/art.js",
  "./js/games/escape/logic.js",
  "./js/games/escape/puzzles.js",
  "./js/games/escape/rng.js",
  "./js/games/escape/rooms.js",
  "./js/games/escape/symbols.js",
  "./js/games/escape/themes.js",
  "./js/games/escape/view.js",
  "./js/games/hangman/logic.js",
  "./js/games/hangman/view.js",
  "./js/games/info.js",
  "./js/games/mime/logic.js",
  "./js/games/mime/view.js",
  "./js/games/number/logic.js",
  "./js/games/number/view.js",
  "./js/games/registry.js",
  "./js/games/rounds-ui.js",
  "./js/games/rounds.js",
  "./js/games/secret.js",
  "./js/games/ships/art.js",
  "./js/games/ships/logic.js",
  "./js/games/ships/view.js",
  "./js/games/whoami/logic.js",
  "./js/games/whoami/view.js",
  "./js/main.js",
  "./js/screens/dev.js",
  "./js/screens/game.js",
  "./js/screens/lobby.js",
  "./js/screens/resume.js",
  "./js/screens/settings.js",
  "./js/screens/setup.js",
  "./js/screens/wer.js",
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
