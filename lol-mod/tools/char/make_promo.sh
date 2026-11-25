#!/bin/bash
# Renders the loading screen + HUD icons from the *built* mod (Cycles) and stores them in assets_src/char.
# usage: make_promo.sh <work dir with joints.json, yunara_base.skl and an anm/ folder of extracted clips>
set -e
SP="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
FANTOME=$(ls -t "$ROOT"/build/*.fantome | head -1)
python3 - "$SP" "$FANTOME" <<'PY'
import sys, zipfile, xxhash, pyritofile
sys.path.insert(0, sys.argv[0] if False else '.')
SP, F = sys.argv[1], sys.argv[2]
sys.path.insert(0, __import__('os').path.join(__import__('os').getcwd(), '..'))
from lolassets import read_tex_bgra8
wad = zipfile.ZipFile(F).read('WAD/Yunara.wad.client'); w = pyritofile.WAD(); w.read(None, raw=wad)
def get(p):
    h = xxhash.xxh64(p.encode()).intdigest(); c = [c for c in w.chunks if int(c.hash, 16) == h][0]
    return wad[c.offset:c.offset + c.compressed_size]
open(f'{SP}/promo.skn', 'wb').write(get('assets/characters/yunara/skins/base/yunara_base.skn'))
open(f'{SP}/promo.tex', 'wb').write(get('assets/characters/yunara/skins/base/mvfx_striker_tx_cm.tex'))
read_tex_bgra8(f'{SP}/promo.tex').save(f'{SP}/promo_tex.png')
PY
cd "$HERE"
KICK=6de75c6f0c23b3c0; HERO=477dc1765be45513
COMMON="$SP/promo.skn $SP/promo_tex.png $ROOT/assets_src/gen/ball_albedo.png $ROOT/assets_src/char/striker2_ink.json $SP/yunara_base.skl $SP/joints.json"
python3 blender_render.py $COMMON $SP/anm/$KICK.anm 8 $SP/ls_rgba.png 616 1120 "-30,3,520,50,112" 0 > /dev/null 2>&1
python3 compose.py $SP/ls_rgba.png "$ROOT/assets_src/char/loadscreen.png" 308x560 "0.10,0.40"
python3 compose.py $SP/ls_rgba.png "$SP/loadscreen_big.png" - "0.10,0.40"
python3 blender_render.py $COMMON $SP/anm/$HERO.anm 12 $SP/icon_rgba.png 512 512 "-22,4,95,85,196" 0 > /dev/null 2>&1
python3 make_icons.py $SP/icon_rgba.png "$ROOT/assets_src/char/icon_square.png" "$ROOT/assets_src/char/icon_circle.png" "$SP/icons_preview.png"
echo "promo art updated"
