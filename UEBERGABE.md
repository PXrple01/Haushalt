# Übergabe für spätere Sitzungen – Kicherkiste

Stand: 19.11.2026, Version 1.0 (Cache `kicherkiste-v2`). Bauplan mit Design-System und Etappen: `PLAN.md`.

## 1. Was das Projekt ist
- Private PWA mit drei Ratespielen für Johann (`joh`) und Josefine (`jos`), Sprache Deutsch.
- **Anzeigename von Josefine ist „Baby“** (Wunsch des Nutzers). Echte Namen nur auf „Wer spielt?“ (`realName`), überall sonst `nameOf()` (Spitznamen, in den Einstellungen änderbar, `prefs.nicks`).
- Themes: `baby` (Cutecore-Stickerbuch, Einhorn **Kiki**) und `lila` (Neon-Nacht mit Manga-Akzenten, Katze **Kuro**). Standard je Person, umschaltbar.
- Modi: `couch` (Nebeneinander, ein Gerät, Übergabe-Bildschirme) und `remote` (Weit weg, zwei Geräte live).

## 2. Repo, Branches, Hosting
- Repo `PXrple01/Haushalt` (öffentlich, für kostenloses GitHub Pages). Live: **https://pxrple01.github.io/Haushalt/** (Pages aus `main`, Ordner `/`).
- Arbeiten auf einem `claude/…`-Branch; veröffentlichen mit `git push origin HEAD:main` (nach Freigabe durch den Nutzer).
- Alte Branches `haushaltsbuch` und `julipod` sind Altlasten (Nutzer wollte sie löschen; Claude darf das per Proxy nicht).
- Commit-Nachrichten auf Deutsch, mit den Attribution-Zeilen aus dem System-Hinweis. Keine Modellnamen in Commits/Code.
- Vor jeder Veröffentlichung: `node tests/update-sw.mjs --bump` (Dateiliste + Cache-Version in `sw.js`).

## 3. Aufbau
- Kein Build-Schritt. ES-Module, `index.html` lädt `js/main.js`.
- `js/core/`: `router` (Hash-Routen `#/wer`, `#/lobby`, `#/neu/<spiel>`, `#/spiel/<id>`, `#/dev`), `store` (localStorage mit Präfix `kk:`, Test-Namensraum `?ns=a`), `theme`, `scene` (Hintergründe), `fx` (Partikel-Leinwand), `sound` (Web Audio), `ui` (Toast/Blatt/Dialog/Übergabe/Segment), `net` (Supabase Realtime), `sync` (Ereignis-Protokoll), `stats` (Duell-Bilanz), `notify` (Einladungen, „Du bist dran“, Bilanz-Einträge), `util`.
- `js/games/<spiel>/logic.js` = reine Logik (`reduce(meta, evs)`, `todo`, `label`), `view.js` = Oberfläche (`setup(root)`, `play(root, sid)`). Gemeinsames in `js/games/common.js`.
- `js/data/`: Wortpool (459), Figurenpool (323), Fragen-Ideen mit Regeln (`test(n)`).
- `vendor/realtime.js` = `@supabase/realtime-js` 2.119.1, mit esbuild gebündelt (nur `RealtimeClient`).

## 4. Abgleich (wichtig!)
- Jede Partie = Liste von Ereignissen `{id, n (Lamport), by, t, ty, d}`; Zustand wird immer neu berechnet. Sortierung `(n, by, id)`.
- Fern-Modus: neue Ereignisse per Broadcast (`ev`), beim Verbinden `hello` (Anzahl je Partie + Bilanz) → fehlende Partien per `sync`. Flüchtig: `fx` (Reaktionen, tippt …, Anstupsen).
- Kanal = `kk-` + SHA-256(`kicherkiste:` + Code). Supabase-URL + öffentlicher Schlüssel (`sb_publishable_…`) stehen in `js/core/net.js` – derselbe öffentliche Schlüssel wie in der Watchlist, nur für Live-Kanäle. **Nichts wird in der Datenbank gespeichert.**
- Im Couch-Modus wird `e.by` nicht geprüft (alle Ereignisse kommen vom selben Gerät); Couch-„Rückgängig“ = Ereignis `undo {id}`.
- Geheimnisse (Wort/Figur/Zahl) werden mit `js/games/secret.js` verschleiert (kein echter Schutz).

## 5. Testen
- Server: `python3 -m http.server 5178 --bind 127.0.0.1` im Repo. Chromium + Playwright sind vorinstalliert.
- `node tests/logic.test.mjs` (Spiellogik), `node tests/smoke.mjs [bilder]` (alle Bildschirme, beide Themes, 340/390/1280 px, ruhige Bewegung), `node tests/fern-galgenmaennchen.mjs`, `node tests/fern-werbinich-zahl.mjs`, `node tests/couch-werbinich-zahl.mjs`.
- Zwei Geräte lokal: `?net=local&ns=a` und `?net=local&ns=b` in **einem** Browser-Kontext (BroadcastChannel).
- Die echte WebSocket-Verbindung zu Supabase ist in der Cloud-Sandbox nicht testbar (Proxy blockt WebSockets). REST-Broadcast mit dem Schlüssel liefert 202 → Realtime ist freigeschaltet.
- Prüf-Seite `#/dev` zeigt alle Bausteine und Maskottchen-Stimmungen.

## 6. Bekannte Fallen
- Theme-Regeln immer mit `:where([data-theme=…])` schreiben (sonst Spezifitäts-Chaos).
- Inline-SVG-Pfade mit `pathLength="1"` + runden Enden zeigen ungezeichnet einen Punkt → `.part` ist bis zum Zeichnen unsichtbar.
- Updates in den Spielansichten laufen über eine Warteschlange (`schedule`), verglichen wird mit dem zuletzt angezeigten Stand (`shown`).
- `navigator.vibrate` erst nach der ersten Berührung (sonst Konsolen-Warnung).
- Neue Dateien → `tests/update-sw.mjs` laufen lassen, sonst fehlen sie offline.

## 7. Ideen für später
- Weitere Spiele (z. B. „Wer kennt wen besser?“, Pantomime-Timer, Montagsmaler).
- Eigene Wörter/Figuren-Listen speichern, Lieblingswörter.
- Bilanz-Verlauf mit Grafik, Abzeichen.
