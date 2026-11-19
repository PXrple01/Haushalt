# Kicherkiste – Bauplan

Private Web-App mit Ratespielen für **Johann** und **Josefine**.
Läuft im Browser, lässt sich wie eine App auf den Home-Bildschirm legen und wird über GitHub Pages veröffentlicht:
**https://pxrple01.github.io/Haushalt/**

---

## Entscheidungen (vom Nutzer bestätigt)

| Thema | Entscheidung |
|---|---|
| Name | **Kicherkiste** |
| Themes | **Baby** (Josefine, extremes Cutecore) und **Lila** (Johann, Neon-Nacht mit Manga-Akzenten). Standard je Person, jederzeit umschaltbar. |
| Start | „Wer spielt?“ mit geteiltem Herz wie in der Watchlist (links pink = Josefine, rechts lila = Johann), aufwendig animiert |
| Modi | **Nebeneinander** (ein Handy, Fragen werden gesprochen) und **Weit weg** (zwei Handys, live verbunden) |
| Live-Verbindung | Supabase Realtime der Watchlist-Cloud: nur Live-Nachrichten (Broadcast + Presence), **keine Datenbank, nichts wird gespeichert** |
| Zahl erraten | Zahlen von **1 bis 100** |
| Namen | Josefine heißt in der App **„Baby“** – der echte Name steht nur auf „Wer spielt?“ (Spitznamen im Zahnrad-Menü änderbar) |
| Technik | Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt. Einzige Bibliothek: Supabase realtime-js (gebündelt in `vendor/`). Schriften lokal. |

---

## Design-System

**Grundidee:** Die Kicherkiste ist eine Spielzeugkiste. Das Herz aus zwei Hälften ist das Markenzeichen – die Hälften greifen wie **Puzzleteile** ineinander („wir passen zusammen“). Jedes Spiel sieht aus wie sein echtes Spielzeug: Galgenmännchen als Kreide-/Stift-Zeichnung, *Wer bin ich?* als Post-it auf der Stirn, *Zahl erraten* als Losnummern-Brett.

### Baby (Josefine) – „Stickerbuch“-Cutecore
| Name | Hex | Rolle |
|---|---|---|
| Zuckerwatte | `#FFE4F2` | Hintergrund |
| Lavendelnebel | `#E9DDFF` | Hintergrund-Verlauf |
| Babyhimmel | `#D9F1FF` | Hintergrund-Verlauf |
| Kaugummi | `#FF5FA8` | Akzent |
| Beere | `#C72A78` | Hauptknöpfe (weiße Schrift) |
| Pflaume | `#5A1E4B` | Text |
| + Minze `#8EE6C1`, Butter `#FFE27A`, Flieder `#B79CFF` | | Erfolg, Sterne, Zweitakzent |

Schriften: **Mochiy Pop One** (kawaii Überschriften), **Nunito** (Text), **Caveat** (Handschrift auf Post-its).
Formensprache: Sticker mit weißem Rand und „Puffy“-Schatten, Washi-Tape, Regenbogen- und Holo-Schimmer, große Rundungen.
Deko: Einhorn-Maskottchen **Kiki**, ziehende Wolken, Glitzer, aufsteigende Herzchen/Blasen, Regenbogen, Schleifen.

### Lila (Johann) – Neon-Nacht mit Manga-Akzenten
| Name | Hex | Rolle |
|---|---|---|
| Nachtviolett | `#160B33` | Hintergrund |
| Samt | `#24124F` | Flächen |
| Mondlicht | `#F3ECFF` | Text |
| Violett | `#9B6BFF` | Hauptknöpfe |
| Neonflieder | `#D19BFF` | Leuchten |
| Cyan | `#47E5FF` | Funken, Fokus |
| + Rosé `#FF6FB5` (Josefine-Akzent), Gold `#FFD36E` (Sieg) | | |

Schriften: **Anton** (Überschriften wie Manga-Titel), **Space Grotesk** (Text), **Caveat** (Post-its).
Formensprache: schräge, kantige Knöpfe, Neon-Kanten, Rasterpunkte (Screentone), Speedlines und japanische Soundwörter („ドン!“) bei großen Momenten, Sternenhimmel mit Sternschnuppen.

### Prinzipien
1. **Ein großer Moment pro Bildschirm**, sonst ruhig und gut lesbar (Text immer kontrastreich).
2. **Bewegung antwortet auf Handlungen**: falscher Buchstabe → Linie zeichnet sich, richtiger → Buchstabe dreht sich um.
3. **Handy zuerst**: große Tippflächen (≥ 48 px), kein seitliches Scrollen bis 340 px Breite, Desktop zentriert.
4. **„Bewegung reduzieren“** wird respektiert (System + eigener Schalter).
5. Texte kurz, aktiv, auf Deutsch, aus Sicht der beiden.

---

## Architektur

```
index.html            App-Hülle, setzt Theme vor dem ersten Zeichnen
manifest.webmanifest  App-Infos fürs Home-Bildschirm-Symbol
sw.js                 Offline-Start (lädt immer zuerst aus dem Netz)
assets/fonts, icons   Schriften (woff2) und App-Symbole
css/                  base, components, themes, scene, screens, games
js/main.js            Start + Router (#/wer, #/lobby, #/spiel/<id>)
js/core/              store, dom, fx (Partikel), sound, theme, ui, net, sync, util
js/screens/           wer (Personenauswahl), lobby, settings
js/games/             hangman, whoami, number, common
js/data/              Wortpool, Figurenpool, Fragen-Ideen
js/art/               SVG-Grafiken (Herz, Einhorn Kiki, Spielzeug-Bilder)
vendor/realtime.js    Supabase realtime-js, gebündelt
tests/                Playwright-Tests (nicht Teil der App)
```

### Spielzustand und Abgleich (beide Modi gleich)
- Jede Partie ist ein **Ereignis-Protokoll** (z. B. „Wort gewählt“, „Buchstabe E geraten“). Der Zustand wird daraus berechnet.
- Ereignisse haben eine Lamport-Uhr → beide Geräte sortieren gleich und kommen zum selben Ergebnis.
- **Weit weg**: neue Ereignisse gehen als Broadcast an das andere Gerät. Beim (Wieder-)Verbinden tauschen beide ihre Protokolle aus (Vereinigung), dadurch geht nichts verloren, auch wenn ein Handy kurz schläft.
- Kanalname = SHA-256 des gemeinsamen Codes → nur wer den Code kennt, landet im selben Raum.
- Presence zeigt „Josefine ist online“ und wo der andere gerade ist. Flüchtige Nachrichten: Reaktionen, „tippt …“, Anstupsen.
- Partien und Duell-Bilanz liegen im localStorage; die Bilanz wird beim Verbinden zwischen den Geräten zusammengeführt.
- Test-Modus `?net=local&ns=a`: Verbindung über BroadcastChannel zwischen zwei Tabs, getrennter Speicher je `ns`.

---

## Spiele im Detail

### Galgenmännchen
- **Einrichten:** Wer versteckt das Wort? Schwierigkeit: Entspannt (11 Fehler, Galgen wird mitgebaut), Mittel (8), Knifflig (6).
- **Wort:** eigenes Wort (Prüfung: Buchstaben inkl. Ä Ö Ü ß, Leerzeichen und Bindestrich erlaubt) oder aus dem **Wortpool** (Kategorien + Leicht/Mittel/Schwer, „Nochmal würfeln“). Optionaler Hinweis, Kategorie kann als Hinweis gezeigt werden.
- **Spielen:** klassischer Galgen als SVG (Hügel, Pfahl, Balken, Stütze, Seil, Kopf, Körper, Arme, Beine). Jeder Fehler zeichnet sich mit Stiftspitze nach (stroke-dashoffset), Figur schwingt leicht, ein Herz zerbricht, Taste wird durchgestrichen. Richtige Buchstaben drehen sich um, mit Glitzer. Tastatur QWERTZ + Ä Ö Ü ß, echte Tastatur am PC. „Ganzes Wort lösen“ (falsch = 1 Fehler).
- **Ende:** Gewinn: Wort hüpft, Konfetti, Figur freut sich. Verlust: X-Augen, restliche Buchstaben erscheinen. „Revanche – Rollen tauschen“.
- **Nebeneinander:** Wort geheim eingeben → Übergabe-Bildschirm „Gib das Handy an …, nicht spicken!“ → raten.
- **Weit weg:** Wortgeber wählt auf seinem Handy, der andere rät auf seinem. Wortgeber sieht jeden Versuch live und schickt Reaktionen (😂 😱 🙈 💖 🔥).

### Wer bin ich?
- Jeder denkt sich **für den anderen** eine Figur aus (eigene oder aus dem **Figurenpool**: Disney & Pixar, Anime, Filme & Serien, Märchen, Promis, Gaming, Superhelden, Tiere).
- Regeln: Ja/Nein-Fragen; bei „Ja“ oder „Vielleicht“ darf man weiterfragen, bei „Nein“ ist der andere dran. Wer weniger Fragen braucht, gewinnt. Aufgeben möglich.
- **Nebeneinander:** Figuren nacheinander geheim eingeben (Übergabe-Bildschirm). Fragen werden **gesprochen**; die App zeigt, wer fragt, zählt die Fragen und hat Antwort-Knöpfe (Ja / Nein / Vielleicht / Erraten!). **Merkzettel** zum Antippen (Mensch, echt, Anime, …: neutral → ✓ → ✗) statt Tippen. Eigene Figur für den anderen zum Spicken gedrückt halten.
- **Weit weg:** beide wählen gleichzeitig. Fragen tippen oder **Schnellfragen** antippen, der andere antwortet mit Knöpfen. „Lösen“: Name eintippen, exakte Treffer zählen sofort, sonst bestätigt der andere. Chatverlauf mit Antwort-Stempeln, „tippt …“-Anzeige.
- **Ende:** beide Post-its ziehen sich ab und zeigen die Figuren, Vergleich der Fragen.

### Zahl erraten (1–100)
- Jeder denkt sich eine Zahl (Ziffernblock, „Zufallszahl“). Abwechselnd **eine** Frage pro Zug. Wer weniger Fragen braucht, gewinnt.
- **Zahlen-Brett** 10 × 10 für jeden: antippen oder darüberwischen zum Durchstreichen.
- **Fragen-Ideen** als Kartenstapel, z. B. „Wäre das mein Alter – dürfte ich in Deutschland Alkohol kaufen? (Bier ab 16)“, „Gibt es diesen Tag in jedem Monat?“, „Ist sie eine Primzahl?“. Karten mit eindeutiger Regel streichen nach der Antwort automatisch die unpassenden Zahlen (mit Rückgängig).
- **Raten** („Ist es 42?“) prüft die App selbst; falsche Zahlen werden gestrichen.
- **Nebeneinander:** Fragen laut stellen, Antwort per Knopf festhalten. **Weit weg:** Frage tippen oder Karte schicken, der andere antwortet per Knopf.
- **Ende:** beide Zahlen rollen als Lose herein, Vergleich der Fragen.

---

## Etappen (Checkliste)

- [x] **0 – Aufräumen:** `main` geleert, alter Pull Request geschlossen. *Offen für den Nutzer:* Branches `haushaltsbuch` und `julipod` auf GitHub löschen.
- [x] **Entscheidungen:** Name, Zahlenbereich, Supabase-Mitbenutzung.
- [x] **1 – Fundament & Design-System:** Ordner, `index.html`, Design-Tokens, beide Themes mit Hintergrund-Szenen, Komponenten (Knöpfe, Umschalter, Chips, Blätter, Meldungen, Übergabe-Bildschirm), Partikel/Konfetti, Töne, Schriften, App-Symbol, PWA. Prüf-Seite `#/dev` für Screenshots.
- [x] **2 – „Wer spielt?“ + Lobby:** Puzzle-Herz-Animation (hereinfliegen, einrasten, Herzschlag, teilen), Auswahl verwandelt die App ins Theme. Lobby mit Begrüßung, Modus-Schalter, drei Spielzeug-Karten, Duell-Bilanz, Einstellungen.
- [x] **3 – Modi + Live-Verbindung:** Code-Eingabe, Verbindungsstatus, Presence, Einladungen, Ereignis-Abgleich, Wiederverbinden, Doppelt-gewählt-Warnung, lokaler Test-Transport.
- [x] **4 – Galgenmännchen**
- [x] **5 – Wer bin ich?**
- [x] **6 – Zahl erraten**
- [x] **7 – Feinschliff:** Duell-Bilanz, Töne/Vibration-Schalter, Barrierefreiheit (Kontrast, Fokus, Screenreader-Ansagen), Texte, Fehlerzustände, Desktop-Ansicht.
- [x] **8 – Testen:** Playwright: alle Abläufe, beide Themes, beide Modi, zwei Geräte, 340/390 px + Desktop, keine Konsolenfehler, kein seitliches Scrollen. Screenshots kritisch ansehen.
- [ ] **9 – Veröffentlichen:** auf `main` pushen, GitHub Pages einschalten lassen, Deployment prüfen, Link + Kurzanleitung an den Nutzer. `UEBERGABE.md` für spätere Sitzungen schreiben.

## Test-Checkliste (vor jeder Veröffentlichung)
- Keine Fehler in der Konsole, kein seitliches Scrollen (340 px, 390 px), Desktop zentriert.
- Beide Themes auf jedem Bildschirm, „Bewegung reduzieren“ aus/an.
- Jedes Spiel: Nebeneinander komplett durchspielen (Gewinn + Verlust), Weit weg mit zwei Geräten inkl. Neuladen mitten im Spiel.
- Umlaute/ß im Galgenmännchen, Eingabeprüfung, Rückgängig beim Zahlen-Brett.
