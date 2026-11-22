"""Blender step 2: one object with parts, UV layout (more texel density for the face), and baked
data maps (position, normal, part id, ambient occlusion) for the numpy texture painter."""
import math
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np

from blender_mesh import b2l, l2b

RES = 2048
PART_COLORS = [(0.0, 0, 0), (1.0, 0, 0), (0, 1.0, 0), (0, 0, 1.0)]   # body, head, cap, locks


def build(d):
    bm = bmesh.new()
    part_layer = bm.faces.layers.int.new('part')
    for pid, key in enumerate(('b', 'h', 'c', 'l')):
        vs = [bm.verts.new(p) for p in l2b(d[key + 'v'])]
        for f in d[key + 'f']:
            try:
                face = bm.faces.new([vs[i] for i in f])
                face[part_layer] = pid
                face.smooth = True
            except ValueError:
                pass
    me = bpy.data.meshes.new('char')
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('char', me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    return ob


def unwrap(ob):
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=0.002, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bm = bmesh.from_edit_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    part = bm.faces.layers.int['part']
    dens = {0: 1.0, 1: 2.3, 2: 0.85, 3: 0.9}          # face gets ~2.3x texel density
    for f in bm.faces:
        s = dens[f[part]]
        for lp in f.loops:
            lp[uv].uv *= s
    bmesh.update_edit_mesh(ob.data)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.0035)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_maps(ob):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.render.bake.margin = 12
    me = ob.data
    # face attribute -> color attribute for the id pass
    part = np.zeros(len(me.polygons), np.int32)
    me.attributes['part'].data.foreach_get('value', part)
    col = me.color_attributes.new('partcol', 'FLOAT_COLOR', 'CORNER')
    loop_cols = np.zeros((len(me.loops), 4), np.float32)
    for p in me.polygons:
        c = PART_COLORS[part[p.index]]
        for li in p.loop_indices:
            loop_cols[li] = (*c, 1.0)
    col.data.foreach_set('color', loop_cols.ravel())
    v = np.array([x.co[:] for x in me.vertices])
    lo, hi = v.min(0) - 1, v.max(0) + 1
    mat = bpy.data.materials.new('bake'); mat.use_nodes = True
    me.materials.clear(); me.materials.append(mat)
    nt = mat.node_tree; N = nt.nodes; Lk = nt.links
    for n in list(N):
        if n.type != 'OUTPUT_MATERIAL':
            N.remove(n)
    out = [n for n in N if n.type == 'OUTPUT_MATERIAL'][0]
    emis = N.new('ShaderNodeEmission'); Lk.new(emis.outputs[0], out.inputs[0])
    geo = N.new('ShaderNodeNewGeometry')
    sub = N.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = lo
    div = N.new('ShaderNodeVectorMath'); div.operation = 'DIVIDE'; div.inputs[1].default_value = hi - lo
    Lk.new(geo.outputs['Position'], sub.inputs[0]); Lk.new(sub.outputs[0], div.inputs[0])
    nm = N.new('ShaderNodeVectorMath'); nm.operation = 'MULTIPLY_ADD'
    nm.inputs[1].default_value = (0.5, 0.5, 0.5); nm.inputs[2].default_value = (0.5, 0.5, 0.5)
    Lk.new(geo.outputs['Normal'], nm.inputs[0])
    attr = N.new('ShaderNodeAttribute'); attr.attribute_name = 'partcol'
    tex = N.new('ShaderNodeTexImage'); N.active = tex
    maps = {}
    for name, sock in (('pos', div.outputs[0]), ('nrm', nm.outputs[0]), ('part', attr.outputs['Color'])):
        img = bpy.data.images.new(name, RES, RES, float_buffer=True, alpha=True)
        img.generated_color = (0, 0, 0, 0)
        tex.image = img
        Lk.new(sock, emis.inputs['Color'])
        sc.cycles.samples = 1
        bpy.ops.object.bake(type='EMIT', margin=12, use_clear=True)
        maps[name] = np.array(img.pixels[:], np.float32).reshape(RES, RES, 4)
    # coverage mask: bake pure white emission without margin
    img = bpy.data.images.new('mask', RES, RES, float_buffer=False, alpha=True)
    img.generated_color = (0, 0, 0, 0); tex.image = img
    rgb = N.new('ShaderNodeRGB'); rgb.outputs[0].default_value = (1, 1, 1, 1)
    Lk.new(rgb.outputs[0], emis.inputs['Color'])
    bpy.ops.object.bake(type='EMIT', margin=0, use_clear=True)
    maps['mask'] = np.array(img.pixels[:], np.float32).reshape(RES, RES, 4)
    # ambient occlusion
    img = bpy.data.images.new('ao', RES, RES, float_buffer=True, alpha=True)
    tex.image = img
    sc.cycles.samples = 64
    bpy.ops.object.bake(type='AO', margin=12, use_clear=True)
    maps['ao'] = np.array(img.pixels[:], np.float32).reshape(RES, RES, 4)
    return maps, lo, hi


def export(ob, path, maps, lo, hi):
    me = ob.data
    v = b2l(np.array([x.co[:] for x in me.vertices]))
    nrm = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('normal', nrm.ravel())
    nrm = b2l(nrm)
    tris = np.array([p.vertices[:] for p in me.polygons], np.int32)
    loops = np.array([p.loop_indices[:] for p in me.polygons], np.int32)
    uv = np.zeros((len(me.loops), 2), np.float32); me.uv_layers.active.data.foreach_get('uv', uv.ravel())
    part = np.zeros(len(me.polygons), np.int32); me.attributes['part'].data.foreach_get('value', part)
    # position map back to League space (rows are bottom-up in Blender images)
    pos_b = maps['pos'][..., :3] * (hi - lo) + lo
    pos_l = b2l(pos_b.reshape(-1, 3)).reshape(RES, RES, 3)
    nrm_l = b2l((maps['nrm'][..., :3] * 2 - 1).reshape(-1, 3)).reshape(RES, RES, 3)
    np.savez_compressed(path, verts=v.astype(np.float32), normals=nrm.astype(np.float32), tris=tris, loops=loops,
                        uv=uv, part=part, pos=np.flipud(pos_l).astype(np.float32), nrm=np.flipud(nrm_l).astype(np.float32),
                        partmap=np.flipud(maps['part'][..., :3]).astype(np.float32), ao=np.flipud(maps['ao'][..., 0]).astype(np.float32),
                        mask=np.flipud(maps['mask'][..., 3] > 0.5))


if __name__ == '__main__':
    src, dst, blend = sys.argv[1:4]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = np.load(src)
    ob = build(d)
    unwrap(ob)
    maps, lo, hi = bake_maps(ob)
    export(ob, dst, maps, lo, hi)
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print('baked', len(ob.data.vertices), 'verts', len(ob.data.polygons), 'tris')
