"""Model slot importer: turns any humanoid model (.glb/.gltf/.fbx/.obj) into the mod's model assets.

  python3 import_model.py <model file> <name> <joints.json> <yunara_base.skn> [--repose]
         [--custom-skeleton] [--albedo <png>]

--custom-skeleton: <joints.json> is a model-specific skeleton (custom_skeleton.py) and the model is already
re-posed and scaled (meshy_repose.py): no fitting, no transfer of Yunara's artist weights, rigid hands.
A .blend model file is read from its object named 'lo'. --albedo replaces the model's own texture.

Steps: import -> join meshes -> League space (model faces -Y in Blender / +Z in glTF) -> scale to
Yunara's height, feet on the ground -> optional arm re-pose to Yunara's A-pose (needs a rig with
common bone names) -> one texture atlas (reuse the single base-colour texture or bake all
materials into a 2048 atlas) -> bone-heat weights on Yunara's skeleton + her hand-made weights for
upper body and hands -> ink patches for the outline -> assets_src/char/<name>_{rigged.npz,albedo.png,ink.json}.
Select it with assets_src/char/model.json {"model": "<name>"}; build_mod.py picks it up."""
import json
import math
import os
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from blender_mesh import b2l  # noqa: E402
import blender_rig2 as R  # noqa: E402

ROOT = os.path.join(HERE, '..', '..')
ATLAS = 2048
ARM_NAMES = {'L': ['mixamorig:LeftArm', 'LeftArm', 'upperarm_l', 'UpperArm.L', 'L_UpperArm', 'Left arm', 'LeftUpperArm'],
             'R': ['mixamorig:RightArm', 'RightArm', 'upperarm_r', 'UpperArm.R', 'R_UpperArm', 'Right arm', 'RightUpperArm']}


def import_any(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.blend':
        with bpy.data.libraries.load(path) as (src, dst):
            dst.objects = ['lo']
        bpy.context.scene.collection.objects.link(dst.objects[0])
    elif ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit(f'unsupported model format {ext}')


def repose_arms(joints):
    """Rotate the model's upper arms so they hang like Yunara's A-pose (only if a rig is present)."""
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if not arms:
        print('  no rig in the model: arms are used as modelled (A-pose expected)'); return
    arm = arms[0]
    J = {j['name']: np.array(j['pos']) for j in joints['joints']}
    target = {s: J[f'{s}_Elbow'] - J[f'{s}_Shoulder'] for s in ('L', 'R')}
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    from mathutils import Vector
    for s, names in ARM_NAMES.items():
        pb = next((arm.pose.bones[n] for n in names if n in arm.pose.bones), None)
        if pb is None:
            print('  arm bone not found for side', s); continue
        cur = (arm.matrix_world @ pb.tail) - (arm.matrix_world @ pb.head)
        cur_l = b2l(np.array([cur[:]]))[0]
        # League L_ is the character's left; mirror decision by sign of x
        tgt = target['L' if cur_l[0] < 0 else 'R']
        a = Vector(cur[:]).normalized()
        tb = Vector((tgt[0], -tgt[2], tgt[1])).normalized()
        rot = a.rotation_difference(tb)
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (arm.matrix_world.to_quaternion().inverted() @ rot @ arm.matrix_world.to_quaternion()) @ pb.rotation_quaternion
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for m in o.modifiers:
                if m.type == 'ARMATURE':
                    bpy.context.view_layer.objects.active = o
                    bpy.ops.object.modifier_apply(modifier=m.name)
    print('  arms re-posed to the A-pose')


def join_meshes():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:
        for m in list(o.modifiers):
            if m.type == 'ARMATURE':
                o.modifiers.remove(m)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.data.objects):
        if o != ob:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.quads_convert_to_tris(); bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def fit_to_yunara(ob, ref_height):
    v = np.array([x.co[:] for x in ob.data.vertices])
    lo, hi = v.min(0), v.max(0)
    s = ref_height / max(hi[2] - lo[2], 1e-6)
    c = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    for x in ob.data.vertices:
        x.co = tuple((np.array(x.co[:]) - c) * s)
    ob.data.update()
    print(f'  scaled x{s:.3f} to {ref_height:.1f} units')


def build_atlas(ob, out_png, albedo=None):
    """Single texture: reuse a lone base-colour image, else bake every material's colour into an atlas."""
    if albedo:
        from PIL import Image
        Image.open(albedo).convert('RGB').resize((ATLAS, ATLAS), Image.LANCZOS).save(out_png)
        print('  using the given albedo', albedo); return
    mats = [m for m in ob.data.materials if m]
    imgs = []

    def upstream_images(sock, seen):
        out = []
        for l in sock.links:
            n = l.from_node
            if n.name in seen:
                continue
            seen.add(n.name)
            if n.type == 'TEX_IMAGE' and n.image:
                out.append(n.image)
            for inp in n.inputs:
                out += upstream_images(inp, seen)
        return out
    for m in mats:
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    imgs += upstream_images(n.inputs['Base Color'], set())
    imgs = list({i.name: i for i in imgs}.values())
    if len(mats) <= 1 and len(imgs) == 1 and ob.data.uv_layers:
        img = imgs[0]
        px = np.array(img.pixels[:], np.float32).reshape(img.size[1], img.size[0], -1)[..., :3]
        from PIL import Image
        Image.fromarray((np.flipud(np.clip(px, 0, 1)) * 255).astype(np.uint8)).resize((ATLAS, ATLAS), Image.LANCZOS).save(out_png)
        print('  using the model texture directly'); return
    print(f'  baking {len(mats)} materials into one {ATLAS} atlas')
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
    old = ob.data.uv_layers.active
    new = ob.data.uv_layers.new(name='atlas'); ob.data.uv_layers.active = new
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003); bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('atlas', ATLAS, ATLAS)
    for m in mats:
        if not m.node_tree:
            m.use_nodes = True
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img
        uvn = m.node_tree.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'atlas'
        m.node_tree.links.new(uvn.outputs[0], t.inputs[0]); m.node_tree.nodes.active = t
    if old:
        old.active_render = True
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8, use_clear=True)
    for lay in list(ob.data.uv_layers):
        if lay.name != 'atlas':
            ob.data.uv_layers.remove(lay)
    px = np.array(img.pixels[:], np.float32).reshape(ATLAS, ATLAS, 4)[..., :3]
    from PIL import Image
    Image.fromarray((np.flipud(np.clip(px, 0, 1)) * 255).astype(np.uint8)).save(out_png)


def reserve_ink(ob, png, ink_json):
    """Shrink the UV layout by 2.2% and paint two ink patches into the freed border strip."""
    from PIL import Image
    for lp in ob.data.uv_layers.active.data:
        lp.uv = (lp.uv[0] * 0.978, lp.uv[1] * 0.978)
    im = Image.open(png).convert('RGB'); W, H = im.size
    canvas = Image.new('RGB', (W, H), (0, 0, 0))
    sw, sh = int(W * 0.978), int(H * 0.978)
    canvas.paste(im.resize((sw, sh), Image.LANCZOS), (0, H - sh))          # uv (0,0) is the bottom-left
    patches = {}
    for k, (name, col) in enumerate((('ink_dark', (6, 10, 22)), ('ink_skin', (87, 43, 33)))):
        x0, y0 = 40 + k * 60, 6
        canvas.paste(col, (x0, y0, x0 + 32, y0 + 26))
        patches[name] = ((x0 + 16) / W, (y0 + 13) / H)
    canvas.save(png)
    json.dump(patches, open(ink_json, 'w'))


def geometric_fallback(ob, joints):
    """Vertices that bone heat could not solve (open / overlapping meshes) get distance-based weights to the
    nearest bones; everything above the neck follows the head (hair, hats, accessories)."""
    J = {j['name']: np.array(j['pos']) for j in joints['joints']}
    bones = []
    for name, (kind, val, *rest) in R.DEFORM.items():
        h = J[name]
        t = J[val] if kind == 'joint' else (np.array(val, float) if kind == 'pos' else
                                             (h + (J[val] - h) * rest[0] if kind == 'ext' else h + np.array(val, float)))
        bones.append((name, h, t))
    co = b2l(np.array([v.co[:] for v in ob.data.vertices]))
    tot = np.zeros(len(co))
    for v in ob.data.vertices:
        tot[v.index] = sum(g.weight for g in v.groups)
    todo = np.where(tot < 0.01)[0]
    if not len(todo):
        return 0
    D = np.zeros((len(todo), len(bones)))
    for k, (_, h, t) in enumerate(bones):
        ab = t - h
        u = np.clip(((co[todo] - h) @ ab) / max(ab @ ab, 1e-9), 0, 1)
        D[:, k] = np.linalg.norm(co[todo] - (h + u[:, None] * ab), axis=1)
    near = np.argsort(D, axis=1)[:, :3]
    groups = {n: ob.vertex_groups[n] for n, _, _ in bones}
    head_y = J['Head'][1]
    for row, vi in enumerate(todo):
        y = co[vi, 1]
        if y > head_y - 6:
            w = float(np.clip((y - (head_y - 8)) / 6.0, 0, 1))
            groups['Head'].add([int(vi)], w, 'REPLACE')
            if w < 1:
                groups['Neck'].add([int(vi)], 1 - w, 'REPLACE')
            continue
        d = D[row, near[row]]
        w = np.exp(-(d / (d[0] + 2.0)) ** 2 * 2.0); w /= w.sum()
        for k, wk in zip(near[row], w):
            if wk > 0.02:
                groups[bones[k][0]].add([int(vi)], float(wk), 'REPLACE')
    return len(todo)


def parts_by_connectivity(ob):
    """Largest connected piece = body (0), everything else = accessories/hair (2)."""
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
    comp = [-1] * len(bm.faces); cid = 0; sizes = []
    for f in bm.faces:
        if comp[f.index] >= 0:
            continue
        stack = [f]; comp[f.index] = cid; n = 0
        while stack:
            x = stack.pop(); n += 1
            for e in x.edges:
                for g in e.link_faces:
                    if comp[g.index] < 0:
                        comp[g.index] = cid; stack.append(g)
        sizes.append(n); cid += 1
    big = int(np.argmax(sizes))
    part = np.array([0 if c == big else 2 for c in comp], np.int32)
    attr = ob.data.attributes.new('part', 'INT', 'FACE')
    attr.data.foreach_set('value', part)
    bm.free()
    return part


def custom_deform():
    """Deform bones for a model-specific skeleton: no Yunara-specific tail positions, rigid hands."""
    for s in ('L', 'R'):
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
            for k in (1, 2, 3):
                R.DEFORM.pop(f'{s}_{f}{k}', None)
        R.DEFORM[f'{s}_Hand'] = ('ext', f'{s}_Middle3', 1.15)
    R.DEFORM['Pelvis'] = ('off', (0.0, -9.0, 0.0))
    R.DEFORM['Head'] = ('off', (0.0, 44.0, 0.0))


def main():
    argv = sys.argv[1:]
    albedo = argv[argv.index('--albedo') + 1] if '--albedo' in argv else None
    custom = '--custom-skeleton' in argv
    args = [a for i, a in enumerate(argv) if not a.startswith('--') and not (i and argv[i - 1] == '--albedo')]
    src, name, joints_path, yunara_skn = args[:4]
    joints = json.load(open(joints_path))
    out_dir = os.path.join(ROOT, 'assets_src', 'char')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import_any(src)
    if '--repose' in sys.argv:
        repose_arms(joints)
    ob = join_meshes()
    sys.path.insert(0, os.path.join(HERE, '..'))
    import lolskn
    ys = lolskn.read(yunara_skn); body = [m for m in ys.submeshes if m['name'] == 'Body'][0]
    ref_h = float(ys.verts['pos'][body['vstart']:body['vstart'] + body['vcount'], 1].max())
    # (a global recalc_face_normals made it worse on this layered mesh: 349 -> 2106 inward faces by ray parity;
    #  holes.py measures real see-through spots instead - only the open jersey hem shows any)
    if custom:
        custom_deform()
    else:
        fit_to_yunara(ob, ref_h)
    png = os.path.join(out_dir, f'{name}_albedo.png'); ink = os.path.join(out_dir, f'{name}_ink.json')
    build_atlas(ob, png, albedo)
    reserve_ink(ob, png, ink)
    parts_by_connectivity(ob)
    # rig: same armature, bone heat, then Yunara's artist weights for upper body + hands
    rig = R.build_armature(joints)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=4, expand=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    for nm in R.DEFORM:
        if nm not in ob.vertex_groups:
            ob.vertex_groups.new(name=nm)
    print('  geometric weights for', geometric_fallback(ob, joints), 'vertices bone heat could not solve')
    R.export(ob, joints, os.path.join(out_dir, f'{name}_rigged.npz'), None if custom else yunara_skn)
    # (tried: limiting arm weights on the torso / smoothing torso weights -> both stretched more than bone heat;
    #  Riot's own Yunara stretches as much in these frames, see the README animation notes)
    print('model slot written:', name)


if __name__ == '__main__':
    main()
