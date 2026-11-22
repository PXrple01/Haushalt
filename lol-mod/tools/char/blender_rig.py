"""Blender step 3: armature from the League skeleton, automatic (bone heat) weights for the body,
rigid head/hair weights, and export of a skinning-ready mesh (split at UV seams)."""
import json
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np

from blender_mesh import b2l, l2b

DEFORM = {   # bone name -> tail joint (or explicit tail offset)
    'Pelvis': ('pos', (0, 112.0, -0.7)), 'Spine1': ('joint', 'Spine2'), 'Spine2': ('joint', 'Chest'),
    'Chest': ('joint', 'Neck'), 'Neck': ('joint', 'Head'), 'Head': ('pos', (0, 212.0, 1.0)),
}
for s in ('L', 'R'):
    DEFORM.update({
        f'{s}_Clavicle': ('joint', f'{s}_Shoulder'), f'{s}_Shoulder_Scale': ('joint', f'{s}_Elbow'),
        f'{s}_Elbow_Scale': ('joint', f'{s}_Hand'), f'{s}_Hand': ('ext', f'{s}_Middle1', 2.1),
        f'{s}_Thumb1': ('ext', f'{s}_Thumb3', 1.4),
        f'{s}_Hip': ('joint', f'{s}_KneeUpper'), f'{s}_KneeLower': ('joint', f'{s}_Foot'),
        f'{s}_Foot': ('joint', f'{s}_Toe'), f'{s}_Toe': ('off', (0, 0, 9.0)),
    })


def build_armature(sk):
    pos = {j['name']: np.array(j['pos']) for j in sk['joints']}
    arm = bpy.data.armatures.new('rig'); ob = bpy.data.objects.new('rig', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (kind, val, *rest) in DEFORM.items():
        h = pos[name]
        if kind == 'joint':
            t = pos[val]
        elif kind == 'pos':
            t = np.array(val, float)
        elif kind == 'ext':
            t = h + (pos[val] - h) * rest[0]
        else:
            t = h + np.array(val, float)
        b = arm.edit_bones.new(name)
        b.head = l2b(h[None])[0]; b.tail = l2b(t[None])[0]
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def main(blend, joints, out):
    bpy.ops.wm.open_mainfile(filepath=blend)
    sk = json.load(open(joints))
    ch = bpy.data.objects['char']
    rig = build_armature(sk)
    # split body (part 0) from head/hair so bone heat only sees the closed body surface
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ch; ch.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(ch.data)
    part = bm.faces.layers.int['part']
    for f in bm.faces:
        f.select = f[part] != 0
    bmesh.update_edit_mesh(ch.data)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    rest = [o for o in bpy.context.selected_objects if o != ch][0]
    # bone heat on the body
    bpy.ops.object.select_all(action='DESELECT')
    ch.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # head + hair: rigid on Head, the lowest part of the neck blends into Neck
    for name in DEFORM:
        rest.vertex_groups.new(name=name)
    gh, gn = rest.vertex_groups['Head'], rest.vertex_groups['Neck']
    for v in rest.data.vertices:
        y = v.co.z                                        # blender z == league y
        w = float(np.clip((y - 176.0) / 6.0, 0, 1))
        gh.add([v.index], w, 'REPLACE')
        if w < 1:
            gn.add([v.index], 1 - w, 'REPLACE')
    # join back
    bpy.ops.object.select_all(action='DESELECT')
    ch.select_set(True); rest.select_set(True); bpy.context.view_layer.objects.active = ch
    bpy.ops.object.join()
    export(ch, sk, out)


def export(ob, sk, out):
    me = ob.data
    names = [g.name for g in ob.vertex_groups]
    nv = len(me.vertices)
    W = np.zeros((nv, len(names)), np.float32)
    for v in me.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    # top-4 influences, normalised
    idx = np.argsort(-W, axis=1)[:, :4]
    w4 = np.take_along_axis(W, idx, 1)
    w4[w4 < 0.01] = 0
    s = w4.sum(1, keepdims=True)
    bad = (s[:, 0] <= 0).sum()
    w4 = np.where(s > 0, w4 / np.maximum(s, 1e-9), np.array([1, 0, 0, 0], np.float32))
    jidx = {j['name']: i for i, j in enumerate(sk['joints'])}
    infl = sk['influences']
    infl_index = {j: k for k, j in enumerate(infl)}
    bone_to_infl = np.array([infl_index[jidx[n]] for n in names], np.int32)
    inf4 = bone_to_infl[idx]
    co = b2l(np.array([v.co[:] for v in me.vertices]))
    nrm = np.zeros((nv, 3)); me.vertices.foreach_get('normal', nrm.ravel()); nrm = b2l(nrm)
    uvs = np.zeros((len(me.loops), 2), np.float32); me.uv_layers.active.data.foreach_get('uv', uvs.ravel())
    part = np.zeros(len(me.polygons), np.int32); me.attributes['part'].data.foreach_get('value', part)
    # split vertices at uv seams
    key_to_new, new_src, new_uv, tris, tri_part = {}, [], [], [], []
    for p in me.polygons:
        tri = []
        for vi, li in zip(p.vertices, p.loop_indices):
            u = uvs[li]
            k = (vi, round(float(u[0]), 6), round(float(u[1]), 6))
            if k not in key_to_new:
                key_to_new[k] = len(new_src); new_src.append(vi); new_uv.append((u[0], 1.0 - u[1]))
            tri.append(key_to_new[k])
        tris.append(tri); tri_part.append(part[p.index])
    src = np.array(new_src)
    np.savez_compressed(out, pos=co[src].astype(np.float32), nrm=nrm[src].astype(np.float32), uv=np.array(new_uv, np.float32),
                        infl=inf4[src].astype(np.uint8), w=w4[src].astype(np.float32), tris=np.array(tris, np.int32),
                        part=np.array(tri_part, np.int32))
    print('exported', len(src), 'verts', len(tris), 'tris; groups', len(names), 'unweighted', int(bad))


if __name__ == '__main__':
    main(*sys.argv[1:4])
