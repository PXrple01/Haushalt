#!/bin/bash
# full character pipeline: meshes -> blender cleanup -> uv+bake -> texture -> preview sheet
set -e
SP="$1"; cd "$(dirname "$0")"
./run_mesh.sh "$SP" >/dev/null
python3 blender_bake.py "$SP/char_dec.npz" "$SP/char_baked.npz" "$SP/char.blend" 2>&1 | grep -E "^baked" || true
python3 texture.py "$SP/char_baked.npz" "$SP/joints.json" "$SP/char_albedo.png"
python3 - "$SP" <<'PY'
import sys, numpy as np
from PIL import Image
import viz_tex
SP=sys.argv[1]
d=np.load(f'{SP}/char_baked.npz')
tex=np.asarray(Image.open(f'{SP}/char_albedo.png').convert('RGB')).astype(float)/255
cuv=d['uv'][d['loops']]
ims=[]
for i,yaw in enumerate((0,180,28)):
    viz_tex.render(d['verts'], d['tris'], cuv, tex, f'{SP}/t{i}.png', size=(420,860), yaw=yaw, center=(0,108,0), scale=3.9); ims.append(Image.open(f'{SP}/t{i}.png'))
viz_tex.render(d['verts'], d['tris'], cuv, tex, f'{SP}/th.png', size=(420,860), yaw=12, pitch=4, center=(0,196,0), scale=13)
ims.append(Image.open(f'{SP}/th.png'))
sheet=Image.new('RGB',(420*4,860))
for i,im in enumerate(ims): sheet.paste(im,(i*420,0))
sheet.save(f'{SP}/tex_check.png')
PY
