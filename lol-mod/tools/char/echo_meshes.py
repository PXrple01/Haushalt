"""Zukunfts-Echos: the striker frozen in four action poses as static VFX meshes (.scb source npz), textured with
the shipped combined striker texture (body atlas left, expression tiles right) and decimated in Blender.

Coordinates: League world, the copy faces the camera (south, -z) when the mesh particle is world-oriented
(isLocalOrientation = 0). A skinned vertex v in mesh space shows up in the world as (-v.x, v.y, -v.z) for a
champion facing south, so that is what is written. uv: DirectX convention like the SKN (v down).

  python3 echo_meshes.py <work dir with built.skl + poses_ours/>   -> assets_src/vfx/echo_<k>.npz
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import posebin  # noqa: E402
from animtest import Skeleton  # noqa: E402

ROOT = os.path.join(HERE, '..', '..')
CHAR = os.path.join(ROOT, 'assets_src', 'char')
VFX = os.path.join(ROOT, 'assets_src', 'vfx')
POSES = [   # (clip anm hash, frame, face layer): shot, lunge, leap, sprint
    ('b430ad7e67f43d24', 6, 'shout'),
    ('6de75c6f0c23b3c0', 8, 'focus'),
    ('26cc22bf74ce8931', 23, 'grin'),
    ('fcf6060b89f4ef53', 3, 'focus'),
]
TRIS = 5200


def posed(sk, d, F, clip, frame, face):
    G = posebin.globals_at(sk, clip, frame % clip.n)
    P = sk.skin(d['pos'].astype(float), d['infl'].astype(int), d['w'].astype(float), G)
    uv = d['uv'].astype(np.float64) * np.array([0.5, 1.0])
    T = d['tris'].astype(np.int64)
    if F is not None and face:
        src = F['src']
        fp = sk.skin(F['pos_' + face].astype(float), d['infl'][src].astype(int), d['w'][src].astype(float), G)
        fuv = F['uv_' + face].astype(np.float64); fuv = np.stack([0.5 + fuv[:, 0] * 0.5, fuv[:, 1]], 1)
        T = np.concatenate([T, F['tris'].astype(np.int64) + len(P)])
        P = np.concatenate([P, fp]); uv = np.concatenate([uv, fuv])
    W = P * np.array([-1.0, 1.0, -1.0])                     # world, facing south
    return W, uv, T


def decimate(P, uv, T, target):
    import bpy  # noqa: I001
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    me = bpy.data.meshes.new('echo')
    me.from_pydata(P.tolist(), [], T.tolist())
    uvl = me.uv_layers.new(name='uv')
    loops = np.array([li for poly in me.polygons for li in poly.loop_indices])
    vid = np.array([me.loops[i].vertex_index for i in loops])
    uvl.data.foreach_set('uv', uv[vid].astype(np.float32).ravel())
    me.validate(); me.update()
    ob = bpy.data.objects.new('echo', me); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, target / len(T))
    bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.quads_convert_to_tris(); bpy.ops.object.mode_set(mode='OBJECT')
    me = ob.data
    co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    uvs = np.zeros(len(me.loops) * 2); me.uv_layers[0].data.foreach_get('uv', uvs); uvs = uvs.reshape(-1, 2)
    tri_loops = np.array([list(p.loop_indices) for p in me.polygons])
    tri_verts = np.array([list(p.vertices) for p in me.polygons])
    # one output vertex per corner (keeps uv seams exact)
    Pn = co[tri_verts].reshape(-1, 3); Un = uvs[tri_loops].reshape(-1, 2)
    Tn = np.arange(len(Pn)).reshape(-1, 3)
    # merge identical (position, uv) corners
    key = np.round(np.hstack([Pn, Un * 4096]), 3)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return Pn[first], Un[first], inv.reshape(-1)[Tn]


def main():
    work = sys.argv[1]
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    slot = json.load(open(os.path.join(CHAR, 'model.json')))['model']
    d = np.load(os.path.join(CHAR, f'{slot}_rigged.npz'))
    fp = os.path.join(CHAR, f'{slot}_faces.npz')
    F = np.load(fp) if os.path.exists(fp) else None
    for k, (anm, frame, face) in enumerate(POSES):
        clip = posebin.PoseClip(os.path.join(work, 'poses_ours', anm + '.pose'))
        P, uv, T = posed(sk, d, F, clip, frame, face)
        P[:, [0, 2]] -= P[:, [0, 2]].mean(0)                 # centred on its own footprint, feet stay on the ground
        P[:, 1] -= P[:, 1].min()
        Pd, Ud, Td = decimate(P, uv, T, TRIS)
        np.savez_compressed(os.path.join(VFX, f'echo_{k}.npz'), pos=Pd.astype(np.float32), uv=Ud.astype(np.float32),
                            tris=Td.astype(np.int32))
        print(f'echo_{k}: {len(T)} -> {len(Td)} tris, {len(Pd)} verts, height {Pd[:, 1].max():.0f}')


if __name__ == '__main__':
    main()
