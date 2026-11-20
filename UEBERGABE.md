# Übergabe für spätere Sitzungen – Kicherkiste

Stand: 19.11.2026, Version 2.0 (Cache `kicherkiste-v3`): + Pantomime, Kritzelspiel, Herzchen versenken, Escape-Abenteuer. Bauplan mit Design-System und Etappen: `PLAN.md`.

## 1. Was das Projekt ist
- Private PWA mit sieben Spielen für Johann (`joh`) und Josefine (`jos`), Sprache Deutsch: `hangman`, `whoami`, `number`, `mime` (Pantomime), `draw` (Kritzelspiel – nicht „Montagsmaler“ nennen!), `ships` (Herzchen versenken), `escape` (Escape-Abenteuer, kooperativ).
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
- `js/data/`: Grundpools + große Erweiterungen in `*-more.js` (werden beim Laden zusammengeführt, Dopplungen fliegen raus): Wörter ~4000 (`words.js` + `words-more.js`), Figuren ~2300 (`characters.js` + `characters-more.js`), Begriffe Pantomime/Kritzelspiel je ~1200 (`terms.js` + `terms-more.js`, `!` = schwer, `~` = leicht), Fragen-Ideen 159 mit Regeln `test(n)` und Kategorien (`questions.js` + `questions-more.js`). `tests/logic.test.mjs` prüft alle Einträge (Galgenmännchen-Wörter nur Buchstaben/Leerzeichen/Bindestrich, keine Kommas in Namen).
- Neue Spiele hängen in `js/games/registry.js` (LOGIC/VIEW), `js/games/info.js` (Titel), `js/core/sync.js` (`GAMES` zur Prüfung), `js/core/router.js` (Route `#/neu/<spiel>`) und in der Lobby.
- Rundenspiele (Pantomime, Kritzelspiel): gemeinsame Logik `js/games/rounds.js`, Oberfläche `rounds-ui.js` (Einstellungen, Punkte-Leiste, Ring-Timer, 3-2-1, Vorhang). Leinwand `js/games/draw/canvas.js` (Koordinaten 0–1000, Striche vereinfacht), Kunstbuch lokal (`kunstbuch`).
- Herzchen versenken: `js/games/ships/` (8×8, Flotte verschleiert, Treffer = nochmal, Bombe 3×3), Figuren-SVGs in `art.js`. Zwei Flotten (`FLEETS`: klassisch/kurvig, im `setup`-Ereignis `fleet`). Figuren = Felder in Grundform (`SHAPES`), Lage `o` = Index in `orientsOf(id)` (Drehen + Spiegeln, mit `rot`/`flip` für die Grafik); alte Partien mit `dir: 'h'|'v'` gelten weiter. Achtung: `--cell` erst setzen, wenn das Meer im DOM ist (`setBody` räumt alte Meere weg).
- `vendor/realtime.js` = `@supabase/realtime-js` 2.119.1, mit esbuild gebündelt (nur `RealtimeClient`).

## 4. Abgleich (wichtig!)
- Jede Partie = Liste von Ereignissen `{id, n (Lamport), by, t, ty, d}`; Zustand wird immer neu berechnet. Sortierung `(n, by, id)`.
- Fern-Modus: neue Ereignisse per Broadcast (`ev`), beim Verbinden `hello` (Anzahl je Partie + Bilanz) → fehlende Partien per `sync`. Flüchtig: `fx` (Reaktionen, tippt …, Anstupsen).
- Kanal = `kk-` + SHA-256(`kicherkiste:` + Code). Supabase-URL + öffentlicher Schlüssel (`sb_publishable_…`) stehen in `js/core/net.js` – derselbe öffentliche Schlüssel wie in der Watchlist, nur für Live-Kanäle. **Nichts wird in der Datenbank gespeichert.**
- Im Couch-Modus wird `e.by` nicht geprüft (alle Ereignisse kommen vom selben Gerät); Couch-„Rückgängig“ = Ereignis `undo {id}`.
- Geheimnisse (Wort/Figur/Zahl) werden mit `js/games/secret.js` verschleiert (kein echter Schutz).

## 4b. Escape-Abenteuer (`js/games/escape/`)
- Immer **zwei Handys** (Modus wird beim Öffnen auf „Weit weg“ gestellt, wenn ein Code da ist). Rollen je Raum: `handsOf(st, r)` = `r % 2 ? andere(first) : first`. Nur „Hände“ dürfen `act` senden (im Reducer geprüft).
- Rätsel entstehen aus dem Seed (`rng.js`, mulberry32) – beide Geräte rechnen dasselbe, nichts Geheimes wird verschickt. `puzzles.js` = 7 Arten (lock, wires, maze, echo, potion, safe, lineup) mit `gen/init/apply/hints/solution`.
- `themes.js` = 7 Geschichten (je 4 Räume, Texte, Farben `pal`, Symbole, Zutaten/Dinge/Figuren als „skin“). Grammatik: Geschlechter vermeiden (Nummern statt „der zweite Faden“), `goalTo` = „zum/zur …“.
- `logic.js`: Ereignisse `setup {theme,diff,seed,first}`, `ready`, `act {r,k,…}`, `hint {r,n}` (n verhindert Doppel-Tipps), `next {r}`, `cont`, `giveup`, `abort`. Zeit: `elapsed()` (Pause zwischen Räumen), Strafen 20 s/5 s/60 s, `timeUp()`, `starsOf()`.
- Oberfläche: `view.js` (Auswahl, Intro mit Schreibmaschine, Tür-Übergang, „Raum geschafft“, Zeit um, Finale, Rekorde `escapeRecords`), `rooms.js` (je Art Hände- und Wissen-Ansicht), `art.js` (Szenen, Figuren), `symbols.js` (30 Symbole, 9 Farben), Stil `css/escape.css`.

## 5. Testen
- Server: `python3 -m http.server 5178 --bind 127.0.0.1` im Repo. Chromium + Playwright sind vorinstalliert.
- `node tests/logic.test.mjs` (Spiellogik inkl. Escape: alle Rätsel lösbar und gleich auf beiden Geräten), `node tests/smoke.mjs [bilder]` (alle Bildschirme, beide Themes, 340/390/1280 px, ruhige Bewegung), `node tests/fern-galgenmaennchen.mjs`, `node tests/fern-werbinich-zahl.mjs`, `node tests/couch-werbinich-zahl.mjs`, `node tests/fern-herzchen.mjs`, `node tests/fern-pantomime.mjs`, `node tests/fern-kritzelspiel.mjs`, `node tests/couch-neue-spiele.mjs [bilder] [breite]` (Kritzelspiel, Pantomime, Herzchen versenken auf einem Handy, mit Neuladen).
- Escape: `node tests/fern-escape.mjs [bilder] [geschichte] [stufe]` spielt eine Geschichte komplett über die Oberfläche durch (mit Fehlern und Tipp, `RUHIG=1` für reduzierte Bewegung); `node tests/fern-escape-zeit.mjs` prüft Zeit um, Weiterspielen, Aufgeben, Beenden.
- Zwei Geräte lokal: `?net=local&ns=a` und `?net=local&ns=b` in **einem** Browser-Kontext (BroadcastChannel).
- Die echte WebSocket-Verbindung zu Supabase ist in der Cloud-Sandbox nicht testbar (Proxy blockt WebSockets). REST-Broadcast mit dem Schlüssel liefert 202 → Realtime ist freigeschaltet.
- Prüf-Seite `#/dev` zeigt alle Bausteine und Maskottchen-Stimmungen.

## 6. Bekannte Fallen
- Theme-Regeln immer mit `:where([data-theme=…])` schreiben (sonst Spezifitäts-Chaos).
- Inline-SVG-Pfade mit `pathLength="1"` + runden Enden zeigen ungezeichnet einen Punkt → `.part` ist bis zum Zeichnen unsichtbar.
- Updates in den Spielansichten laufen über eine Warteschlange (`schedule`), verglichen wird mit dem zuletzt angezeigten Stand (`shown`).
- `navigator.vibrate` erst nach der ersten Berührung (sonst Konsolen-Warnung).
- Neue Dateien → `tests/update-sw.mjs` laufen lassen, sonst fehlen sie offline.
- Overlays (Übergabe, Dialoge, Blätter, Vorhang, Countdown, Escape-Türen) räumt der Router bei jedem Bildschirmwechsel weg (`clearOverlays` in `ui.js`). Wartender Code in Spielansichten prüft `alive`, damit nach dem Verlassen nichts mehr auftaucht.
- View Transitions: Namen (`view-transition-name`) nie doppelt vergeben – sonst bricht der Übergang ab. Escape setzt `es-hero`/`es-sheet` nur für die Dauer des Karten-Übergangs.

## 7. Ideen für später
- Weitere Spiele (z. B. „Wer kennt wen besser?“), weitere Escape-Geschichten (neues Objekt in `themes.js` mit 4 Räumen genügt) oder neue Rätsel-Arten (in `puzzles.js` + `rooms.js`).
- Eigene Wörter/Figuren-Listen speichern, Lieblingswörter.
- Bilanz-Verlauf mit Grafik, Abzeichen.
