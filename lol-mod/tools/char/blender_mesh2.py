"""Blender: clean/decimate every v2 part to its triangle budget (League space in/out)."""
import sys

import bpy  # noqa: I001
import numpy as np

from blender_mesh import keep_largest, make_obj, b2l

BUDGET = {'body': 8600, 'hands': 2200, 'head': 3500, 'cap': 1100, 'locks': 5600, 'studs': None, 'band': None}
SMOOTH = {'body': 5, 'hands': 2, 'head': 3, 'cap': 3, 'locks': 0, 'studs': 0, 'band': 0}


def process(ob, target, it, largest=True):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    if largest:
        keep_largest(ob)
    if it:
        m = ob.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); m.iterations = it; m.smooth_type = 'SIMPLE'; m.use_only_smooth = True
        bpy.ops.object.modifier_apply(modifier='sm')
    if target:
        m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1.0, target / max(1, len(ob.data.polygons)))
        m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier='dec')
    m = ob.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier='tri')
    me = ob.data
    return b2l(np.array([x.co[:] for x in me.vertices])), np.array([p.vertices[:] for p in me.polygons])


if __name__ == '__main__':
    src, dst = sys.argv[1:3]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = np.load(src)
    out = {k: d[k] for k in d.files if k.startswith('locks_') and k not in ('locks_v', 'locks_f')}
    for part in BUDGET:
        ob = make_obj(part, d[part + '_v'], d[part + '_f'])
        v, f = process(ob, BUDGET[part], SMOOTH[part], largest=part in ('body', 'head', 'cap'))
        out[part + '_v'], out[part + '_f'] = v.astype(np.float32), f.astype(np.int32)
        print(f'{part:6s} {len(v):6d} verts {len(f):6d} tris')
    np.savez(dst, **out)
