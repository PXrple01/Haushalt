"""Stage 2: rotate the model's limbs so every limb points the same way as in Yunara's bind pose, while the
model keeps its own proportions (bone lengths). The custom skeleton (custom_skeleton.py) is then built from
the re-posed landmarks, so Yunara's animation rotations drive the model 1:1.

  python3 meshy_repose.py <meshy_prep.blend> <landmarks.json> <yunara joints.json> <out_dir>

landmarks.json: League-space positions (x left-negative, y up, z front) of the model's joints, keyed with
Yunara's joint names (Root, Spine1, Spine2, Chest, Neck, Head, L_/R_ Clavicle, Shoulder, Elbow, Hand, HandTip,
Hip, KneeUpper, Foot, Toe). Writes meshy_posed.blend (objects 'hi' and 'lo') and landmarks_posed.json."""
import json
import os
import sys

import bpy  # noqa: I001
import numpy as np
from mathutils import Matrix, Vector


def l2b(p):
    return Vector((p[0], -p[2], p[1]))


def b2l(v):
    return [v[0], v[2], -v[1]]


CHAINS = {  # bone name: (head landmark, tail landmark, parent bone, Yunara reference head, tail)
    'spine': ('Root', 'Neck', None, None, None),
    'head': ('Neck', 'HeadTop', 'spine', None, None),
}
for s in ('L', 'R'):
    CHAINS.update({
        f'{s}_clav': (f'{s}_Clavicle', f'{s}_Shoulder', 'spine', None, None),
        f'{s}_upper': (f'{s}_Shoulder', f'{s}_Elbow', f'{s}_clav', f'{s}_Shoulder', f'{s}_Elbow'),
        f'{s}_fore': (f'{s}_Elbow', f'{s}_Hand', f'{s}_upper', f'{s}_Elbow', f'{s}_Hand'),
        f'{s}_hand': (f'{s}_Hand', f'{s}_HandTip', f'{s}_fore', f'{s}_Hand', f'{s}_Middle3'),
        f'{s}_thigh': (f'{s}_Hip', f'{s}_KneeUpper', 'spine', f'{s}_Hip', f'{s}_KneeUpper'),
        f'{s}_shin': (f'{s}_KneeUpper', f'{s}_Foot', f'{s}_thigh', f'{s}_KneeLower', f'{s}_Foot'),
        f'{s}_foot': (f'{s}_Foot', f'{s}_Toe', f'{s}_shin', f'{s}_Foot', f'{s}_Toe'),
    })


def main():
    blend, lm_path, yj_path, out = sys.argv[1:5]
    LM = {k: np.array(v, float) for k, v in json.load(open(lm_path)).items()}
    LM['HeadTop'] = LM['Head'] + np.array([0, 30.0, 0])
    YJ = {j['name']: np.array(j['pos']) for j in json.load(open(yj_path))['joints']}
    bpy.ops.wm.open_mainfile(filepath=blend)
    hi, lo = bpy.data.objects['hi'], bpy.data.objects['lo']
    arm_data = bpy.data.armatures.new('rp'); arm = bpy.data.objects.new('rp', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, par, _, _) in CHAINS.items():
        eb = arm_data.edit_bones.new(name); eb.head = l2b(LM[h]); eb.tail = l2b(LM[t])
        if par:
            eb.parent = arm_data.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    # bone heat on the game mesh
    bpy.ops.object.select_all(action='DESELECT')
    lo.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    nz = sum(1 for v in lo.data.vertices if sum(g.weight for g in v.groups) < 0.01)
    print('vertices without weights after bone heat:', nz)
    if nz:      # nearest-bone fallback
        groups = {b.name: lo.vertex_groups.get(b.name) or lo.vertex_groups.new(name=b.name) for b in arm_data.bones}
        segs = [(b.name, np.array(b.head_local[:]), np.array(b.tail_local[:])) for b in arm_data.bones]
        for v in lo.data.vertices:
            if sum(g.weight for g in v.groups) >= 0.01:
                continue
            p = np.array(v.co[:]); best = None
            for n, a, b in segs:
                ab = b - a; u = np.clip((p - a) @ ab / (ab @ ab), 0, 1); d = np.linalg.norm(p - a - u * ab)
                if best is None or d < best[0]:
                    best = (d, n)
            groups[best[1]].add([v.index], 1.0, 'REPLACE')
    # smooth the weights a little so the rotated joints bend softly
    bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=3)
    bpy.ops.object.mode_set(mode='OBJECT')
    # same weights on the high-poly source (for baking in the new pose)
    hi.parent = arm
    for g in lo.vertex_groups:
        if g.name not in hi.vertex_groups:
            hi.vertex_groups.new(name=g.name)
    dt = hi.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = lo
    dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = hi
    bpy.ops.object.modifier_apply(modifier='dt')
    am = hi.modifiers.new('arm', 'ARMATURE'); am.object = arm
    # pose: rotate each limb bone so its direction equals Yunara's
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    order = ['L_upper', 'L_fore', 'L_hand', 'R_upper', 'R_fore', 'R_hand', 'L_thigh', 'L_shin', 'L_foot', 'R_thigh', 'R_shin', 'R_foot']
    for name in order:
        _, _, _, yh, yt = CHAINS[name]
        pb = arm.pose.bones[name]
        bpy.context.view_layer.update()
        M = pb.matrix.copy()                                   # armature space, current (parents already posed)
        cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
        tgt = l2b(YJ[yt] - YJ[yh]).normalized()
        R = cur.rotation_difference(tgt).to_matrix().to_4x4()
        head = M.translation.copy()
        newM = Matrix.Translation(head) @ R @ Matrix.Translation(-head) @ M
        pb.matrix = newM
        bpy.context.view_layer.update()
        ang = np.degrees(cur.angle(tgt))
        print(f'  {name:8s} rotated {ang:5.1f} deg')
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    posed = {}
    for name, (h, t, _, _, _) in CHAINS.items():
        pb = arm.pose.bones[name]
        posed.setdefault(h, b2l(arm.matrix_world @ pb.head)); posed[t] = b2l(arm.matrix_world @ pb.tail)
    for k in ('Spine1', 'Spine2', 'Chest', 'Head'):
        posed[k] = LM[k].tolist()
    posed.pop('HeadTop', None)
    for ob in (lo, hi):
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers):
            if m.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=m.name)
        ob.parent = None
    # straightening a spread leg makes it reach lower: put both soles back on the ground by shortening the
    # thigh a little (smooth ramp hip -> knee, everything below the knee moves rigidly)
    def leg_weight(ob, s):
        idx = {ob.vertex_groups[f'{s}_{b}'].index for b in ('thigh', 'shin', 'foot') if f'{s}_{b}' in ob.vertex_groups}
        w = np.zeros(len(ob.data.vertices))
        for v in ob.data.vertices:
            w[v.index] = sum(g.weight for g in v.groups if g.group in idx)
        return w
    for s in ('L', 'R'):
        wl = leg_weight(lo, s)
        co = np.array([v.co[:] for v in lo.data.vertices])           # Blender space: z up
        sole = co[(wl > 0.5) & (co[:, 2] < 30), 2].min()
        delta = -sole
        hip_y, knee_y = posed[f'{s}_Hip'][1], posed[f'{s}_KneeUpper'][1]
        for ob in (lo, hi):
            w = wl if ob is lo else leg_weight(ob, s)
            c = np.zeros(len(ob.data.vertices) * 3, np.float32); ob.data.vertices.foreach_get('co', c); c = c.reshape(-1, 3)
            f = np.clip((hip_y - c[:, 2]) / (hip_y - knee_y), 0, 1)
            c[:, 2] += delta * f * w
            ob.data.vertices.foreach_set('co', c.ravel()); ob.data.update()
        for k in (f'{s}_KneeUpper', f'{s}_Foot', f'{s}_Toe'):
            posed[k][1] += float(delta)
        print(f'  {s} leg: sole {sole:+.2f} -> 0 (thigh {"shortened" if delta > 0 else "lengthened"} by {abs(delta):.2f})')
    for ob in (lo, hi):
        for g in list(ob.vertex_groups):
            ob.vertex_groups.remove(g)
    bpy.data.objects.remove(arm, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'meshy_posed.blend'))
    json.dump(posed, open(os.path.join(out, 'landmarks_posed.json'), 'w'), indent=1)
    print('posed landmarks written')


if __name__ == '__main__':
    main()
