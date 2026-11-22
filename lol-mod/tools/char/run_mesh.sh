#!/bin/bash
# regenerate meshes + check renders.  usage: run_mesh.sh <scratch dir>
set -e
SP="$1"; cd "$(dirname "$0")"
python3 - "$SP" <<'PY'
import sys, numpy as np, design
SP=sys.argv[1]
rig=design.Rig(f'{SP}/joints.json')
body, head, cap = design.build_meshes(rig)
hv, hf = design.hair_locks()
np.savez(f'{SP}/char_raw.npz', bv=body[0], bf=body[1], hv=head[0], hf=head[1], cv=cap[0], cf=cap[1], lv=hv, lf=hf)
PY
python3 blender_mesh.py "$SP/char_raw.npz" "$SP/char_dec.npz" 2>&1 | grep -E "verts" || true
python3 - "$SP" <<'PY'
import sys, numpy as np
from PIL import Image
import viz
SP=sys.argv[1]
d=np.load(f'{SP}/char_dec.npz')
parts=[(d['bv'],d['bf'],(0.75,0.75,0.78)),(d['hv'],d['hf'],(0.95,0.82,0.72)),(d['cv'],d['cf'],(0.15,0.38,0.22)),(d['lv'],d['lf'],(0.18,0.45,0.26))]
ims=[]
for i,yaw in enumerate((0,90,30)):
    viz.render(parts, f'{SP}/v{i}.png', size=(420,860), yaw=yaw, scale=3.9, center=(0,108,0)); ims.append(Image.open(f'{SP}/v{i}.png'))
for i,yaw in enumerate((15,150)):
    viz.render(parts, f'{SP}/vh{i}.png', size=(420,420), yaw=yaw, scale=10, center=(0,198,0)); ims.append(Image.open(f'{SP}/vh{i}.png'))
sheet=Image.new('RGB',(420*4,860),(0,0,0))
for i,im in enumerate(ims[:3]): sheet.paste(im,(i*420,0))
sheet.paste(ims[3],(1260,0)); sheet.paste(ims[4],(1260,430))
sheet.save(f'{SP}/mesh_check.png')
PY
