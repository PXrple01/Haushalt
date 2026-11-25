"""Builds the 'Flow Striker' mod for Yunara (base skin) as a CSLoL Manager .fantome.

Usage:  python3 build_mod.py <dir with downloaded game files>
The game-file dir must mirror CommunityDragon's layout (see fetch_game_files.sh).
"""
import io
import json
import os
import struct
import sys
import zipfile

import numpy as np
import xxhash
from PIL import Image

import lolbin as L
import lolskn
import make_assets
import recolor as RC
import vfxlib as V
from lolassets import flow_image, flow_rgba, TEX_BGRA8

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEN = os.path.join(ROOT, 'assets_src', 'gen')
BUILD = os.path.join(ROOT, 'build')
VERSION = '0.4.0'

SKIN = 'Characters/Yunara/Skins/Skin0'
PART = SKIN + '/Particles/'
RES = SKIN + '/Resources'
P = 'assets/characters/yunara/skins/base/particles/'
MV = 'assets/characters/yunara/skins/base/particles/mvfx/'
R_SPELL = 'Characters/Yunara/Spells/YunaraRAbility/YunaraR'

files = {}            # game path -> bytes
STATE = {}
CHAR = os.path.join(ROOT, 'assets_src', 'char')
STRIKER_TEX = 'assets/characters/yunara/skins/base/mvfx_striker_tx_cm.tex'


# ------------------------------------------------------------------ io helpers
def tex_bytes(im, mipmaps=True):
    im = im.convert('RGBA')
    w, h = im.size
    levels = [im]
    if mipmaps:
        cw, ch = w, h
        while cw > 1 or ch > 1:
            cw, ch = max(1, cw // 2), max(1, ch // 2)
            levels.append(im.resize((cw, ch), Image.LANCZOS))
    data = b''.join(np.asarray(lv)[..., [2, 1, 0, 3]].tobytes() for lv in reversed(levels))
    return struct.pack('<IHHBBBB', 0x00584554, w, h, 1, TEX_BGRA8, 0, 1 if mipmaps else 0) + data


def gen(name):
    return Image.open(os.path.join(GEN, name + '.png')).convert('RGBA')


def put_tex(path, im):
    files[path.lower()] = tex_bytes(im)


def scb_bytes(pos, uv, tris, name):
    pos = np.asarray(pos, np.float32); tris = np.asarray(tris, np.uint32).reshape(-1, 3)
    uvc = np.asarray(uv, np.float32)[tris]                   # per-corner uvs
    out = bytearray(b'r3d2Mesh' + struct.pack('<HH', 3, 2) + name.encode()[:128].ljust(128, b'\0'))
    out += struct.pack('<III', len(pos), len(tris), 2)  # flags: HasLocalOriginLocatorAndPivot (Riot default)
    mn, mx = pos.min(0), pos.max(0)
    out += struct.pack('<6f', *mn, *mx) + struct.pack('<I', 0) + pos.tobytes()
    out += struct.pack('<3f', *((mn + mx) / 2))
    mat = b'lambert1'.ljust(64, b'\0')
    for t, c in zip(tris, uvc):
        out += struct.pack('<3I', *t) + mat + struct.pack('<6f', c[0][0], c[1][0], c[2][0], c[0][1], c[1][1], c[2][1])
    return bytes(out)


# ------------------------------------------------------------------ steps
def step_recolor(b, game):
    stats = RC.recolor_bin(b)
    pre = os.path.join(game, 'png', 'assets_characters_yunara_skins_base_particles_')
    for n in RC.COLORED_TEXTURES:
        if n.endswith('_orb01'):
            continue                                           # replaced by footballs below
        put_tex(P + n + '.tex', flow_image(Image.open(pre + n + '.png')))
    return stats


def step_ball_projectiles(b):
    put_tex(P + 'yunara_base_ba_orb01.tex', gen('ball_sprite'))
    put_tex(P + 'yunara_base_q_orb01.tex', gen('ball_sprite_flow'))
    put_tex(P + 'yunara_base_passive_orb01.tex', gen('ball_sprite_flow'))
    put_tex(MV + 'mvfx_ball_ult.tex', gen('ball_sprite_ult'))
    spin = V.vvec3((-1080.0, 0.0, 0.0))
    targets = [('Yunara_Base_BA_Missile', 'head_4'), ('Yunara_Base_P_BA_Crit_missile', 'head_2'),
               ('Yunara_Base_Q_AA_Missile', 'head_4'), ('Yunara_Base_Q_AA_Crit_Missile', 'head_3'),
               ('Yunara_Base_W_Missile_Child', 'head_2'), ('Yunara_Base_W_Missile_Child', 'head_4'),
               ('Yunara_Base_RW_Laser', 'missileHead6')]
    done = 0
    for sysname, emname in targets:
        em = V.find_emitter(b.entry(PART + sysname).struct, emname)
        if em is None:
            print('  ! missing emitter', sysname, emname); continue
        em.set('birthColor', L.EMBED, V.vcolor((1.0, 1.0, 1.0, 1.0)))
        em.set('birthRotationalVelocity0', L.EMBED, spin)
        em.set('isRotationEnabled', L.FLAG, 1)
        if sysname == 'Yunara_Base_RW_Laser':
            em.set('texture', L.STRING, MV + 'mvfx_ball_ult.tex')
        done += 1
    return done


def step_bead_balls(b, game):
    # 1) geometry: every prayer bead becomes a football (same bone, same place)
    s = lolskn.read(os.path.join(game, 'assets/characters/yunara/skins/base/yunara_base.skn'))
    new_v, new_i, subs = [], [], []
    vcount = 0; icount = 0
    for m in s.submeshes:
        v = s.verts[m['vstart']:m['vstart'] + m['vcount']].copy()
        idx = s.indices[m['istart']:m['istart'] + m['icount']].astype(np.int64) - m['vstart']
        if m['name'].startswith('Bead_'):
            c = v['pos'].mean(0)
            pos, nrm, uv, tris = make_assets.uv_sphere(13.5, seg=28, rings=18)   # real football proportions
            nv = np.zeros(len(pos), s.verts.dtype)
            nv['pos'] = pos + c
            nv['nrm'] = nrm
            nv['uv'] = uv
            nv['infl'] = v['infl'][0]
            nv['w'] = (1.0, 0.0, 0.0, 0.0)
            if 'col' in nv.dtype.names:
                nv['col'] = v['col'][0]
            if 'tan' in nv.dtype.names:
                lon = uv[:, 0] * 2 * np.pi - np.pi
                nv['tan'] = np.stack([-np.sin(lon), np.zeros_like(lon), np.cos(lon), np.ones_like(lon)], -1)
            v, idx = nv, tris.reshape(-1).astype(np.int64)
        subs.append(dict(name=m['name'], vstart=vcount, vcount=len(v), istart=icount, icount=len(idx)))
        new_v.append(v); new_i.append(idx + vcount)
        vcount += len(v); icount += len(idx)
    assert vcount < 65536
    s.submeshes = subs
    s.verts = np.concatenate(new_v)
    s.indices = np.concatenate(new_i).astype(np.uint16)
    STATE['skn'] = s
    # 2) material: point the bead material at the football texture (same-length path keeps the
    #    raw entry valid) and make the rim light Flow-green
    # (texture paths inside these material entries are stored as xxh64 hashes)
    old_path = 'assets/characters/yunara/skins/base/yunara_base_weapon_tx_cm.tex'
    new_path = 'assets/characters/yunara/skins/base/mvfx_soccerball_beads_cm.tex'
    old_h = struct.pack('<Q', xxhash.xxh64(old_path.encode()).intdigest())
    new_h = struct.pack('<Q', xxhash.xxh64(new_path.encode()).intdigest())
    e = b.entry(SKIN + '/Materials/Yunara_Beads_Fresnel_Basic_inst')
    assert e is not None and e.raw is not None and e.raw.count(old_h) == 1
    raw = e.raw.replace(old_h, new_h)
    old_fres = struct.pack('<4f', 0.5799953937530518, 0.5300068855285645, 1.0, 0.6000000238418579)
    if raw.count(old_fres) == 1:
        raw = raw.replace(old_fres, struct.pack('<4f', 0.12, 0.65, 0.30, 0.55))
    e.raw = raw
    put_tex(new_path, gen('ball_albedo'))
    # 3) keep the idle orb aura subtle so the ball stays readable
    idle = b.entry(PART + 'Yunara_Base_Idle_Orb').struct
    for name in ('START', 'MAINFIRE', 'MAINFIRE1'):
        em = V.find_emitter(idle, name)
        if em is None:
            continue
        bc = em.get('birthColor')
        f = bc.field('constantValue')
        f.value = f.value[:3] + (f.value[3] * 0.4,)
        dyn = bc.get('dynamics')
        if dyn is not None:
            vals = dyn.field('values')
            vals.value.items = [c[:3] + (c[3] * 0.4,) for c in vals.value.items]
    return len([m for m in subs if m['name'].startswith('Bead_')])


OUTLINE_BONES = None


def outline_thickness(pos, vpart, joints):
    """Ink-shell thickness per vertex: proportional to the local limb radius (thin fingers, bold torso)."""
    J = {j['name']: np.array(j['pos']) for j in joints['joints']}
    segs = []
    for a, b in (('Pelvis', 'Spine1'), ('Spine1', 'Spine2'), ('Spine2', 'Chest'), ('Chest', 'Neck'), ('Neck', 'Head')):
        segs.append((J[a], J[b]))
    for s in ('L', 'R'):
        for a, b in ((f'{s}_Clavicle', f'{s}_Shoulder'), (f'{s}_Shoulder', f'{s}_Elbow'), (f'{s}_Elbow', f'{s}_Hand'),
                     (f'{s}_Hip', f'{s}_KneeLower'), (f'{s}_KneeLower', f'{s}_Foot'), (f'{s}_Foot', f'{s}_Toe')):
            segs.append((J[a], J[b]))
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
            segs.append((J[f'{s}_{f}1'], J[f'{s}_{f}3']))
    dmin = np.full(len(pos), 1e9)
    for a, b in segs:
        ab = b - a
        t = np.clip(((pos - a) @ ab) / (ab @ ab), 0, 1)
        dmin = np.minimum(dmin, np.linalg.norm(pos - (a + t[:, None] * ab), axis=1))
    th = np.clip(0.11 * dmin, 0.35, 1.35)
    th[vpart == 1] = 0.75                   # head
    th[(vpart == 2) | (vpart == 3)] = 0.75  # hair
    th[vpart == 4] = np.clip(0.2 * dmin[vpart == 4], 0.22, 0.45)
    return th


def step_character(b):
    """Replaces Yunara's body with the original anime striker (Body = body/head/hands/boots, Pants = hair),
    plus an inverted-hull ink outline (League culls back faces, as its double-sided cloth shows)."""
    s = STATE['skn']
    d = np.load(os.path.join(CHAR, 'striker2_rigged.npz'))
    ink = json.load(open(os.path.join(CHAR, 'striker2_ink.json')))
    joints = json.load(open(os.path.join(CHAR, 'yunara_joints.json')))
    tris, part = d['tris'], d['part']
    vpart = np.full(len(d['pos']), -1)
    for k in range(7):
        vpart[np.unique(tris[part == k])] = k
    th = outline_thickness(d['pos'].astype(np.float64), vpart, joints)
    new_v, new_i, subs = [], [], []
    vcount = icount = 0
    for name, sel in (('Body', np.isin(part, (0, 1, 4, 5, 6))), ('Pants', np.isin(part, (2, 3)))):
        t = tris[sel]
        used = np.unique(t)
        remap = np.full(len(d['pos']), -1, np.int64); remap[used] = np.arange(len(used))
        nv = np.zeros(len(used), s.verts.dtype)
        nv['pos'] = d['pos'][used]; nv['nrm'] = d['nrm'][used]; nv['uv'] = d['uv'][used]
        nv['infl'] = d['infl'][used]; nv['w'] = d['w'][used]
        if 'col' in nv.dtype.names:
            nv['col'] = 255
        if 'tan' in nv.dtype.names:
            nv['tan'] = (1.0, 0.0, 0.0, 1.0)
        idx = remap[t].reshape(-1)
        # ink shell: same skinning, pushed out along the normal, reversed winding, ink texel
        shell_tris = t[~np.isin(part[sel], (5, 6))]
        sv_used = np.unique(shell_tris)
        sremap = np.full(len(d['pos']), -1, np.int64); sremap[sv_used] = np.arange(len(sv_used)) + len(used)
        sv = np.zeros(len(sv_used), s.verts.dtype)
        sv['pos'] = d['pos'][sv_used] + d['nrm'][sv_used] * th[sv_used, None]
        sv['nrm'] = d['nrm'][sv_used]; sv['infl'] = d['infl'][sv_used]; sv['w'] = d['w'][sv_used]
        skin_like = np.isin(vpart[sv_used], (1, 4))
        sv['uv'] = np.where(skin_like[:, None], np.array(ink['ink_skin'], np.float32), np.array(ink['ink_dark'], np.float32))
        if 'col' in sv.dtype.names:
            sv['col'] = 255
        if 'tan' in sv.dtype.names:
            sv['tan'] = (1.0, 0.0, 0.0, 1.0)
        sidx = sremap[shell_tris[:, ::-1]].reshape(-1)
        allv = np.concatenate([nv, sv]); alli = np.concatenate([idx, sidx])
        subs.append(dict(name=name, vstart=vcount, vcount=len(allv), istart=icount, icount=len(alli)))
        new_v.append(allv); new_i.append(alli + vcount); vcount += len(allv); icount += len(alli)
    for m in s.submeshes:                     # dragon head, tail and the football beads stay
        if m['name'] in ('Body', 'Pants'):
            continue
        v = s.verts[m['vstart']:m['vstart'] + m['vcount']]
        idx = s.indices[m['istart']:m['istart'] + m['icount']].astype(np.int64) - m['vstart']
        subs.append(dict(name=m['name'], vstart=vcount, vcount=len(v), istart=icount, icount=len(idx)))
        new_v.append(v); new_i.append(idx + vcount); vcount += len(v); icount += len(idx)
    assert vcount < 65536, vcount
    s.submeshes, s.verts = subs, np.concatenate(new_v)
    s.indices = np.concatenate(new_i).astype(np.uint16)
    put_tex(STRIKER_TEX, Image.open(os.path.join(CHAR, 'striker2_albedo.png')))
    # loading screen + HUD portraits (same paths as the originals inside Yunara's archive)
    put_tex('assets/characters/yunara/skins/base/yunaraloadscreen_0.tex', Image.open(os.path.join(CHAR, 'loadscreen.png')))
    put_tex('assets/characters/yunara/hud/yunara_square_0.tex', Image.open(os.path.join(CHAR, 'icon_square.png')))
    put_tex('assets/characters/yunara/hud/yunara_circle_0.tex', Image.open(os.path.join(CHAR, 'icon_circle.png')))
    smp = b.entry(SKIN).struct.get('skinMeshProperties')
    smp.set('texture', L.PATH, xxhash.xxh64(STRIKER_TEX.encode()).intdigest())
    return f"{vcount} verts total, {len(tris)} model tris + ink shell"


def step_write_skn():
    out = os.path.join(BUILD, 'tmp.skn'); os.makedirs(BUILD, exist_ok=True)
    lolskn.write(STATE['skn'], out)
    files['assets/characters/yunara/skins/base/yunara_base.skn'] = open(out, 'rb').read()
    os.remove(out)


def step_ult_bead_seams(b):
    """During R the eight footballs get glowing green seams (attached-mesh glow on the beads)."""
    put_tex(MV + 'mvfx_ball_seams.tex', gen('ball_seams_glow'))
    path = PART + 'MV_R_BeadSeams'
    st = V.clone_system(b, PART + 'Yunara_Base_Q_Buff_OnBeads', path, keep_emitters={'ADD_EdgeGlow'})
    em = V.find_emitter(st, 'ADD_EdgeGlow')
    em.set('emitterName', L.STRING, 'MV_SeamGlow')
    em.set('texture', L.STRING, MV + 'mvfx_ball_seams.tex')
    em.set('birthColor', L.EMBED, V.vcolor((0.12, 0.75, 0.35, 1.0)))
    em.remove('texDiv')
    em.set('birthScale0', L.EMBED, V.vvec3((1.012, 1.0, 1.0)))
    V.add_resource(b, RES, 'MV_R_BeadSeams', path)
    # persistent conditions: copy the Q-buff bead entries, but key them on the R buff
    import copy
    skin = b.entry(SKIN).struct
    lst = skin.field('PersistentEffectConditions').value
    q_hash = L.fnv1a('Yunara_Q_Buff_OnBeads')
    added = []
    for cond in lst.items:
        vfxs = cond.get('PersistentVfxs')
        if not vfxs or not any(v.get('effectKey') == q_hash for v in vfxs.items):
            continue
        c2 = copy.deepcopy(cond)
        def retarget(s):
            for f in s.fields:
                if f.hash == L.fnv1a('Spell'):
                    f.value = L.fnv1a(R_SPELL)
                elif isinstance(f.value, L.Struct):
                    retarget(f.value)
                elif isinstance(f.value, L.List):
                    for x in f.value.items:
                        if isinstance(x, L.Struct):
                            retarget(x)
        retarget(c2)
        for v in c2.get('PersistentVfxs').items:
            v.set('effectKey', L.HASH, L.fnv1a('MV_R_BeadSeams'))
        added.append(c2)
    lst.items.extend(added)
    return len(added)


def step_ult_cast(b):
    """R activation: chains wrap around -> burst -> the METAVISION eye opens -> dissolves into light lines."""
    for n in ('chain_metal', 'eye', 'eye_text', 'eye_backing', 'reticle', 'flash_star', 'shock_ring',
              'light_dot', 'pitch_lines'):
        put_tex(MV + 'mvfx_' + n + '.tex', gen(n))
    rp, ru, rt = make_assets.chain_ring(radius=64.0, count=20)
    files[MV + 'mvfx_chain_ring.scb'] = scb_bytes(rp, ru, rt, 'mvfx_chain_ring')
    lp, lu, lt = make_assets.chain_link()
    files[MV + 'mvfx_chain_link.scb'] = scb_bytes(lp, lu, lt, 'mvfx_chain_link')
    T = lambda n: MV + 'mvfx_' + n + '.tex'
    FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72)
    fade = lambda c, t_in=0.08, t_out=0.85: ([0.0, t_in, t_out, 1.0], [c + (0.0,), c + (1.0,), c + (1.0,), c + (0.0,)])
    ems = []
    BREAK = 0.30
    # ---- chains wrapped around the body
    rings = [((0, 60, 0), (8, 0, 0)), ((0, 105, 0), (-13, 35, 0)), ((0, 150, 0), (10, 70, 0))]
    for k, (pos, rot) in enumerate(rings):
        tighten = ([0.0, 0.22, 0.85, 1.0], [(1.28, 1.28, 1.28), (1.0, 1.0, 1.0), (0.93, 0.93, 0.93), (0.9, 0.9, 0.9)])
        ems.append(V.emitter(f'MV_Chain{k}', T('chain_metal'), blend=1, life=BREAK + 0.02, pos=pos, rotation=rot,
                             scale=(1.0, 1.0, 1.0), scale_curve=tighten, spin=(0, 25 * (1 if k % 2 else -1), 0),
                             mesh=MV + 'mvfx_chain_ring.scb', color_curve=fade((1.0, 1.0, 1.0), 0.12, 0.95),
                             pass_=9000 + k, backface=True))
        ems.append(V.emitter(f'MV_ChainGlow{k}', T('chain_metal'), blend=4, life=BREAK + 0.02, pos=pos, rotation=rot,
                             scale=(1.03, 1.03, 1.03), scale_curve=tighten, spin=(0, 25 * (1 if k % 2 else -1), 0),
                             mesh=MV + 'mvfx_chain_ring.scb', pass_=9010 + k, backface=True,
                             color_curve=([0.0, 0.5, 0.88, 1.0], [FLOW + (0.0,), FLOW + (0.35,), HI + (1.0,), (1, 1, 1, 0.0)])))
    # ---- the burst
    ems.append(V.emitter('MV_ChainShards', T('chain_metal'), blend=1, single=False, rate=650, emitter_life=0.05,
                         delay=BREAK, life=0.95, bind=0.0, pos=(0, 105, 0), spawn_radius=60,
                         mesh=MV + 'mvfx_chain_link.scb', backface=True,
                         scale=V.vvec3((1.1, 1.1, 1.1), rand=[(0.7, 1.3), None, None]),
                         velocity=V.vvec3((950, 650, 950), rand=[(-1, 1), (0.15, 1.0), (-1, 1)]),
                         accel=(0, -1700, 0), rotation=V.vvec3((180, 180, 180), rand=[(-1, 1)] * 3),
                         spin=V.vvec3((900, 700, 0), rand=[(-1, 1), (-1, 1), None]),
                         color_curve=([0.0, 0.1, 0.65, 1.0], [HI + (1.0,), (1, 1, 1, 1.0), (1, 1, 1, 1.0), FLOW + (0.0,)]),
                         pass_=9020))
    ems.append(V.emitter('MV_BurstFlash', T('flash_star'), blend=4, delay=BREAK - 0.02, life=0.38, pos=(0, 110, 0),
                         scale=(95, 95, 1), scale_curve=([0, 0.18, 1], [(0.3,) * 3, (1.35,) * 3, (1.7,) * 3]),
                         color_curve=([0, 0.2, 1], [(1, 1, 1, 1), HI + (0.9,), FLOW + (0.0,)]),
                         rotation=V.vvec3((45, 0, 0), rand=[(-1, 1), None, None]), pass_=9030))
    ems.append(V.emitter('MV_BurstRing', T('shock_ring'), blend=4, delay=BREAK, life=0.45, pos=(0, 110, 0),
                         scale=(40, 40, 1), scale_curve=([0, 1], [(1,) * 3, (6.0,) * 3]),
                         color_curve=([0, 0.15, 1], [HI + (0.0,), FLOW + (1.0,), DEEP + (0.0,)]), pass_=9031))
    ems.append(V.emitter('MV_BurstGround', T('shock_ring'), blend=4, delay=BREAK, life=0.6, bind=0.0,
                         rotation=(-90, -90, 0), ground=True, scale=(60, 60, 1),
                         scale_curve=([0, 1], [(1,) * 3, (7.0,) * 3]),
                         color_curve=([0, 0.1, 1], [FLOW + (0.0,), FLOW + (1.0,), DEEP + (0.0,)]), pass_=-2900))
    ems.append(V.emitter('MV_BurstSparks', P + 'base_generic_sparks_add.tex', blend=4, single=False, rate=1800,
                         emitter_life=0.03, delay=BREAK, life=0.5, bind=0.0, pos=(0, 110, 0), spawn_radius=30,
                         scale=(7, 7, 7), velocity=V.vvec3((1200, 900, 1200), rand=[(-1, 1), (-0.4, 1), (-1, 1)]),
                         drag=(3.0, 3.0, 3.0), direction_oriented=True, dir_scale=0.004,
                         color_curve=([0, 0.6, 1], [HI + (1.0,), FLOW + (0.8,), DEEP + (0.0,)]), pass_=9032))
    # ---- the METAVISION eye
    EYE_T = 0.42; EYE_L = 1.45; EYE_POS = (0, 300, 0); EYE_S = (145, 72, 1)
    opening = ([0.0, 0.09, 0.15, 1.0], [(1, 0.02, 1), (1, 1.12, 1), (1, 1, 1), (1.03, 1.03, 1)])
    ems.append(V.emitter('MV_EyeBacking', T('eye_backing'), blend=1, delay=EYE_T, life=EYE_L, pos=EYE_POS,
                         scale=EYE_S, uniform=False, scale_curve=opening, color_curve=fade((1.0, 1.0, 1.0)), pass_=9100))
    ems.append(V.emitter('MV_EyeReticle', T('reticle'), blend=4, delay=EYE_T + 0.05, life=EYE_L - 0.05, pos=EYE_POS,
                         scale=(165, 165, 1), scale_curve=([0, 0.15, 1], [(1.35,) * 3, (1.0,) * 3, (0.97,) * 3]),
                         spin=(32, 0, 0), color_curve=fade(tuple(x * 0.75 for x in FLOW), 0.12, 0.8), pass_=9101))
    ems.append(V.emitter('MV_Eye', T('eye'), blend=4, delay=EYE_T, life=EYE_L, pos=EYE_POS, scale=EYE_S,
                         uniform=False, scale_curve=opening, pass_=9102,
                         color_curve=([0.0, 0.08, 0.16, 0.84, 0.92, 1.0],
                                      [(0.5, 0.4, 1, 0), (1, 1, 1, 1), (1, 1, 1, 1), (0.9, 0.85, 1, 1), (1, 1, 1, 1), (1, 1, 1, 0)])))
    ems.append(V.emitter('MV_EyeTextFlare', T('eye_text'), blend=4, delay=EYE_T + 0.16, life=0.45, pos=EYE_POS,
                         scale=EYE_S, uniform=False, pass_=9103,
                         color_curve=([0, 0.15, 1], [(1, 1, 1, 0), (1, 1, 1, 1), FLOW + (0,)])))
    ems.append(V.emitter('MV_PupilFlash', T('flash_star'), blend=4, delay=EYE_T + 0.16, life=0.32,
                         pos=(0, 305, 0), scale=(50, 50, 1), scale_curve=([0, 0.25, 1], [(0.2,) * 3, (1.4,) * 3, (0.8,) * 3]),
                         color_curve=([0, 0.25, 1], [(1, 1, 1, 1), HI + (1,), FLOW + (0,)]), pass_=9104))
    # ---- dissolve into light lines that rain down and draw a pitch on the ground
    END = EYE_T + EYE_L - 0.12
    ems.append(V.emitter('MV_EyeEndFlash', T('flash_star'), blend=4, delay=END, life=0.28, pos=EYE_POS,
                         scale=(110, 110, 1), scale_curve=([0, 1], [(0.5,) * 3, (1.5,) * 3]),
                         color_curve=([0, 0.2, 1], [(1, 1, 1, 0.9), HI + (0.7,), FLOW + (0,)]), pass_=9105))
    ems.append(V.emitter('MV_LightLines', T('light_dot'), blend=4, single=False, rate=1100, emitter_life=0.05,
                         delay=END, life=0.6, bind=0.0, pos=EYE_POS, spawn_radius=110, scale=(6, 6, 6),
                         velocity=V.vvec3((750, 950, 750), rand=[(-1, 1), (-1.0, 0.25), (-1, 1)]),
                         drag=(1.5, 1.5, 1.5), direction_oriented=True, dir_scale=0.006,
                         color_curve=([0, 0.5, 1], [HI + (1,), FLOW + (0.9,), DEEP + (0,)]), pass_=9106))
    ems.append(V.emitter('MV_PitchLines', T('pitch_lines'), blend=4, delay=END + 0.15, life=1.0, bind=0.0,
                         rotation=(-90, -90, 0), ground=True, scale=(235, 235, 1),
                         scale_curve=([0, 0.2, 1], [(0.82,) * 3, (1.0,) * 3, (1.04,) * 3]),
                         color_curve=([0, 0.12, 0.6, 1], [HI + (0,), (1, 1, 1, 1), FLOW + (0.8,), DEEP + (0,)]), pass_=-2890))
    cast = b.entry(PART + 'Yunara_Base_R_Cast').struct
    # Yunara's own ground cast symbols are replaced by the pitch + shockwave
    f = cast.field('complexEmitterDefinitionData')
    drop = {'Blend_FLoor1', 'decalDark_backer4', 'decalDark_backer5', 'decalDark_backer6'}
    f.value.items = [e for e in f.value.items if e.get('emitterName') not in drop]
    V.add_emitters(cast, ems)
    return len(ems)


# ------------------------------------------------------------------ packaging
def wad_bytes(entries):
    """WAD v3.3, uncompressed entries, sorted by path hash."""
    items = sorted(((xxhash.xxh64(p.lower().encode()).intdigest(), d) for p, d in entries.items()))
    header = b'RW' + bytes([3, 3]) + b'\0' * 256 + struct.pack('<Q', 0) + struct.pack('<I', len(items))
    toc_size = 32 * len(items)
    offset = len(header) + toc_size
    toc = bytearray(); blob = bytearray()
    for h, d in items:
        toc += struct.pack('<QIIIBBHQ', h, offset + len(blob), len(d), len(d), 0, 0, 0, xxhash.xxh3_64(d).intdigest())
        blob += d
    return header + bytes(toc) + bytes(blob)


def step_vfx_polish(b):
    """v0.4 polish: ball glow + spark trails, layered impacts (flash, ring, sparks; crits get a goal-net
    flash and an anime impact frame), Q flow burst + aura, E afterimages, dash ghosts, ult impact frame
    and god rays, a 15 s Metavision aura with a small eye above the head. Everything hangs on skeleton
    bones or attached-mesh submesh names (Body/Pants), so it survives a model swap."""
    for n in ('hex_net', 'manga_burst', 'manga_burst_light', 'god_rays', 'center_circle'):
        im = gen(n)
        put_tex(MV + 'mvfx_' + n + '.tex', im.resize((512, 512), Image.LANCZOS) if im.width > 512 else im)
    T = lambda n: MV + 'mvfx_' + n + '.tex'
    SPARK = P + 'base_generic_sparks_add.tex'
    FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); W1 = (1.0, 1.0, 1.0)
    sysget = lambda n: b.entry(PART + n).struct if b.entry(PART + n) else None
    added = 0

    def add(sysname, ems):
        nonlocal added
        st = sysget(sysname)
        if st is None:
            print('   ! missing system', sysname); return
        V.add_emitters(st, ems); added += len(ems)

    # ---- projectiles: soft flow glow behind the ball + sparkling trail
    for sysname, big in (('Yunara_Base_BA_Missile', 0), ('Yunara_Base_P_BA_Crit_missile', 1), ('Yunara_Base_Q_AA_Missile', 1),
                         ('Yunara_Base_Q_AA_Crit_Missile', 1), ('Yunara_Base_Q_AA_Bounce_Missile', 0),
                         ('Yunara_Base_Q_AA_Crit_Bounce_Missile', 1), ('Yunara_Base_W_Missile_Child', 2)):
        g = (16, 21, 28)[big]
        add(sysname, [
            V.emitter('MV_BallGlow', T('light_dot'), blend=4, life=3.0, scale=(g, g, g), color=FLOW + (0.85,), pass_=200,
                      color_curve=([0, 0.04, 1], [FLOW + (0.0,), FLOW + (1.0,), FLOW + (1.0,)])),
            V.emitter('MV_BallSparks', SPARK, blend=4, single=False, rate=48 + 16 * big, emitter_life=3.0, life=0.32,
                      bind=0.0, scale=V.vvec3((4.2 + big, 4.2 + big, 4.2 + big), rand=[(0.6, 1.2), None, None]),
                      scale_curve=([0, 1], [(1, 1, 1), (0.15, 0.15, 0.15)]),
                      velocity=V.vvec3((70, 70, 70), rand=[(-1, 1), (-1, 1), (-1, 1)]), drag=(2.5, 2.5, 2.5),
                      color_curve=([0, 0.35, 1], [HI + (1.0,), FLOW + (0.85,), DEEP + (0.0,)]), pass_=210, importance=2)])
    # ---- impacts: flash + ring + sparks, crits add a goal-net flash and an anime impact frame
    impacts = [('Yunara_Base_BA_Tar', 0), ('Yunara_Base_Q_AA_Tar', 1), ('Yunara_Base_Q_AA_Bounce_Missile_Tar', 0),
               ('Yunara_Base_P_BA_Crit_Tar', 2), ('Yunara_Base_Q_AA_Crit_Tar', 2), ('Yunara_Base_Q_AA_Crit_Bounce_Missile_Tar', 2),
               ('Yunara_Base_W_tar', 1), ('Yunara_Base_RW_Tar', 2)]
    for sysname, lvl in impacts:
        k = 1.0 + 0.25 * lvl
        ems = [
            V.emitter('MV_HitFlash', T('flash_star'), blend=4, life=0.16, scale=(24 * k, 24 * k, 1),
                      scale_curve=([0, 0.25, 1], [(0.5,) * 3, (1.3,) * 3, (1.5,) * 3]),
                      color_curve=([0, 0.3, 1], [W1 + (1.0,), HI + (0.8,), FLOW + (0.0,)]),
                      rotation=V.vvec3((45, 0, 0), rand=[(-1, 1), None, None]), pass_=650),
            V.emitter('MV_HitRing', T('shock_ring'), blend=4, life=0.22, scale=(10 * k, 10 * k, 1),
                      scale_curve=([0, 0.4, 1], [(1,) * 3, (3.4,) * 3, (4.4,) * 3]),
                      color_curve=([0, 0.15, 1], [HI + (0.0,), FLOW + (1.0,), DEEP + (0.0,)]), pass_=651),
            V.emitter('MV_HitSparks', SPARK, blend=4, single=False, rate=550 + 250 * lvl, emitter_life=0.02, life=0.35, bind=0.0,
                      scale=V.vvec3((3.6, 3.6, 3.6), rand=[(0.6, 1.3), None, None]),
                      velocity=V.vvec3((430 * k, 380 * k, 430 * k), rand=[(-1, 1), (0.2, 1.0), (-1, 1)]),
                      accel=(0, -1300, 0), drag=(1.5, 1.5, 1.5), direction_oriented=True, dir_scale=0.0035,
                      color_curve=([0, 0.5, 1], [HI + (1.0,), FLOW + (0.9,), DEEP + (0.0,)]), pass_=652, importance=2)]
        if lvl == 2:
            ems += [
                V.emitter('MV_NetFlash', T('hex_net'), blend=4, life=0.30, scale=(32, 32, 1),
                          scale_curve=([0, 0.2, 1], [(0.7,) * 3, (1.05,) * 3, (1.25,) * 3]),
                          color_curve=([0, 0.12, 1], [HI + (0.0,), HI + (0.95,), FLOW + (0.0,)]),
                          rotation=V.vvec3((30, 0, 0), rand=[(-1, 1), None, None]), pass_=653),
                V.emitter('MV_ImpactFrame', T('manga_burst'), blend=1, life=0.10, scale=(85, 85, 1),
                          color_curve=([0, 0.5, 1], [W1 + (0.9,), W1 + (0.8,), W1 + (0.0,)]), pass_=9500)]
        add(sysname, ems)
    # ---- Q: activation burst + flow aura while active
    add('Yunara_Base_Q_Cast', [
        V.emitter('MV_QRing', T('shock_ring'), blend=4, life=0.45, bind=1.0, rotation=(-90, -90, 0), ground=True,
                  scale=(30, 30, 1), scale_curve=([0, 0.5, 1], [(1,) * 3, (4.2,) * 3, (5.2,) * 3]),
                  color_curve=([0, 0.1, 1], [HI + (0.0,), FLOW + (1.0,), DEEP + (0.0,)]), pass_=-2800),
        V.emitter('MV_QPillar', T('light_streak'), blend=4, life=0.38, pos=(0, 120, 0), scale=(14, 170, 1), uniform=False,
                  scale_curve=([0, 0.2, 1], [(0.3, 0.6, 1), (1.0, 1.0, 1), (0.15, 1.25, 1)]),
                  color_curve=([0, 0.2, 1], [W1 + (0.0,), HI + (0.95,), FLOW + (0.0,)]), pass_=699),
        V.emitter('MV_QRise', T('light_dot'), blend=4, single=False, rate=520, emitter_life=0.08, life=0.6, bind=0.0,
                  pos=(0, 30, 0), spawn_radius=30, scale=(4.2, 4.2, 4.2),
                  velocity=V.vvec3((0, 540, 0), rand=[None, (0.6, 1.25), None]), drag=(1.2, 1.2, 1.2),
                  direction_oriented=True, dir_scale=0.006,
                  color_curve=([0, 0.5, 1], [HI + (1.0,), FLOW + (0.9,), DEEP + (0.0,)]), pass_=700),
        V.emitter('MV_QFlash', T('flash_star'), blend=4, life=0.22, pos=(0, 120, 0), scale=(60, 60, 1),
                  scale_curve=([0, 0.3, 1], [(0.4,) * 3, (1.3,) * 3, (1.5,) * 3]),
                  color_curve=([0, 0.3, 1], [W1 + (0.9,), HI + (0.7,), FLOW + (0.0,)]), pass_=701)])
    add('Yunara_Base_Q_Buff_OnBase', [
        V.emitter('MV_QAuraGround', T('center_circle'), blend=4, life=8.0, rotation=(-90, -90, 0), ground=True,
                  scale=(80, 80, 1), color_curve=([0, 0.04, 0.94, 1], [FLOW + (0.0,), FLOW + (0.45,), FLOW + (0.45,), FLOW + (0.0,)]),
                  pass_=-2790),
        V.emitter('MV_QMotes', SPARK, blend=4, single=False, rate=11, emitter_life=8.0, life=1.0, bind=0.0, pos=(0, 10, 0),
                  spawn_radius=26, scale=(4.0, 4.0, 4.0), scale_curve=([0, 1], [(1,) * 3, (0.3,) * 3]),
                  velocity=V.vvec3((0, 140, 0), rand=[None, (0.7, 1.3), None]),
                  color_curve=([0, 0.4, 1], [HI + (0.9,), FLOW + (0.7,), DEEP + (0.0,)]), pass_=702, importance=2)])
    # ---- E: afterimages while sprinting; ult-dashes get a ghost burst + ground ring
    ghost = V.clone_emitter(b, PART + 'Yunara_Base_Q_Buff_OnBeads', 'ADD_EdgeGlow', 'MV_EGhost')
    prim = ghost.get('primitive'); mm = prim.get('mMesh')
    mm.set('mSubmeshesToDraw', L.LIST, V.submesh_list(['Body', 'Pants']))
    mm.set('mLockMeshToAttachment', L.BOOL, False)
    ghost.remove('texDiv')
    ghost.set('rate', L.EMBED, V.vfloat(9.0)); ghost.remove('isSingleParticle')
    ghost.set('lifetime', L.OPTION, L.Option(L.F32, 3.0))
    ghost.set('particleLifetime', L.EMBED, V.vfloat(0.30))
    ghost.set('bindWeight', L.EMBED, V.vfloat(0.0))
    ghost.set('birthScale0', L.EMBED, V.vvec3((1.0, 1.0, 1.0)))
    ghost.set('birthColor', L.EMBED, V.vcolor(FLOW + (0.55,)))
    V.set_curve_color(ghost, [0, 1], [(1, 1, 1, 1), (1, 1, 1, 0)])
    add('Yunara_Base_E_SpeedBuff', [ghost])
    for dash in ('Yunara_Base_RE_ShortDash', 'Yunara_Base_RE_FlipKick'):
        st = sysget(dash)
        if st is None:
            continue
        av = V.find_emitter(st, 'AV_ChromaticAbberation')
        if av is not None:                      # was drawing the body with Yunara's own texture
            av.set('texture', L.STRING, STRIKER_TEX)
        g2 = V.clone_emitter(b, PART + 'Yunara_Base_Q_Buff_OnBeads', 'ADD_EdgeGlow', 'MV_DashGhosts')
        mm = g2.get('primitive').get('mMesh')
        mm.set('mSubmeshesToDraw', L.LIST, V.submesh_list(['Body', 'Pants'])); mm.set('mLockMeshToAttachment', L.BOOL, False)
        g2.remove('texDiv'); g2.remove('isSingleParticle')
        g2.set('rate', L.EMBED, V.vfloat(40.0)); g2.set('lifetime', L.OPTION, L.Option(L.F32, 0.15))
        g2.set('particleLifetime', L.EMBED, V.vfloat(0.35)); g2.set('bindWeight', L.EMBED, V.vfloat(0.0))
        g2.set('birthScale0', L.EMBED, V.vvec3((1.0, 1.0, 1.0))); g2.set('birthColor', L.EMBED, V.vcolor(HI + (0.6,)))
        V.set_curve_color(g2, [0, 0.4, 1], [(1, 1, 1, 1), (0.6, 0.9, 0.7, 0.6), (0.3, 0.6, 0.4, 0.0)])
        add(dash, [g2, V.emitter('MV_DashRing', T('shock_ring'), blend=4, life=0.35, bind=0.0, rotation=(-90, -90, 0), ground=True,
                                 scale=(25, 25, 1), scale_curve=([0, 1], [(1,) * 3, (4.4,) * 3]),
                                 color_curve=([0, 0.1, 1], [HI + (0.0,), FLOW + (1.0,), DEEP + (0.0,)]), pass_=-2780)])
    # ---- R cast: anime impact frame at the chain break + god rays behind the eye
    BREAK = 0.30; EYE_T = 0.42; EYE_L = 1.45
    add('Yunara_Base_R_Cast', [
        V.emitter('MV_ImpactFrameR', T('manga_burst'), blend=1, delay=BREAK - 0.01, life=0.12, pos=(0, 110, 0), scale=(240, 240, 1),
                  color_curve=([0, 0.55, 1], [W1 + (0.95,), W1 + (0.85,), W1 + (0.0,)]), pass_=9600),
        V.emitter('MV_ImpactLightR', T('manga_burst_light'), blend=4, delay=BREAK - 0.01, life=0.16, pos=(0, 110, 0),
                  scale=(250, 250, 1), scale_curve=([0, 1], [(0.9,) * 3, (1.15,) * 3]),
                  color_curve=([0, 0.3, 1], [HI + (0.9,), FLOW + (0.7,), DEEP + (0.0,)]), pass_=9601),
        V.emitter('MV_EyeRays', T('god_rays'), blend=4, delay=EYE_T + 0.08, life=EYE_L - 0.1, pos=(0, 300, 0),
                  scale=(210, 210, 1), spin=(18, 0, 0), scale_curve=([0, 0.15, 1], [(0.6,) * 3, (1.0,) * 3, (1.1,) * 3]),
                  color_curve=([0, 0.15, 0.8, 1], [FLOW + (0.0,), HI + (0.55,), FLOW + (0.45,), DEEP + (0.0,)]), pass_=9098)])
    # ---- R buff (15 s Metavision): tactical ground ring, centre circle, small eye above the head, rising motes
    add('Yunara_Base_R_Buff_OnBase', [
        V.emitter('MV_RGround', T('reticle'), blend=4, life=15.0, rotation=(-90, -90, 0), ground=True, scale=(105, 105, 1),
                  color_curve=([0, 0.02, 0.97, 1], [FLOW + (0.0,), HI + (0.5,), FLOW + (0.42,), FLOW + (0.0,)]), pass_=-2770),
        V.emitter('MV_RCircle', T('center_circle'), blend=4, life=15.0, rotation=(-90, -90, 0), ground=True, scale=(72, 72, 1),
                  color_curve=([0, 0.02, 0.97, 1], [FLOW + (0.0,), FLOW + (0.35,), FLOW + (0.3,), FLOW + (0.0,)]), pass_=-2769),
        V.emitter('MV_ROverEye', T('eye'), blend=4, life=15.0, pos=(0, 262, 0), scale=(30, 15, 1), uniform=False,
                  scale_curve=([0, 0.03, 0.06, 1], [(1, 0.05, 1), (1, 1.15, 1), (1, 1, 1), (1, 1, 1)]),
                  color_curve=([0, 0.02, 0.97, 1], [FLOW + (0.0,), W1 + (0.9,), W1 + (0.85,), W1 + (0.0,)]), pass_=9050),
        V.emitter('MV_RMotes', SPARK, blend=4, single=False, rate=16, emitter_life=15.0, life=1.2, bind=0.0, pos=(0, 8, 0),
                  spawn_radius=32, scale=(4.5, 4.5, 4.5), scale_curve=([0, 1], [(1,) * 3, (0.25,) * 3]),
                  velocity=V.vvec3((0, 170, 0), rand=[None, (0.7, 1.3), None]),
                  color_curve=([0, 0.4, 1], [HI + (0.9,), FLOW + (0.75,), DEEP + (0.0,)]), pass_=703, importance=2)])
    return added


def preview_card():
    W, H = 640, 360
    bg = Image.new('RGBA', (W, H), (12, 12, 30, 255))
    eye = gen('eye').resize((560, 280), Image.LANCZOS)
    bg.alpha_composite(eye, (40, 20))
    ball = gen('ball_sprite_ult').resize((150, 150), Image.LANCZOS)
    bg.alpha_composite(ball, (W - 175, H - 165))
    return bg


def main(game):
    os.makedirs(BUILD, exist_ok=True)
    b = L.read(os.path.join(game, 'data/characters/yunara/skins/skin0.bin'))
    print('recolor            :', step_recolor(b, game))
    print('football missiles  :', step_ball_projectiles(b))
    print('football beads     :', step_bead_balls(b, game))
    print('striker model      :', step_character(b))
    step_write_skn()
    print('ult seam conditions:', step_ult_bead_seams(b))
    print('ult cast emitters  :', step_ult_cast(b))
    print('polish emitters    :', step_vfx_polish(b))
    data = L.write(b)
    L.read(data)                                              # sanity: must parse again
    files['data/characters/yunara/skins/skin0.bin'] = data
    wad = wad_bytes(files)
    info = {'Name': 'Flow Striker (Yunara)', 'Author': 'Flow Striker Project', 'Version': VERSION,
            'Description': 'Original anime football striker model (v2: fingers, cleats, baked anime lighting, ink outline), football beads + projectiles, dark green Flow effects, METAVISION ult. Replaces the base skin.',
            'Heading': '', 'Home': ''}
    out = os.path.join(BUILD, f'FlowStriker_Yunara_v{VERSION}.fantome')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('META/info.json', json.dumps(info, indent=2))
        buf = io.BytesIO(); preview_card().convert('RGB').save(buf, 'PNG')
        z.writestr('META/image.png', buf.getvalue())
        z.writestr('WAD/Yunara.wad.client', wad)
    print(f'{len(files)} files, wad {len(wad) / 1e6:.1f} MB ->', out)
    return out


if __name__ == '__main__':
    main(sys.argv[1])
