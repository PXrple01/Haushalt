# Charaktermodell austauschen

Der Mod ist so gebaut, dass das Modell ein **austauschbarer Baustein** ist. Alle Effekte hängen an
Yunaras **Skelett** (Knochennamen) oder an den Modellteil-Namen `Body`/`Pants` – sie funktionieren
mit jedem Modell weiter.

## Was das neue Modell mitbringen sollte

- humanoid, aufrecht, Blick nach vorne
- am besten **A-Pose** (Arme ~45° nach unten). T-Pose geht auch, wenn das Modell ein Skelett hat
  (Option `--repose` dreht die Arme dann automatisch in Yunaras Pose)
- Format `.glb`, `.gltf`, `.fbx` oder `.obj`, mit Textur
- du brauchst die Rechte am Modell (eigenes Modell oder passende Lizenz)

## So geht der Wechsel

```bash
cd tools/char
python3 import_model.py <modell.glb> meinmodell <arbeitsordner>/joints.json <arbeitsordner>/yunara_base.skn [--repose]
echo '{"model": "meinmodell"}' > ../../assets_src/char/model.json
cd .. && python3 build_mod.py <spieldateien-ordner>
```

Das Werkzeug macht automatisch:
1. Modell laden, Teile zusammenfügen, auf Yunaras Größe skalieren, Füße auf den Boden
2. eine einzige Textur erzeugen (vorhandene Textur übernehmen oder alle Materialien in ein Atlas backen)
3. Gewichte: Knochen-Hitze-Methode, Fallback nach Abstand zu den Knochen, Kopf/Haare starr am Kopf,
   Oberkörper und Hände mit Yunaras handgemachten Gewichten
4. Platz für die Anime-Konturlinie in der Textur reservieren
5. Dateien `assets_src/char/meinmodell_*` schreiben

Zurück zum Stürmer: `{"model": "striker2"}` in `assets_src/char/model.json`.

Danach mit `tools/char/render_built.py` Posen aus der fertigen Datei rendern und prüfen.

## Modell mit eigenen Proportionen (z. B. aus Meshy) – so entstand v0.5

Ein Anime-Modell hat meist einen größeren Kopf und kürzere Beine als Yunara. Statt das Modell auf ihr Skelett zu
strecken, bekommt es ein **eigenes Skelett**, und Yunaras Animationen werden darauf umgerechnet.

```bash
cd tools/char
W=<arbeitsordner>          # enthält joints.json, wadx/yunara_base.skn
# 1. reduzieren (Spielmodell), Original für das Backen behalten, Kontrollbilder
python3 meshy_prep.py <modell.glb> $W/mprep 26000 210.5
# 2. Gelenkpunkte messen und eintragen: assets_src/char/meshy/landmarks.json
#    (Root, Spine1/2, Chest, Neck, Head, L_/R_ Clavicle, Shoulder, Elbow, Hand, HandTip, Hip, KneeUpper, Foot, Toe)
# 3. Arme/Beine in Yunaras Grundpose drehen (Längen bleiben), Sohlen auf den Boden
python3 meshy_repose.py $W/mprep/meshy_prep.blend ../../assets_src/char/meshy/landmarks.json $W/joints.json $W/mprep
# 4. eigenes Skelett (nur zum Prüfen; der Build erzeugt es selbst neu)
python3 custom_skeleton.py skeleton $W/yunara_base.skl $W/joints.json $W/mprep/landmarks_posed.json $W/cskel meinmodell
cp $W/mprep/landmarks_posed.json ../../assets_src/char/meinmodell_landmarks.json
# 5. Licht/AO/Normalen vom Originalmodell backen, Anime-Schattierung, Textur aufräumen
python3 meshy_bake.py $W/mprep/meshy_posed.blend $W/mprep/bake.npz
python3 meshy_texture.py <modell-textur.png> $W/mprep/bake.npz ../../assets_src/char/meshy/cleanup.json $W/mprep/shaded.png
# 6. an das eigene Skelett binden (starre Hände, keine Yunara-Gewichte)
python3 import_model.py $W/mprep/meshy_posed.blend meinmodell $W/cskel/meinmodell_joints.json $W/wadx/yunara_base.skn \
        --custom-skeleton --albedo $W/mprep/shaded.png
```

Dann `{"model": "meinmodell"}` in `assets_src/char/model.json` und bauen (siehe README, inkl. `fetch_wad.py` und
`extract_wad.py`). Sobald `assets_src/char/<name>_landmarks.json` existiert, macht `build_mod.py` automatisch:

1. Yunaras Skelett kopieren und nur die Gelenkpositionen ändern (Namen, Hashes, Hierarchie, Rotationen bleiben)
   → neuer Pfad `MVFX_Striker.skl`
2. jede Animation umrechnen: Rotationen bleiben unverändert, Verschiebungen pro Knochen
   `t' = c + (t − b) · s` (b/c = Ruhelage Yunara/Modell, s = Längenverhältnis; Wurzel: Hüfthöhe)
3. die umgerechneten Clips unter neuen Pfaden ablegen und nur den Animationsgraphen des Standard-Skins darauf umleiten

`cleanup.json` listet Stellen der KI-Textur, die übermalt werden (z. B. markenähnliche Logos), und wo das eigene
Wappen auf die Ärmel projiziert wird. Prüfen: `animtest.py` / `render_built.py` mit dem eigenen Skelett.
