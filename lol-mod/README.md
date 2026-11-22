# Flow Striker – Custom-Skin-Mod für Yunara (League of Legends)

Eigener Mod für den **CSLoL Manager**. Er ersetzt Yunaras Standard-Skin (nur bei dir sichtbar).
Alle neuen Grafiken (Fußball, Ketten, METAVISION-Auge, Spielfeld-Linien) sind selbst erstellt.

## Was Version 0.1 enthält

| Teil | Änderung |
|---|---|
| Perlen um den Körper | werden zu 8 echten 3D-Fußbällen (schwarz-weiß) |
| Normale Angriffe, Krits, Q-Angriffe, W | Geschosse sind drehende Fußbälle |
| Q / W | Fußbälle mit violettem „Flow“-Leuchten |
| Alle Effekte | Farben auf Dunkelblau-Lila umgestellt |
| Ult (R) aktiv | die 8 Fußbälle bekommen leuchtende Nähte |
| Ult-Aktivierung | Ketten um den Körper → werden gesprengt (Blitz, Splitter, Schockwelle) → über dem Kopf öffnet sich ein Auge, der Ring um die Pupille ist der Schriftzug **METAVISION** → zerfällt in Lichtlinien, die ein Spielfeld auf den Boden zeichnen |
| W während der Ult | Fußball mit leuchtenden Nähten |

## Installieren (CSLoL Manager)

1. CSLoL Manager öffnen.
2. Auf **„Add mod“** (Plus-Symbol) klicken und `FlowStriker_Yunara_v0.1.0.fantome` auswählen.
3. Häkchen beim Mod setzen, dann **„Run“** drücken.
4. League starten und im Übungstool Yunara mit dem **Standard-Skin** spielen.

Custom Skins sind von Riot nicht offiziell erlaubt – Nutzung auf eigenes Risiko. Nach LoL-Patches kann ein Update nötig sein.

## Selbst neu bauen

```bash
tools/fetch_game_files.sh /tmp/yunara
cd tools && python3 make_assets.py && python3 build_mod.py /tmp/yunara
```

Benötigt: Python 3, `pip install numpy pillow xxhash`. Ergebnis liegt in `build/`.

## Aufbau

- `tools/lolbin.py` – liest/schreibt League-`.bin`-Dateien (Effekt-Definitionen)
- `tools/lolskn.py` – liest/schreibt das Modell (`.skn`)
- `tools/make_assets.py` – erzeugt alle eigenen Grafiken (`assets_src/gen/`)
- `tools/build_mod.py` – baut daraus die `.fantome`-Datei
- `assets_src/fonts/` – Schrift „Big Shoulders“ (SIL Open Font License)
