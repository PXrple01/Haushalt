"""Turns a (Meshy) model into a light VFX mesh: merge, decimate to a triangle budget, scale to a height,
stand it on y = 0 centred on the vertical axis, planar UVs (u = across, v = height: hologram scanlines
run horizontally). Writes League-space positions, triangles and per-vertex UVs to an .npz.

  python3 vfx_mesh.py <model.glb> <out.npz> <triangles> <height> [--face-z]
--face-z: turn the model so its largest horizontal overhang (e.g. a floodlight's lamp panel) points to +z.
"""
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np


def main():
    src, out, tris, height = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(ob.data); bm.free()
    n0 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1.0, tris / max(n0, 1)); m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
    me = ob.data
    v = np.zeros(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', v); v = v.reshape(-1, 3)
    P = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1).astype(np.float64)          # Blender -> League (y up)
    T = np.array([p.vertices[:] for p in me.polygons], np.int32)
    lo, hi = P.min(0), P.max(0)
    P = (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * (height / (hi[1] - lo[1]))
    if '--face-z' in sys.argv:
        top = P[P[:, 1] > height * 0.8]; base = P[P[:, 1] < height * 0.5]
        d = top[:, [0, 2]].mean(0) - np.median(base[:, [0, 2]], 0)
        a = np.arctan2(d[0], d[1])                                              # rotate d onto +z
        c, s = np.cos(-a), np.sin(-a)
        x, z = P[:, 0].copy(), P[:, 2].copy()
        P[:, 0], P[:, 2] = c * x + s * z, -s * x + c * z
        base = P[P[:, 1] < height * 0.5]
        P[:, [0, 2]] -= np.median(base[:, [0, 2]], 0)                           # mast foot on the axis
        print(f'  turned {np.degrees(a):.0f} deg so the overhang faces +z')
    lo, hi = P.min(0), P.max(0)
    uv = np.stack([(P[:, 0] - lo[0]) / max(hi[0] - lo[0], 1e-6), P[:, 1] / height], 1)
    np.savez(out, pos=P.astype(np.float32), tris=T, uv=uv.astype(np.float32))
    print(f'{src}: {n0} -> {len(T)} triangles, {len(P)} vertices, bbox {lo.round(1)} .. {hi.round(1)}')


if __name__ == '__main__':
    main()
