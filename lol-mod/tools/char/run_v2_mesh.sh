#!/bin/bash
# v2 meshes: generate -> blender cleanup/decimate.   usage: run_v2_mesh.sh <scratch dir>
set -e
SP="$1"; cd "$(dirname "$0")"
python3 - "$SP" <<'PY'
import sys, numpy as np
import design2 as D
SP=sys.argv[1]
J=D.Rig(f'{SP}/joints.json')
parts, flows, ts = D.build_all(J)
save={k+'_v':v for k,(v,f) in parts.items()}; save.update({k+'_f':f for k,(v,f) in parts.items()})
save['locks_cl']=np.concatenate(D.CENTERLINES); save['locks_cl_n']=np.array([len(c) for c in D.CENTERLINES])
np.savez(f'{SP}/v2_raw.npz', **save)
PY
python3 blender_mesh2.py "$SP/v2_raw.npz" "$SP/v2_dec.npz" 2>&1 | grep -E "verts" || true
