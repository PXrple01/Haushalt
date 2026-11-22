"""Blender step 1: clean up and decimate the raw SDF meshes, save game-ready meshes (League space)."""
import sys

import bpy  # noqa: I001 (bpy must be imported before bmesh)
import bmesh
import numpy as np


def l2b(v):
    v = np.asarray(v, np.float64)
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)


def b2l(v):
    v = np.asarray(v, np.float64)
    return np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)


def make_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(l2b(verts).tolist(), [], faces.tolist())
    me.validate(); me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def keep_largest(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen, comps = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            x = stack.pop(); comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o.index not in seen:
                    seen.add(o.index); stack.append(o)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    for comp in comps[1:]:
        if len(comp) < 0.02 * len(comps[0]):
            bmesh.ops.delete(bm, geom=comp, context='VERTS')
    bm.to_mesh(ob.data); bm.free()


def process(ob, target_faces, smooth_iters=4):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    keep_largest(ob)
    m = ob.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); m.iterations = smooth_iters; m.smooth_type = 'SIMPLE'; m.use_only_smooth = True
    bpy.ops.object.modifier_apply(modifier='sm')
    ratio = min(1.0, target_faces / max(1, len(ob.data.polygons)))
    m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
    m = ob.modifiers.new('tri', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier='tri')
    bpy.ops.object.shade_smooth()
    me = ob.data
    v = np.array([x.co[:] for x in me.vertices])
    f = np.array([p.vertices[:] for p in me.polygons])
    return b2l(v), f


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = np.load(src)
    out = {}
    for key, target, it in (('b', 9000, 6), ('h', 3600, 3), ('c', 1800, 3), ('l', 3200, 0)):
        ob = make_obj(key, d[key + 'v'], d[key + 'f'])
        v, f = process(ob, target, it)
        out[key + 'v'], out[key + 'f'] = v.astype(np.float32), f.astype(np.int32)
        print(key, len(v), 'verts', len(f), 'tris')
    np.savez(dst, **out)
