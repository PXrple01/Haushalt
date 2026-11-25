#!/bin/bash
# Renders the loading screen + HUD icons from the *built* mod (Cycles) and stores them in assets_src/char.
# usage: make_promo.sh <work dir with joints.json, yunara_base.skl and an anm/ folder of extracted clips>
# A model slot with its own skeleton uses the skeleton + retargeted clips from the built WAD instead.
set -e
SP="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
FANTOME=$(ls -t "$ROOT"/build/*.fantome | head -1)
KICK=6de75c6f0c23b3c0; HERO=477dc1765be45513
CFG="$ROOT/assets_src/char/model.json"
SLOT=$(python3 -c "import json;print(json.load(open('$CFG'))['model'])" 2>/dev/null || echo striker2)
# camera "yaw,pitch,distance,focal,target height": env LS_CAM/ICON_CAM > model.json > defaults for the v2 striker
LS_CAM=${LS_CAM:-$(python3 -c "import json;print(json.load(open('$CFG')).get('loadscreen_cam',''))" 2>/dev/null)}
ICON_CAM=${ICON_CAM:-$(python3 -c "import json;print(json.load(open('$CFG')).get('icon_cam',''))" 2>/dev/null)}
python3 - "$SP" "$FANTOME" "$ROOT" "$SLOT" "$KICK" "$HERO" <<'PY'
import os, shutil, sys, zipfile, xxhash, pyritofile
SP, F, ROOT, SLOT = sys.argv[1:5]; CLIPS = sys.argv[5:7]
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from lolassets import read_tex_bgra8
wad = zipfile.ZipFile(F).read('WAD/Yunara.wad.client'); w = pyritofile.WAD(); w.read(None, raw=wad)
def get(p):
    h = xxhash.xxh64(p.encode()).intdigest(); c = [c for c in w.chunks if int(c.hash, 16) == h][0]
    return wad[c.offset:c.offset + c.compressed_size]
open(f'{SP}/promo.skn', 'wb').write(get('assets/characters/yunara/skins/base/yunara_base.skn'))
open(f'{SP}/promo.tex', 'wb').write(get('assets/characters/yunara/skins/base/mvfx_striker_tx_cm.tex'))
read_tex_bgra8(f'{SP}/promo.tex').save(f'{SP}/promo_tex.png')
os.makedirs(f'{SP}/promo_anm', exist_ok=True)
cj = os.path.join(ROOT, 'build', f'{SLOT}_joints.json')
if os.path.exists(cj):                       # own skeleton: everything from the built WAD
    open(f'{SP}/promo.skl', 'wb').write(get('assets/characters/yunara/skins/base/mvfx_striker.skl'))
    shutil.copy(cj, f'{SP}/promo_joints.json')
    for h in CLIPS:
        open(f'{SP}/promo_anm/{h}.anm', 'wb').write(get(f'assets/characters/yunara/skins/base/animations/mvfx_striker/{h}.anm'))
else:
    shutil.copy(f'{SP}/yunara_base.skl', f'{SP}/promo.skl'); shutil.copy(f'{SP}/joints.json', f'{SP}/promo_joints.json')
    for h in CLIPS:
        shutil.copy(f'{SP}/anm/{h}.anm', f'{SP}/promo_anm/{h}.anm')
PY
cd "$HERE"
COMMON="$SP/promo.skn $SP/promo_tex.png $ROOT/assets_src/gen/ball_albedo.png $ROOT/assets_src/char/${SLOT}_ink.json $SP/promo.skl $SP/promo_joints.json"
python3 blender_render.py $COMMON $SP/promo_anm/$KICK.anm 8 $SP/ls_rgba.png 616 1120 "${LS_CAM:--30,3,520,50,112}" 0 > /dev/null 2>&1
python3 compose.py $SP/ls_rgba.png "$ROOT/assets_src/char/loadscreen.png" 308x560 "0.10,0.40"
python3 compose.py $SP/ls_rgba.png "$SP/loadscreen_big.png" - "0.10,0.40"
python3 blender_render.py $COMMON $SP/promo_anm/$HERO.anm 12 $SP/icon_rgba.png 512 512 "${ICON_CAM:--22,4,95,85,196}" 0 > /dev/null 2>&1
python3 make_icons.py $SP/icon_rgba.png "$ROOT/assets_src/char/icon_square.png" "$ROOT/assets_src/char/icon_circle.png" "$SP/icons_preview.png"
echo "promo art updated"
