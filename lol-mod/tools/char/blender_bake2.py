"""Blender v2: join parts, UV layout with per-part texel density, then bake position / normal /
part / coverage / ambient occlusion and a key-light map with cast shadows (only head+hair cast
shadows, so nothing baked depends on the arm pose)."""
import math
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np

from blender_mesh import b2l, l2b

RES = 2048
PARTS = ['body', 'head', 'cap', 'locks', 'hands', 'studs', 'band']
DENSITY = {0: 1.0, 1: 2.4, 2: 0.85, 3: 0.95, 4: 1.7, 5: 0.5, 6: 0.7}
CASTERS = {1, 2, 3}
KEY_LIGHT_L = np.array([-0.35, 0.80, 0.55])          # League space: from the front, high, character's left


def build(d):
    bm = bmesh.new()
    lay = bm.faces.layers.int.new('part')
    for pid, key in enumerate(PARTS):
        vs = [bm.verts.new(p) for p in l2b(d[key + '_v'])]
        for f in d[key + '_f']:
            try:
                face = bm.faces.new([vs[i] for i in f]); face[lay] = pid; face.smooth = True
            except ValueError:
                pass
    me = bpy.data.meshes.new('char'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('char', me); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    return ob


def unwrap(ob):
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bm = bmesh.from_edit_mesh(ob.data)
    uv = bm.loops.layers.uv.active; part = bm.faces.layers.int['part']
    for f in bm.faces:
        s = DENSITY[f[part]]
        for lp in f.loops:
            lp[uv].uv *= s
    bmesh.update_edit_mesh(ob.data)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    # keep a free strip along the top/right border for the outline ink patches
    bm = bmesh.from_edit_mesh(ob.data); uv = bm.loops.layers.uv.active
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv *= 0.978
    bmesh.update_edit_mesh(ob.data)
    bpy.ops.object.mode_set(mode='OBJECT')


def material(lo, hi):
    mat = bpy.data.materials.new('bake')
    nt = mat.node_tree if mat.node_tree else None
    mat.use_nodes = True; nt = mat.node_tree; N = nt.nodes; Lk = nt.links
    for n in list(N):
        if n.type != 'OUTPUT_MATERIAL':
            N.remove(n)
    out = [n for n in N if n.type == 'OUTPUT_MATERIAL'][0]
    emis = N.new('ShaderNodeEmission'); diff = N.new('ShaderNodeBsdfDiffuse')
    geo = N.new('ShaderNodeNewGeometry')
    sub = N.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = lo
    div = N.new('ShaderNodeVectorMath'); div.operation = 'DIVIDE'; div.inputs[1].default_value = hi - lo
    Lk.new(geo.outputs['Position'], sub.inputs[0]); Lk.new(sub.outputs[0], div.inputs[0])
    nm = N.new('ShaderNodeVectorMath'); nm.operation = 'MULTIPLY_ADD'
    nm.inputs[1].default_value = (0.5, 0.5, 0.5); nm.inputs[2].default_value = (0.5, 0.5, 0.5)
    Lk.new(geo.outputs['Normal'], nm.inputs[0])
    attr = N.new('ShaderNodeAttribute'); attr.attribute_name = 'partcol'
    white = N.new('ShaderNodeRGB'); white.outputs[0].default_value = (1, 1, 1, 1)
    tex = N.new('ShaderNodeTexImage'); N.active = tex
    return mat, dict(out=out, emis=emis, diff=diff, pos=div.outputs[0], nrm=nm.outputs[0], part=attr.outputs['Color'],
                     white=white.outputs[0], tex=tex, links=Lk)


def bake(objs, M, name, kind, samples=1, margin=12, float_img=True, **kw):
    img = bpy.data.images.new(name, RES, RES, float_buffer=float_img, alpha=True)
    img.generated_color = (0, 0, 0, 0)
    M['tex'].image = img
    sc = bpy.context.scene; sc.cycles.samples = samples
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type=kind, margin=margin, use_clear=True, **kw)
    return np.array(img.pixels[:], np.float32).reshape(RES, RES, 4)


def main(src, dst, blend):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    d = np.load(src)
    ob = build(d)
    unwrap(ob)
    me = ob.data
    part = np.zeros(len(me.polygons), np.int32); me.attributes['part'].data.foreach_get('value', part)
    col = me.color_attributes.new('partcol', 'FLOAT_COLOR', 'CORNER')
    lc = np.zeros((len(me.loops), 4), np.float32)
    for p in me.polygons:
        lc[list(p.loop_indices)] = (part[p.index] / 10.0, 0, 0, 1)
    col.data.foreach_set('color', lc.ravel())
    v = np.array([x.co[:] for x in me.vertices]); lo, hi = v.min(0) - 1, v.max(0) + 1
    mat, M = material(lo, hi)
    me.materials.append(mat)
    # split: casters (head/hair) vs. receivers-only (body etc.)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(me); lay = bm.faces.layers.int['part']
    for f in bm.faces:
        f.select = f[lay] in CASTERS
    bmesh.update_edit_mesh(me)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    casters = [o for o in bpy.context.selected_objects if o != ob][0]
    body = ob
    body.visible_shadow = False
    objs = [body, casters]
    L = M['links']
    maps = {}
    for nm_, sock in (('pos', M['pos']), ('nrm', M['nrm']), ('part', M['part'])):
        L.new(sock, M['emis'].inputs['Color']); L.new(M['emis'].outputs[0], M['out'].inputs[0])
        maps[nm_] = bake(objs, M, nm_, 'EMIT')
    L.new(M['white'], M['emis'].inputs['Color'])
    maps['mask'] = bake(objs, M, 'mask', 'EMIT', margin=0, float_img=False)
    maps['ao'] = bake(objs, M, 'ao', 'AO', samples=96)
    # key light with cast shadows from head/hair only
    L.new(M['diff'].outputs[0], M['out'].inputs[0])
    M['diff'].inputs['Color'].default_value = (1, 1, 1, 1)
    world = bpy.data.worlds.new('w'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.0
    sc.world = world
    sun_data = bpy.data.lights.new('key', 'SUN'); sun_data.energy = 1.0; sun_data.angle = math.radians(5)
    sun = bpy.data.objects.new('key', sun_data); sc.collection.objects.link(sun)
    kb = l2b(KEY_LIGHT_L[None] / np.linalg.norm(KEY_LIGHT_L))[0]
    sun.rotation_mode = 'QUATERNION'
    from mathutils import Vector
    sun.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(kb))
    maps['light'] = bake(objs, M, 'light', 'DIFFUSE', samples=32, pass_filter={'DIRECT'})
    # merge back for export
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True); casters.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    export(body, dst, maps, lo, hi)
    bpy.ops.wm.save_as_mainfile(filepath=blend)


def export(ob, path, maps, lo, hi):
    me = ob.data
    v = b2l(np.array([x.co[:] for x in me.vertices]))
    nrm = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('normal', nrm.ravel()); nrm = b2l(nrm)
    tris = np.array([p.vertices[:] for p in me.polygons], np.int32)
    loops = np.array([p.loop_indices[:] for p in me.polygons], np.int32)
    uv = np.zeros((len(me.loops), 2), np.float32); me.uv_layers.active.data.foreach_get('uv', uv.ravel())
    part = np.zeros(len(me.polygons), np.int32); me.attributes['part'].data.foreach_get('value', part)
    pos_l = b2l((maps['pos'][..., :3] * (hi - lo) + lo).reshape(-1, 3)).reshape(RES, RES, 3)
    nrm_l = b2l((maps['nrm'][..., :3] * 2 - 1).reshape(-1, 3)).reshape(RES, RES, 3)
    np.savez_compressed(path, verts=v.astype(np.float32), normals=nrm.astype(np.float32), tris=tris, loops=loops, uv=uv,
                        part=part, pos=np.flipud(pos_l).astype(np.float32), nrm=np.flipud(nrm_l).astype(np.float32),
                        partmap=np.flipud(np.rint(maps['part'][..., 0] * 10)).astype(np.int8),
                        ao=np.flipud(maps['ao'][..., 0]).astype(np.float32), light=np.flipud(maps['light'][..., 0]).astype(np.float32),
                        mask=np.flipud(maps['mask'][..., 3] > 0.5))
    print('baked', len(v), 'verts', len(tris), 'tris')


if __name__ == '__main__':
    main(*sys.argv[1:4])
