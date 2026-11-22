"""Cycles render of the built model in a game pose: unlit (the texture holds the anime lighting, as
in game), ink shell with back-face logic, football beads, contact shadow on a shadow catcher.
Writes an RGBA PNG (transparent film) for compositing.

usage: blender_render.py <skn> <tex> <ball> <ink.json> <skl> <joints> <anm|bind> <frame> <out.png>
                         <W> <H> <cam: yaw,pitch,dist,focal,target_y> [beads=1]"""
import json
import math
import os
import sys

import bpy  # noqa: I001
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import lolskn  # noqa: E402
import pyritofile  # noqa: E402
from animtest import Skeleton  # noqa: E402


def to_blender(P):
    P = P * np.array([-1.0, 1.0, 1.0])                 # League is left-handed: mirror x
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)


def mesh(name, verts, tris, uvs, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], tris.tolist())
    uvl = me.uv_layers.new(name='uv')
    loop_uv = uvs[tris].reshape(-1, 2)
    uvl.data.foreach_set('uv', np.stack([loop_uv[:, 0], 1 - loop_uv[:, 1]], 1).ravel())
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob


def emission_mat(name, img, shell=False, shade_ball=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    N = m.node_tree.nodes; L = m.node_tree.links
    for n in list(N):
        if n.type != 'OUTPUT_MATERIAL':
            N.remove(n)
    out = [n for n in N if n.type == 'OUTPUT_MATERIAL'][0]
    tex = N.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Cubic'
    em = N.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
    if shade_ball:
        geo = N.new('ShaderNodeNewGeometry')
        dot = N.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = (0.35, -0.55, 0.75)
        L.new(geo.outputs['Normal'], dot.inputs[0])
        rmp = N.new('ShaderNodeMapRange'); rmp.inputs['From Min'].default_value = -0.2; rmp.inputs['From Max'].default_value = 1.0
        rmp.inputs['To Min'].default_value = 0.55; rmp.inputs['To Max'].default_value = 1.05
        L.new(dot.outputs['Value'], rmp.inputs['Value'])
        mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
        L.new(tex.outputs['Color'], mul.inputs[6]); L.new(rmp.outputs['Result'], mul.inputs[7])
        L.new(mul.outputs[2], em.inputs['Color'])
    else:
        L.new(tex.outputs['Color'], em.inputs['Color'])
    if shell:
        geo = N.new('ShaderNodeNewGeometry'); tr = N.new('ShaderNodeBsdfTransparent'); mix = N.new('ShaderNodeMixShader')
        L.new(geo.outputs['Backfacing'], mix.inputs['Fac'])
        L.new(em.outputs[0], mix.inputs[1]); L.new(tr.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
    else:
        L.new(em.outputs[0], out.inputs[0])
    return m


def main():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    skn, tex, ball, ink, skl, joints, anm, frame, out, W, H, cam = a[:12]
    beads = int(a[12]) if len(a) > 12 else 1
    W, H, frame = int(W), int(H), int(frame)
    yaw, pitch, dist, focal, ty = [float(x) for x in cam.split(',')]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.view_settings.view_transform = 'Standard'
    s = lolskn.read(skn)
    sk = Skeleton(skl, joints)
    pos = s.verts['pos'].astype(float)
    if anm != 'bind':
        an = pyritofile.ANM(); an.read(None, raw=open(anm, 'rb').read())
        pos = sk.skin(pos, s.verts['infl'].astype(int), s.verts['w'].astype(float), sk.globals_for(an, frame))
    PB = to_blender(pos)
    uv = s.verts['uv'].astype(float)
    inkp = json.load(open(ink))
    img_c = bpy.data.images.load(tex); img_b = bpy.data.images.load(ball)
    m_main = emission_mat('main', img_c); m_shell = emission_mat('shell', img_c, shell=True)
    m_ball = emission_mat('ball', img_b, shade_ball=True)
    ink_uv = np.array([inkp['ink_dark'], inkp['ink_skin']])
    for sm in s.submeshes:
        if sm['name'] in ('Body', 'Pants') or (beads and sm['name'] in ('Bead_1', 'Bead_2', 'Bead_3', 'Bead_4', 'Bead_5')):
            t = s.indices[sm['istart']:sm['istart'] + sm['icount']].reshape(-1, 3).astype(int)[:, ::-1]   # mirrored -> flip
            if sm['name'].startswith('Bead'):
                mesh(sm['name'], PB, t, uv, m_ball); continue
            tu = uv[t].mean(1)
            is_shell = np.min(np.linalg.norm(tu[:, None, :] - ink_uv[None], axis=2), 1) < 0.004
            mesh(sm['name'] + '_main', PB, t[~is_shell], uv, m_main)
            mesh(sm['name'] + '_ink', PB, t[is_shell], uv, m_shell)
    # contact shadow
    bpy.ops.mesh.primitive_plane_add(size=900, location=(0, 0, 0.0))
    plane = bpy.context.active_object; plane.is_shadow_catcher = True
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0; sun.angle = math.radians(8)
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(25), math.radians(-10), math.radians(20))
    world = bpy.data.worlds.new('w'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    sc.world = world
    # camera orbiting the character
    camd = bpy.data.cameras.new('cam'); camd.lens = focal
    cam_ob = bpy.data.objects.new('cam', camd); sc.collection.objects.link(cam_ob); sc.camera = cam_ob
    cx, cy = PB[:, 0].mean(), PB[:, 1].mean()
    yr, pr = math.radians(yaw), math.radians(pitch)
    cam_ob.location = (cx + dist * math.sin(yr) * math.cos(pr), cy - dist * math.cos(yr) * math.cos(pr), ty + dist * math.sin(pr))
    tgt = bpy.data.objects.new('tgt', None); tgt.location = (cx, cy, ty); sc.collection.objects.link(tgt)
    c = cam_ob.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
