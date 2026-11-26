"""Blender (bpy) step for the animated Ego beast: reads Meshy's rigged character and its animation clips and writes
everything the League conversion needs to one .npz (Blender world space, metres):
  bones: names, parents, rest matrices (world)          mesh: positions, normals, uvs, triangles, 4 weights
  clips: per clip and frame the world matrix of every bone (sampled at the scene frame rate, 30 fps)
  texture: the base colour image (png next to the npz)

  python3 beast_extract.py <rigged.glb> <out.npz> <clip name>=<anim.glb> ...
"""
import os
import sys

import bpy  # noqa: I001
import numpy as np


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    return arm, meshes


def mat(m):
    return np.array([list(r) for r in m], np.float64)


def main():
    src, out = sys.argv[1], sys.argv[2]
    clips = dict(a.split('=', 1) for a in sys.argv[3:])
    arm, meshes = load(src)
    names = [b.name for b in arm.data.bones]
    parents = [names.index(b.parent.name) if b.parent else -1 for b in arm.data.bones]
    rest = np.array([mat(arm.matrix_world @ b.matrix_local) for b in arm.data.bones])
    P, N, U, T, W, I = [], [], [], [], [], []
    base = 0
    tex_saved = None
    for ob in meshes:
        me = ob.data
        me.calc_loop_triangles()
        mw = mat(ob.matrix_world)
        co = np.array([mw[:3, :3] @ np.array(v.co) + mw[:3, 3] for v in me.vertices])
        no = np.array([mw[:3, :3] @ np.array(v.normal) for v in me.vertices]); no /= np.linalg.norm(no, axis=1, keepdims=True) + 1e-12
        # one output vertex per (vertex, uv) pair so uv seams stay exact
        uvl = me.uv_layers.active.data
        key, idx_map, tris = {}, [], []
        vid_list, uv_list = [], []
        for lt in me.loop_triangles:
            tri = []
            for li in lt.loops:
                v = me.loops[li].vertex_index; uv = tuple(np.round(uvl[li].uv, 6))
                k = (v, uv)
                if k not in key:
                    key[k] = len(vid_list); vid_list.append(v); uv_list.append(uv)
                tri.append(key[k])
            tris.append(tri)
        vid = np.array(vid_list)
        gnames = [g.name for g in ob.vertex_groups]
        wi = np.zeros((len(me.vertices), 4), int); ww = np.zeros((len(me.vertices), 4))
        for v in me.vertices:
            gs = sorted(((g.weight, names.index(gnames[g.group])) for g in v.groups if gnames[g.group] in names), reverse=True)[:4]
            s = sum(w for w, _ in gs) or 1.0
            for k, (w, j) in enumerate(gs):
                wi[v.index, k] = j; ww[v.index, k] = w / s
        P.append(co[vid]); N.append(no[vid]); U.append(np.array(uv_list)); T.append(np.array(tris) + base)
        I.append(wi[vid]); W.append(ww[vid]); base += len(vid)
        if tex_saved is None:
            for slot in ob.material_slots:
                mtl = slot.material
                if mtl and mtl.use_nodes:
                    for nd in mtl.node_tree.nodes:
                        if nd.type == 'TEX_IMAGE' and nd.image and 'base' in (nd.image.name + nd.label).lower() or (
                                nd.type == 'TEX_IMAGE' and nd.image and tex_saved is None and any(
                                    lk.to_socket.name == 'Base Color' for lk in nd.outputs[0].links)):
                            tex_saved = out.replace('.npz', '_basecolor.png')
                            img = nd.image
                            img.filepath_raw = tex_saved; img.file_format = 'PNG'; img.save()
                            break
    data = dict(names=np.array(names), parents=np.array(parents), rest=rest, pos=np.concatenate(P), nrm=np.concatenate(N),
                uv=np.concatenate(U), tris=np.concatenate(T), infl=np.concatenate(I), w=np.concatenate(W))
    for cname, path in clips.items():
        arm, _ = load(path)
        bn = [b.name for b in arm.data.bones]
        act = arm.animation_data.action if arm.animation_data else None
        f0, f1 = (int(act.frame_range[0]), int(act.frame_range[1])) if act else (0, 0)
        sc = bpy.context.scene
        fps = sc.render.fps / sc.render.fps_base
        frames = []
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            frames.append([mat(arm.matrix_world @ arm.pose.bones[n].matrix) if n in bn else rest[i] for i, n in enumerate(names)])
        data['clip_' + cname] = np.array(frames)
        print(f'clip {cname}: {len(frames)} frames at {fps:.1f} fps ({path})')
    np.savez_compressed(out, **data)
    print(f'{len(names)} bones, {len(data["pos"])} verts, {len(data["tris"])} tris, texture {tex_saved}')


if __name__ == '__main__':
    main()
