"""Stage 3: bake the high-poly source onto the game mesh (same UVs, re-posed): ambient occlusion, key light with
cast shadows, high-poly normals; plus the game mesh's own position map. Output: an .npz for meshy_texture.py.

  python3 meshy_bake.py <meshy_posed.blend> <out.npz> [res]
"""
import math
import sys

import bpy  # noqa: I001
import numpy as np
from mathutils import Vector

KEY_LIGHT_L = np.array([-0.35, 0.80, 0.55])     # League space: front, high, character's left (as texture v2)


def plain_material(name, color=(1, 1, 1, 1)):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfDiffuse')
    bsdf.inputs['Color'].default_value = color
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    res = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
    bpy.ops.wm.open_mainfile(filepath=src)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    hi, lo = bpy.data.objects['hi'], bpy.data.objects['lo']
    for ob in (hi, lo):
        ob.data.materials.clear()
    hi.data.materials.append(plain_material('hi_white'))
    lm = plain_material('lo_bake'); lo.data.materials.append(lm)
    nt = lm.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage'); nt.nodes.active = tex
    world = bpy.data.worlds.new('w'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.0
    sc.world = world
    world.light_settings.distance = 14.0                       # AO reach in League units
    # the game mesh sits (almost) on the source surface: it must not shadow / occlude the source
    for attr in ('visible_shadow', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter'):
        setattr(lo, attr, False)

    def bake(name, kind, samples, s2a=True, float_img=True, **kw):
        img = bpy.data.images.new(name, res, res, float_buffer=float_img, alpha=True)
        img.generated_color = (0, 0, 0, 0)
        tex.image = img
        sc.cycles.samples = samples
        bpy.ops.object.select_all(action='DESELECT')
        lo.select_set(True); bpy.context.view_layer.objects.active = lo
        if s2a:
            hi.select_set(True)
        bpy.ops.object.bake(type=kind, margin=16, use_clear=True, use_selected_to_active=s2a,
                            cage_extrusion=1.2, max_ray_distance=4.0, **kw)
        a = np.array(img.pixels[:], np.float32).reshape(res, res, 4)
        print(f'  baked {name}', flush=True)
        return np.flipud(a)                                       # row 0 = top (v = 1), like a PNG

    maps = {}
    maps['nrm'] = bake('nrm', 'NORMAL', 1, normal_space='OBJECT')[..., :3]
    maps['ao'] = bake('ao', 'AO', 48)[..., 0]
    sun_data = bpy.data.lights.new('key', 'SUN'); sun_data.energy = 1.0; sun_data.angle = math.radians(4)
    sun = bpy.data.objects.new('key', sun_data); sc.collection.objects.link(sun)
    k = KEY_LIGHT_L / np.linalg.norm(KEY_LIGHT_L)
    kb = Vector((k[0], -k[2], k[1]))
    sun.rotation_mode = 'QUATERNION'; sun.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(kb)
    maps['light'] = bake('light', 'DIFFUSE', 24, pass_filter={'DIRECT'})[..., 0]
    # position + coverage of the game mesh itself
    em = nt.nodes.new('ShaderNodeEmission'); geo = nt.nodes.new('ShaderNodeNewGeometry')
    nt.links.new(geo.outputs['Position'], em.inputs['Color'])
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs[0])
    maps['pos'] = bake('pos', 'EMIT', 1, s2a=False)[..., :3]
    white = nt.nodes.new('ShaderNodeRGB'); white.outputs[0].default_value = (1, 1, 1, 1)
    nt.links.new(white.outputs[0], em.inputs['Color'])
    img = bpy.data.images.new('mask', res, res, alpha=True); img.generated_color = (0, 0, 0, 0); tex.image = img
    bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True)
    bpy.ops.object.bake(type='EMIT', margin=0, use_clear=True, use_selected_to_active=False)
    maps['mask'] = np.flipud(np.array(img.pixels[:], np.float32).reshape(res, res, 4))[..., 0] > 0.5
    # Blender -> League axes for positions and normals
    p = maps['pos']; maps['pos'] = np.stack([p[..., 0], p[..., 2], -p[..., 1]], -1)
    n = maps['nrm'] * 2 - 1; maps['nrm'] = np.stack([n[..., 0], n[..., 2], -n[..., 1]], -1)
    np.savez_compressed(out, **{k_: v.astype(np.float16) if k_ != 'mask' else v for k_, v in maps.items()})
    print('bake written', out)


if __name__ == '__main__':
    main()
