#!/bin/bash
# Rebuilds the v2 striker from scratch.   usage: run_v2_all.sh <work dir>
# Needs: python3 with numpy pillow scipy scikit-image xxhash pyritofile pyzstd hachoir bpy==5.3.0,
#        and CommunityDragon's cdtb (for fetch_wad.py).
set -e
SP="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
mkdir -p "$SP"
# 1) Yunara's skeleton + original mesh straight from Riot's patch CDN
[ -f "$SP/Yunara.wad.client" ] || python3 "$HERE/../fetch_wad.py" "$SP/Yunara.wad.client" "${CDTB_DIR:?set CDTB_DIR to an unpacked cdtb}"
python3 - "$SP" <<'PY'
import sys, xxhash, pyritofile, pyzstd
SP=sys.argv[1]; w=pyritofile.read_wad(f'{SP}/Yunara.wad.client'); data=open(f'{SP}/Yunara.wad.client','rb').read()
for p,o in (('assets/characters/yunara/skins/base/yunara_base.skl','yunara_base.skl'),('assets/characters/yunara/skins/base/yunara_base.skn','yunara_base.skn')):
    h=xxhash.xxh64(p.encode()).intdigest(); c=[c for c in w.chunks if int(c.hash,16)==h][0]
    raw=data[c.offset:c.offset+c.compressed_size]; t=c.compression_type.value
    open(f'{SP}/{o}','wb').write(raw if t==0 else pyzstd.decompress(raw))
PY
cd "$HERE"
python3 skeleton.py "$SP/yunara_base.skl" "$SP/joints.json" > /dev/null
./run_v2_mesh.sh "$SP"                                                    # SDF modelling + Blender cleanup
python3 blender_bake2.py "$SP/v2_dec.npz" "$SP/v2_baked.npz" "$SP/v2.blend" | grep baked
python3 texture2.py "$SP/v2_baked.npz" "$SP/v2_raw.npz" "$SP/joints.json" "$SP/v2_albedo.png" "$SP/v2_ink.json"
python3 blender_rig2.py "$SP/v2.blend" "$SP/joints.json" "$SP/v2_rigged.npz" "$SP/yunara_base.skn" | grep -E "exported|transferred"
cp "$SP/v2_rigged.npz" "$ROOT/assets_src/char/striker2_rigged.npz"
cp "$SP/v2_ink.json" "$ROOT/assets_src/char/striker2_ink.json"
cp "$SP/v2_albedo.png" "$ROOT/assets_src/char/striker2_albedo.png"
cp "$SP/joints.json" "$ROOT/assets_src/char/yunara_joints.json"
echo "striker v2 assets updated in assets_src/char"
