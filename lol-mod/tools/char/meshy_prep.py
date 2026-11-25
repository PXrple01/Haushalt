"""Stage 1 for a high-poly scan/AI model (e.g. Meshy, 600k+ triangles):
import -> fit to Yunara's height -> decimate a game-res copy (UVs kept) -> save both in a .blend
-> orthographic front/side check renders with a pixel mapping, so the joints can be overlaid.

  python3 meshy_prep.py <model.glb> <out_dir> <target_tris> <ref_height>
"""
import json
import os
import sys

import bpy  # noqa: I001
import numpy as np


def fit(ob, ref_h):
    me = ob.data
    v = np.zeros(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', v); v = v.reshape(-1, 3)
    lo, hi = v.min(0), v.max(0)
    s = ref_h / (hi[2] - lo[2])
    c = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]], np.float32)
    v = (v - c) * s
    me.vertices.foreach_set('co', v.ravel()); me.update()
    return float(s)


def ortho_render(ob, path, view, res=1024, scale=240.0, cz=110.0):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'FLAT'; sh.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.film_transparent = True
    cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = scale
    cam = bpy.data.objects.new('cam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
    import math
    if view == 'front':      # looking at the face: camera on -Y looking +Y
        cam.location = (0, -400, cz); cam.rotation_euler = (math.radians(90), 0, 0)
    else:                    # character's left side (League -x) : camera on -X looking +X
        cam.location = (-400, 0, cz); cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    return {'res': res, 'scale': scale, 'cz': cz, 'view': view}


def main():
    src, out, target, ref_h = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    hi = bpy.context.view_layer.objects.active
    hi.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.data.objects):
        if o != hi:
            bpy.data.objects.remove(o, do_unlink=True)
    hi.name = 'hi'
    import bmesh
    bm = bmesh.new(); bm.from_mesh(hi.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    print(f'merged seam vertices: {n0} -> {len(bm.verts)}')
    bm.to_mesh(hi.data); bm.free()
    s = fit(hi, ref_h)
    ntri = sum(len(p.vertices) - 2 for p in hi.data.polygons)
    lo = hi.copy(); lo.data = hi.data.copy(); lo.name = 'lo'
    bpy.context.scene.collection.objects.link(lo)
    m = lo.modifiers.new('dec', 'DECIMATE'); m.ratio = target / ntri; m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.modifier_apply(modifier='dec')
    nlo = len(lo.data.polygons)
    print(f'scaled x{s:.4f}; {ntri} -> {nlo} triangles, {len(lo.data.vertices)} vertices')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'meshy_prep.blend'))
    hi.hide_render = True
    info = {}
    for view in ('front', 'side'):
        info[view] = ortho_render(lo, os.path.join(out, f'lo_{view}.png'), view)
    hi.hide_render = False; lo.hide_render = True
    ortho_render(hi, os.path.join(out, 'hi_front.png'), 'front')
    json.dump(info, open(os.path.join(out, 'views.json'), 'w'))


if __name__ == '__main__':
    main()
