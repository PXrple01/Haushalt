"""Blender v2 rig: bone heat for body + fingered hands, rigid head/hair, nearest-copy weights for
studs and wristband; exports a skinning-ready, UV-split mesh."""
import json
import os
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np

from blender_mesh import b2l, l2b
from blender_rig import DEFORM as DEFORM_V1

DEFORM = dict(DEFORM_V1)
for s in ('L', 'R'):
    DEFORM[f'{s}_Hand'] = ('joint', f'{s}_Middle1')
    DEFORM.pop(f'{s}_Thumb1', None)
    for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
        DEFORM[f'{s}_{f}1'] = ('joint', f'{s}_{f}2')
        DEFORM[f'{s}_{f}2'] = ('joint', f'{s}_{f}3')
        DEFORM[f'{s}_{f}3'] = ('ext', f'{s}_{f}2', -0.95)        # tail = 3 + (3-2)*0.95


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


def split(ob, keep_parts):
    """Separate faces whose part is NOT in keep_parts into a new object; returns it."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(ob.data); lay = bm.faces.layers.int['part']
    for f in bm.faces:
        f.select = f[lay] not in keep_parts
    bmesh.update_edit_mesh(ob.data)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    return [o for o in bpy.context.selected_objects if o != ob][0]


def main(blend, joints, out, orig_skn=None):
    bpy.ops.wm.open_mainfile(filepath=blend)
    sk = json.load(open(joints))
    ch = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    rig = build_armature(sk)
    rest = split(ch, {0, 4})                       # ch = body + hands, rest = head/hair/studs/band
    bpy.ops.object.select_all(action='DESELECT')
    ch.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # soften weight transitions (less pinching at shoulders / armpits / hips)
    bpy.ops.object.select_all(action='DESELECT')
    ch.select_set(True); bpy.context.view_layer.objects.active = ch
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=4, expand=0.0)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in DEFORM:
        if name not in rest.vertex_groups:
            rest.vertex_groups.new(name=name)
    gh, gn = rest.vertex_groups['Head'], rest.vertex_groups['Neck']
    me = rest.data
    part = np.zeros(len(me.polygons), np.int32); me.attributes['part'].data.foreach_get('value', part)
    vpart = np.full(len(me.vertices), -1)
    for p in me.polygons:
        vpart[list(p.vertices)] = part[p.index]
    for v in me.vertices:
        if vpart[v.index] in (1, 2, 3):
            w = float(np.clip((v.co.z - 176.0) / 6.0, 0, 1))
            gh.add([v.index], w, 'REPLACE')
            if w < 1:
                gn.add([v.index], 1 - w, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    ch.select_set(True); rest.select_set(True); bpy.context.view_layer.objects.active = ch
    bpy.ops.object.join()
    export(ch, sk, out, orig_skn)


def export(ob, sk, out, orig_skn=None):
    me = ob.data
    names = [g.name for g in ob.vertex_groups]
    nv = len(me.vertices)
    W = np.zeros((nv, len(names)), np.float32)
    for v in me.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    part = np.zeros(len(me.polygons), np.int32); me.attributes['part'].data.foreach_get('value', part)
    vpart = np.full(nv, -1)
    for p in me.polygons:
        vpart[list(p.vertices)] = part[p.index]
    co = b2l(np.array([v.co[:] for v in me.vertices]))
    # studs (5) and wristband (6): copy weights from the nearest boot / forearm vertex
    from scipy.spatial import cKDTree
    src = np.where(vpart == 0)[0]
    tree = cKDTree(co[src])
    for pid in (5, 6):
        dst = np.where(vpart == pid)[0]
        if len(dst):
            _, nn = tree.query(co[dst])
            W[dst] = W[src[nn]]
    jidx = {j['name']: i for i, j in enumerate(sk['joints'])}
    infl_list = sk['influences']
    # dense weights in *influence* space (what the game uses)
    Wi = np.zeros((nv, len(infl_list)), np.float32)
    infl_index = {j: k for k, j in enumerate(infl_list)}
    for g, nm in enumerate(names):
        Wi[:, infl_index[jidx[nm]]] += W[:, g]
    if orig_skn:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
        import lolskn
        o = lolskn.read(orig_skn)
        ob_ = [m for m in o.submeshes if m['name'] == 'Body'][0]
        ov = o.verts[ob_['vstart']:ob_['vstart'] + ob_['vcount']]
        allowed = {infl_index[jidx[n]] for n in names}
        ok = np.all([(ov['w'][:, k] < 0.02) | np.isin(ov['infl'][:, k], list(allowed)) for k in range(4)], axis=0)
        src_p = ov['pos'][ok].astype(np.float64)
        src_w = np.zeros((ok.sum(), len(infl_list)), np.float32)
        for k in range(4):
            np.add.at(src_w, (np.arange(ok.sum()), ov['infl'][ok][:, k].astype(int)), ov['w'][ok][:, k])
        tree2 = cKDTree(src_p)
        tgt = np.where(((vpart == 0) & (co[:, 1] > 122.0)) | (vpart == 4))[0]
        dist, nn = tree2.query(co[tgt], k=4)
        wts = 1.0 / np.maximum(dist, 0.3) ** 2; wts /= wts.sum(1, keepdims=True)
        transfer = (src_w[nn] * wts[..., None]).sum(1)
        blend = np.clip((co[tgt, 1] - 122.0) / 6.0, 0, 1)
        blend[vpart[tgt] == 4] = 1.0
        Wi[tgt] = Wi[tgt] * (1 - blend[:, None]) + transfer * blend[:, None]
        print('transferred artist weights to', len(tgt), 'vertices from', ok.sum(), 'source vertices')
    idx = np.argsort(-Wi, axis=1)[:, :4]
    w4 = np.take_along_axis(Wi, idx, 1); w4[w4 < 0.01] = 0
    s = w4.sum(1, keepdims=True)
    bad = int((s[:, 0] <= 0).sum())
    w4 = np.where(s > 0, w4 / np.maximum(s, 1e-9), np.array([1, 0, 0, 0], np.float32))
    inf4 = idx
    nrm = np.zeros((nv, 3)); me.vertices.foreach_get('normal', nrm.ravel()); nrm = b2l(nrm)
    uvs = np.zeros((len(me.loops), 2), np.float32); me.uv_layers.active.data.foreach_get('uv', uvs.ravel())
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
    srcv = np.array(new_src)
    np.savez_compressed(out, pos=co[srcv].astype(np.float32), nrm=nrm[srcv].astype(np.float32), uv=np.array(new_uv, np.float32),
                        infl=inf4[srcv].astype(np.uint8), w=w4[srcv].astype(np.float32), tris=np.array(tris, np.int32),
                        part=np.array(tri_part, np.int32))
    print('exported', len(srcv), 'verts', len(tris), 'tris; groups', len(names), 'unweighted', bad)


if __name__ == '__main__':
    main(*sys.argv[1:5])
