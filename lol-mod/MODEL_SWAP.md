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
