# Flow Striker – Custom-Skin-Mod für Yunara (League of Legends)

Eigener Mod für den **CSLoL Manager**. Er ersetzt Yunaras Standard-Skin (nur bei dir sichtbar).
Alle neuen Grafiken (Fußball, Ketten, Ego-Bestie, Spielfeld-Linien) sind selbst erstellt.

## Was Version 0.12.0 enthält

| Teil | Änderung |
|---|---|
| Ego-Bestie als Schattenkörper (neu in v0.12) | das Biest **gleitet nicht mehr über den Boden** (seine Füße standen vorher ~120 Einheiten über dem Boden, nur der Schwanz berührte ihn): es ist jetzt ein **schwebender Schattenkörper** – die Beine lösen sich ab den Oberschenkeln in Rauch auf (Rand glimmt violett-grün), violett schimmernder Rauch zieht unter ihm, ein Schattenpool liegt unter beiden. Es schwebt mit leichtem Auf und Ab, gleitet zur Seite und **neigt sich dabei in die Bewegung**. **Schwere Arme**: die Arme werden physikalisch nachgezogen (hängen schwer, schwingen nach und pendeln aus). **Gewicht**: bei jedem Schlag (Brüllen, Brusttrommeln, Aufschlagen, Klauenhieb, Schrei) sackt der ganze Körper ein und federt zurück, und unter ihm läuft ein **Bodenstoß** – Schockring, glühende Risse, aufgewirbelter Staub, bei den großen Schlägen zusätzlich ein Ring auf dem echten Boden |
| Quadrakill (neu in v0.12) | **3,5 s nach dem 4. Kill** (falls noch ein Penta folgt, erscheint er gar nicht): ein violetter Flutlichtkegel fällt von hoch oben auf ihn, seine Ego-Anzeige lodert violett auf (Flammen, Funken) |
| Pentakill (neu in v0.12) | die **Ego-Bestie erscheint riesig** weit hinter ihm, bäumt sich auf und brüllt (Schockringe, Bodenstoß), ein **goldener Pokal aus Licht** steigt über ihm auf und dreht sich, **Blitzlichter wie im Stadion** rundherum, und auf **deinem Bildschirm** schießen Ketten in die Ecken und **zerspringen** (nur du siehst sie). Nie Quadra und Penta übereinander: der Penta ersetzt den noch wartenden Quadra-Effekt |
| So erkennt der Skin Multikills | wie Riot es selbst macht (gefunden in Riots Daten): Yunaras „Kontext-Aktionen“ haben schon eine Pentakill-Regel (Sprachausgabe, wie bei Samira); eine Regel kann auch eine Animation starten (Xayah/Rakan). Wir starten eine **unsichtbare Träger-Animation** auf einer eigenen Spur mit Null-Gewichten (wie Master Yis Wuju-Spuren) – sie bewegt nichts und unterbricht weder Laufen noch Angriffe, löst aber den Effekt aus. Kommt der Penta, ersetzt sein Träger-Clip den des Quadra, und der noch wartende Quadra-Effekt wird mit ihm beendet |
| Ego-Bestie lebendiger (v0.11) | das Biest steht nicht mehr steif da: es **schleicht** hinter ihm nach links und rechts hin und her (echter Lauf-Zyklus, dreht sich weich in die Laufrichtung und wieder zurück), **atmet** sichtbar (Brustkorb hebt sich, Hüfte federt), **sieht sich um** (Kopf und Hals drehen und neigen sich), wiegt Schultern und Arme leicht – auch während der Aktionen läuft eine leichte Grundbewegung weiter. Die Adern **pulsieren wie ein Herzschlag**, dunkler Rauch umhüllt es und grüne Glut steigt auf. Die Ausrichtung bleibt fest in der Welt: dreht er sich, dreht sich das Biest nicht mit |
| Die Ult: Ego-Bestie (v0.10) | die Ego-Bestie ist jetzt **die** Ult (alle anderen Ult-Vorschläge sind entfernt). Beim Drücken von R zerspringen die Ketten um seinen Körper, das Biest kriecht hinter ihm aus einem Schattenpool und **bleibt die ganzen 15 Sekunden hinter ihm**: es folgt ihm überallhin, dreht sich aber nie mit, wenn er sich dreht. Dabei verhält es sich wie ein Biest – 12 Bewegungen aus Meshys Katalog zu einer Choreografie verbunden: brüllen (die Ketten an seinen Klauen zerspringen), geduckt lauern und sich umsehen, auf die Brust trommeln, schwer atmen, aufstampfen (Schockwellen + Staub), Klauenhieb, mit ausgebreiteten Armen brüllen, wieder stampfen – zum Ult-Ende stürzt es sich kopfüber in ihn, genau wenn die Bildschirm-Ketten zerspringen |
| Erwachte Ult-Form (neu in v0.9) | während der Ult verändert sich der Stürmer selbst: lila glühende Haarspitzen, leuchtende Trikot-Säume und -Nähte, eine Kapitänsbinde mit „C“ am linken Oberarm, dazu violette Funken aus Haaren und Schultern. Technisch eine zweite Textur auf einer eingeblendeten Modell-Ebene (Riots `materialOverride` + Buff-Bedingung, wie die Metavision-Augen) |
| Ego-Bestie animiert (v0.9) | das Biest ist ein echtes animiertes Modell (Meshy: Modell, Textur, Skelett, Bewegungen) als animiertes Effekt-Modell wie bei Riot (Aurora, Ambessa …): es kriecht aus dem Schattenpool, richtet sich auf, brüllt geduckt, holt aus und wirft sich kopfüber in ihn hinein. Obsidian-violette Haut mit grün glühenden Adern, Augen und Hornspitzen. Eigene Schreiber für Skelett (`.skl`) und Animation (`.anm`), mit Riots Dateien gegengeprüft |
| Dribbeln (v0.9) | beim Laufen tippt er bei jedem Bodenkontakt einen Ball an, abwechselnd links und rechts; der Ball läuft ihm voraus und kommt zum nächsten Fuß zurück |
| Ego-Anzeige (v0.9) | über dem Kopf eine Leiste mit 8 Rauten – eine pro Q-Ladung (Yunaras Q sammelt bis zu 8, sichtbar an ihren 8 Perlen = bei uns die Fußbälle); füllt sich von Grün zu Violett, bei voll lodert die Leiste |
| Kontrolllauf Animationen (v0.9) | alle 72 Animationen neu geprüft (Verdrehung von Hüfte/Knie/Knöchel, Falten/Quetschungen im Modell, schlimmstes Bild jeder Animation von zwei Seiten). Das „verdrehte Bein“ im Vorschauvideo war ein Fehler des Vorschau-Renderers (zeichnete Rückseiten), nicht des Modells – behoben. Riots Comic-Schlageffekt (Hand/Unterarm für 2–3 Bilder bis x1,8–3,1 vergrößert) auf höchstens +25 % begrenzt |
| Vorschau (v0.9) | Video „Mimik + Blinzeln“: jede Animation mit dem Gesicht, das sie im Spiel zeigt |
| Ketten am Bildschirm (v0.8) | während der ganzen Ult (15 s) hängen in den vier Ecken **deines eigenen Bildschirms** Ketten: sie schießen hinein, bohren sich mit Pflöcken ins Bild und werden ruckartig festgezogen, zucken danach immer wieder unter Spannung, Licht läuft über die Glieder, Funken knistern; kurz vor Ult-Ende glühen sie auf und sprengen sich weg. Nur du siehst sie (gleiche Technik wie Riots Bildschirm-Effekte bei Vi, Yone und Aatrox: an die Kamera geheftet, nur für den Besitzer sichtbar) |
| Recall: Torjubel (v0.8) | beim Zurückkehren baut sich ein Tor aus Licht um ihn auf, er jongliert den Ball, am Ende bauscht sich das Netz, Konfetti fliegt |
| Laufspuren (v0.8) | bei jedem Schritt (genau auf den Bodenkontakt der Laufanimation) Kreide-Striche und Rasen-Fetzen |
| Q: Flow-Aura (v0.8) | während Q steigen weiß-violette Funken von Haaren, Schultern und Füßen auf, dazu leuchtende Nachbild-Fußabdrücke |
| Respawn: Anstoß (v0.8) | Mittelkreis zeichnet sich auf den Boden, Flutlichtkegel fällt auf ihn, Ball auf dem Anstoßpunkt |
| Tod: Abpfiff (v0.8) | Pfiff-Wellen, Pfeifen-Symbol, graue Schockwelle, der Ball rollt davon, das Augenleuchten erlischt |
| Blinzeln (v0.8) | eigene „Augen zu“-Ebene (Meshy-Bearbeitung des eigenen Gesichts), wird in Steh- und Laufanimationen regelmäßig kurz eingeblendet |
| Ladebildschirm (v0.8) | neues Anime-Keyart (Volley mit grün glühendem Ball, Flutlicht, berstende Ketten), mit Meshy aus dem eigenen Render erzeugt |
| Gesichtsausdrücke (v0.7) | 7 Ausdrücke aus Meshy-Bildbearbeitungen des eigenen Gesichts: konzentriert (Angriffe, E), Kampfschrei (Krits, W, R-W), Grinsen (Spott, Witz, Rückkehr), Lachen (Tanz), Schmerz (Tod, Hochgeschleudert); werden pro Animation über Riots Submesh-Events eingeblendet. Q-Flow: weiß-violett leuchtende Augen mit Muster-Iris, Ult: grüne Metavision-Augen |
| Textur-Fehler behoben (v0.7) | Farbschmierer an Texturnähten (z. B. lila Strich auf dem Unterarm), Flecken auf Arm- und Handgelenkbändern, Nahtlinien (Kanten-Padding), einfarbige Bänder |
| Farben (neu in v0.6) | Stürmer in Blau-Lila: königsblaues Trikot, violette Akzente (Kragen, Ärmelsäume, Stutzenstreifen, Schnürsenkel, Wappen), tiefviolette Shorts, indigo Strumpfhose, dunkelblaue Haare mit violettem Schimmer; Bernsteinaugen bleiben. Effekte bleiben dunkelgrün |
| Q als Flow-Zustand (neu in v0.6.1) | alle Q-Effekte in Weiß → Lavendel → Violett mit weichen Übergängen (helle Kerne weiß, verblassende Ränder violett): Licht wird in den Stürmer gesogen und bricht aus, danach leuchtender weiß-violetter Konturrand um den ganzen Körper, aufsteigende Lichtschleier, violetter Schein, Funkeln, Konturen-Nachbilder beim Bewegen, Lichtspuren hinter Händen und kreisenden Bällen; Q-Bälle und Q-Treffer weiß-violett |
| Animationen geprüft (v0.6.1) | alle 72 Animationen Bild für Bild am Modell geprüft (Vorschauvideo); Riots extreme Dehn-Effekte (Arme/Beine/Wirbelsäule bis +80 %) auf ±10 % begrenzt, damit nichts gestreckt oder kaputt aussieht |
| Ult-Aura (neu) | alle ~1,4 s gleitet ein Scanner-Ring über den Stürmer („METAVISION liest das Spiel“) |
| Modell (neu in v0.5) | viel detaillierterer Anime-Stürmer (eigenes Design, mit Meshy erzeugt): dunkelgrüne, zur Seite gestylte Haare, bernsteinfarbene Augen, dunkelblaues Trikot mit weißer Schärpe und Wappen, lange dunkelblaue Strumpfhose unter den Shorts, weiße Stutzen mit grünen Streifen, schwarze Stollenschuhe – mit seinen eigenen Anime-Proportionen |
| Eigenes Skelett (neu) | die Knochen sitzen an den Gelenken des Stürmers; alle 72 Animationen von Yunara werden beim Bauen darauf umgerechnet (gleiche Bewegungen, Bein- und Armlängen angepasst, Füße bleiben am Boden) |
| Licht & Textur (neu) | Licht mit echten Schatten und Umgebungsverdeckung vom 680.000-Dreiecke-Originalmodell gebacken, 3-stufige Anime-Schattierung (kühle Stoffschatten, warme Hautschatten), flach beleuchtetes Gesicht mit Haarschatten, feine Randlicht-Kante in Flow-Grün; eigenes Vereinswappen auf beiden Ärmeln, KI-Artefakte (markenähnliches Logo, Fantasie-Abzeichen) entfernt |
| Ladebildschirm & Icons | neu gerendert mit dem neuen Modell (Volleyschuss + Porträt) |
| Konturlinie | Anime-Outline als Hülle im Modell (Riot blendet Rückseiten aus – sieht man an Yunaras doppelseitigem Stoff) |
| Effekte v0.4 | Fußball-Geschosse mit Glanz + Funkenspur (immer rund), Treffer mit Blitz, Ring, Funken und abprallendem Ball, Krits mit Anime-Aufprallbild + Tornetz, Q mit Lichtsäule + Aura, Sprint mit Nachbildern, Ult mit Speedlines beim Kettenbruch, 15-s-Aura mit Taktik-Ring |
| Älteres Modell | der selbst gebaute Stürmer v2 (ohne Meshy) ist weiter im Projekt: `{"model": "striker2"}` in `assets_src/char/model.json` |
| Perlen um den Körper | werden zu 8 echten 3D-Fußbällen (schwarz-weiß) |
| Normale Angriffe, Krits, Q-Angriffe, W | Geschosse sind drehende Fußbälle |
| Q / W | Fußbälle mit dunkelgrünem „Flow“-Leuchten |
| Alle Effekte | Farben auf Dunkelgrün umgestellt |
| Ult (R) aktiv | die 8 Fußbälle bekommen leuchtende Nähte |
| Ult-Aktivierung | Ketten um den Körper → werden gesprengt (Blitz, Splitter, Schockwelle) → die Ego-Bestie steigt hinter ihm auf |
| W während der Ult | Fußball mit leuchtenden Nähten |

## Installieren (CSLoL Manager)

1. CSLoL Manager öffnen.
2. Auf **„Add mod“** (Plus-Symbol) klicken und `FlowStriker_Yunara_v0.12.0.fantome` auswählen.
3. Häkchen beim Mod setzen, dann **„Run“** drücken.
4. League starten und im Übungstool Yunara mit dem **Standard-Skin** spielen.

Der Mod ist für den Standard-Skin gedacht. Wenn du einen anderen Yunara-Skin spielen willst, schalte ihn vorher ab.

### Ketten am Bildschirm prüfen

Die Ketten hängen an der Kamera. Falls sie bei deiner Bildschirmauflösung nicht genau in den Ecken sitzen
(z. B. bei Ultrawide-Monitoren), schick einen Screenshot während der Ult – die Position ist eine Zahl im Build
(`tools/screen_chains.py`: `HALF_W`, `HALF_H`, `CHAIN_S`).

### Falls das Spiel abstürzt

1. CSLoL Manager auf die neueste Version aktualisieren (nach LoL-Patches die häufigste Ursache).
2. Ältere Versionen dieses Mods im CSLoL Manager entfernen, nur eine Version aktivieren.
3. Zum Eingrenzen nacheinander die Testpakete probieren (`build/FlowStriker_TEST_nur-Modell_*.fantome` und
   `FlowStriker_TEST_nur-Effekte_*.fantome`, jeweils allein aktiv) und die Log-Datei
   `League of Legends/Logs/GameLogs/<neuester Ordner>/…_r3dlog.txt` mitschicken.

v0.5.1: alle Texturen jetzt im DXT-Format wie bei Riot (vorher unkomprimiert), Ladebildschirm/Icons ohne Mipmaps
wie im Original, Modell-Datei mit Riots Endmarke; Paket 11 statt 24 MB.

Custom Skins sind von Riot nicht offiziell erlaubt – Nutzung auf eigenes Risiko. Nach LoL-Patches kann ein Update nötig sein.

## Vorschau

![Neues Ladebild (v0.8)](previews/loadscreen_v0.8.png)

Vorschauvideos (Simulation): `build/Ult_Ego-Bestie_v0.12.mp4` (die ganze Ult, 16 s: er läuft und dreht sich, das Biest
bleibt als schwebender Schattenkörper hinter ihm), `Multikills_v0.12.mp4` (Quadra; Quadra + Penta 2 s später), `Extras_v0.9.mp4` (Dribbeln, Ego-Anzeige, erwachte Form, Recall, Respawn, Tod) und
`Mimik_Blinzeln_v0.9.mp4`.

![Ladebildschirm](previews/striker_v0.6_loadscreen.png)

![Rundum-Ansicht](previews/striker_v0.6_turnaround.png)

![Posen mit Yunaras umgerechneten Animationen](previews/striker_v0.6_poses.png)

![Q – Flow-Zustand (Simulation)](previews/effects_v0.6.1_q_flow.gif)

Vorschauvideo mit allen 72 Animationen: `tools/char/anim_video.py` (siehe unten).

![Effekte (Simulation)](previews/effects_v0.4.gif)

## Selbst neu bauen

```bash
tools/fetch_game_files.sh /tmp/yunara
git clone https://github.com/CommunityDragon/CDTB /tmp/cdtb
python3 tools/fetch_wad.py /tmp/yunara/Yunara.wad.client /tmp/cdtb
python3 tools/extract_wad.py /tmp/yunara/Yunara.wad.client /tmp/yunara
cd tools && python3 make_assets.py && python3 build_mod.py /tmp/yunara      # "all" als 2. Argument baut auch die Testpakete
```

Benötigt: Python 3, `pip install numpy pillow xxhash pyritofile pyzstd`. Ergebnis liegt in `build/`.
Die Zeilen 2–4 holen Yunaras Skelett und Animationen aus Riots Spielarchiv; der Build rechnet sie auf das Skelett des
Stürmers um. Riots Dateien landen nie im Repository.

## Aufbau

- `tools/lolbin.py` – liest/schreibt League-`.bin`-Dateien (Effekt-Definitionen)
- `tools/lolskn.py` – liest/schreibt das Modell (`.skn`)
- `tools/make_assets.py` – erzeugt alle eigenen Grafiken (`assets_src/gen/`)
- `tools/build_mod.py` – baut daraus die `.fantome`-Datei
- `assets_src/fonts/` – Schrift „Big Shoulders“ (SIL Open Font License)
- `tools/char/` – Modell-Pipeline des Stürmers: `design.py` (Formen per Signed-Distance-Modellierung),
  `blender_mesh.py` / `blender_bake.py` / `blender_rig.py` (Blender als Python-Modul: Aufräumen, UVs,
  Baken, Gewichte), `texture.py` (Anime-Bemalung), `animtest.py` (Test mit echten Animationen),
  `run_all.sh` (alles neu erzeugen). Ergebnis liegt in `assets_src/char/`.
- `tools/char/*2.py`, `run_v2_all.sh` – Modell v2 (Finger, Stollen, Cycles-Licht-Bake, Textur v2, Rig mit Fingern);
  `blender_render.py` + `compose.py` – Cycles-Renders, Ladebildschirm und Icons
- `tools/vfxsim.py`, `tools/vfx_preview.py` – Effekt-Simulator für Vorschau-GIFs (Näherung, nicht das Spiel)
- `tools/char/import_model.py` + [MODEL_SWAP.md](MODEL_SWAP.md) – anderes Modell einsetzen
- `tools/fetch_wad.py` – lädt Yunaras Spielarchiv direkt von Riots Update-Server (für Skelett/Animationen)
- `tools/extract_wad.py` – holt daraus Skelett, Animationsgraph und alle Animationen für den Build
- `tools/ult_beast.py` – die Ult: Ego-Bestie als dauerhaftes System am R-Buff (folgt ihm, dreht sich nicht mit) + die
  Effekte zu ihren Aktionen; `tools/vfxshapes.py` – gemeinsame Formen und Hologramm-Look;
  `tools/char/vfx_mesh.py` macht aus Meshy-Modellen leichte Effekt-Meshes
- `tools/char/anim_video.py` + `posebin.py` + `tools/ltk_pose_dump/` (C#, LeagueToolkit) – Vorschauvideo: jede Animation
  exakt ausgewertet am Modell, danach die Effekte
- `tools/bcn.py` – DXT1/DXT5-Kodierung der Texturen (wie Riot), `tools/validate_bin.py` – prüft Bins gegen Riots Klassenschema
- `tools/char/meshy_prep.py`, `meshy_repose.py`, `meshy_bake.py`, `meshy_texture.py` – Pipeline für das Meshy-Modell:
  reduzieren (682.000 → 26.000 Dreiecke), Arme/Beine in Yunaras Grundpose drehen, Licht vom Originalmodell backen,
  Anime-Schattierung + Textur-Aufräumen (siehe [MODEL_SWAP.md](MODEL_SWAP.md))
- `tools/screen_chains.py` – Ketten-Overlay an den Bildschirmecken (Kamera-gebunden, nur für den Spieler, am R-Buff);
  `tools/char/screen_overlay.py` simuliert es für die Videos
- `tools/general_fx.py` – Recall-Torjubel, Laufspuren, Dribbeln, Ego-Anzeige, Q-Aura + Nachbild-Abdrücke, Aura der
  erwachten Form, Respawn-Anstoß, Tod-Abpfiff
  (Riots Partikel-Events in den Animationen bzw. Buff-Bedingungen); `tools/char/extras_video.py` – Vorschauvideo
- `tools/multikill_fx.py` – Quadra/Penta: eigene Kopie von Yunaras Kontext-Aktionen (Multikill-Regeln starten
  unsichtbare Träger-Clips auf einer Effekt-Spur), Flutlicht, Ego-Lodern, Penta-Bestie, Licht-Pokal, Blitzlichter,
  Bildschirm-Ketten; `tools/extract_wad.py` holt dafür auch die Riot-Datei mit den Kontext-Aktionen;
  `tools/char/multikill_video.py` – Vorschauvideo
- `tools/lolrig.py` – schreibt Skelette (`.skl`) und Animationen (`.anm` v4) im Riot-Layout; `tools/animmesh.py` liest sie
  für die Vorschau; `tools/beast_anim.py` + `tools/char/beast_extract.py` – Meshy-Biest (Rig + 13 Bewegungen inkl. Laufen) → animiertes
  Effekt-Modell mit 15-s-Choreografie (Schweben, Gleiten mit Neigung, Atmen/Umsehen, schwere Arme als Feder-Simulation, Einsacken bei Schlägen) + kurzer Penta-Auftritt; `tools/char/beast_video.py` – Vorschauvideo der ganzen Ult
- `tools/char/awakened.py` – Textur der erwachten Form + Liste der betroffenen Dreiecke
- `tools/char/anim_check.py` – Kontrolllauf aller Animationen (Gelenk-Verdrehung, Falten/Quetschungen);
  `tools/char/face_video.py` – Video Mimik + Blinzeln
- `tools/check_package.py` – prüft ein fertiges Paket: WAD-Sortierung + Prüfsummen, Bins gegen das Klassenschema und
  gegen alle Feld-Kombinationen, die Riot selbst in seinen Skins benutzt
- `tools/char/custom_skeleton.py` – eigenes Skelett (Yunaras Datei, nur Gelenkpositionen geändert) und Umrechnung der
  Animationen (alle drei Riot-Formate, Rotationen bleiben bitgenau)
