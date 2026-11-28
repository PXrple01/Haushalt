"""Builds the 'Flow Striker' mod for Yunara (base skin) as a CSLoL Manager .fantome.

Usage:  python3 build_mod.py <dir with downloaded game files>
The game-file dir must mirror CommunityDragon's layout (see fetch_game_files.sh).
"""
import io
import math
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
import bcn
from lolassets import flow_image, flow_rgba

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEN = os.path.join(ROOT, 'assets_src', 'gen')
BUILD = os.path.join(ROOT, 'build')
VERSION = '0.16.0'

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
AWAKE_TEX = 'assets/characters/yunara/skins/base/mvfx_striker_awake_tx_cm.tex'
AWAKE_OFFSET = 0.06                     # the awakened overlay sits this far out along the normal
EGO_TEX = {'egoseams': 'assets/characters/yunara/skins/base/mvfx_striker_egoseams_tx_cm.tex',   # Ego stages (general_fx)
           'egohair': 'assets/characters/yunara/skins/base/mvfx_striker_egohair_tx_cm.tex'}
# which model sits in the slot (see tools/char/import_model.py); default: the original striker
_slot_cfg = os.path.join(CHAR, 'model.json')
MODEL_SLOT = json.load(open(_slot_cfg))['model'] if os.path.exists(_slot_cfg) else 'striker2'


# ------------------------------------------------------------------ io helpers
def tex_bytes(im, mipmaps=True):
    """DXT1 (opaque) / DXT5 (alpha) like every texture Riot ships for Yunara (see bcn.py)."""
    return bcn.tex_bytes(im, mipmaps)


def gen(name):
    return Image.open(os.path.join(GEN, name + '.png')).convert('RGBA')


def put_tex(path, im, mipmaps=True):
    files[path.lower()] = tex_bytes(im, mipmaps)


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
    stats = RC.recolor_bin(b, skip_system=RC.is_q_system)        # Q systems: white-violet, see step_q_flow
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
        em.set('isUniformScale', L.FLAG, 1)          # a football must stay round (the old orbs were stretched)
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


CUSTOM_SKL = 'ASSETS/Characters/Yunara/Skins/Base/MVFX_Striker.skl'
CUSTOM_ANM_DIR = 'assets/characters/yunara/skins/base/animations/mvfx_striker/'
ANIM_BIN = 'data/characters/yunara/animations/skin0.bin'


FACE_CLIPS = {            # animation clip (graph name) -> expression shown for the whole clip
    'focus': ['attack1', 'attack2', 'spell1_attack1', 'spell1_attack2', 'spell3_base', 'spell4_e', 'channel', 'channel_wndup'],
    'shout': ['crit1', 'crit2', 'spell1_crit1', 'spell1_crit2', 'spell2', 'spell4_w'],
    'grin': ['taunt', 'joke_loop', 'respawn', 'run_homeguard_in', 'recall_winddown'],
    'laugh': ['laugh', 'dance_loop'],
    'pain': ['death', 'knockup'],
}
BLINKS = {                # clip -> frames where he blinks (eyes closed for BLINK_LEN frames; Riot's frame-ranged events)
    'idle1': [38, 121], 'idle2': [55, 150], 'idlein': [70], 'run_base': [44], 'run_homeguard_base': [30],
}
BLINK_LEN = 4


def step_expressions(b, game):
    """Expressions: every listed clip shows its face layer while it plays (Riot's own SubmeshVisibility events,
    as Yunara uses for her beads - the layer is hidden again when the clip ends). Glowing eyes follow the buffs:
    Q flow -> white-violet, R Metavision -> green (persistent conditions, like Yunara's Q/R bead effects)."""
    faces = STATE.get('faces') or []
    if not faces:
        return 'no expression layers'
    raw = files.get(ANIM_BIN) or open(os.path.join(game, ANIM_BIN), 'rb').read()
    g = L.read(raw)
    cm = g.entries[0].struct.field('mClipDataMap').value
    by_hash = {k: clip for k, clip in cm.items}
    added = 0
    for face, clips in FACE_CLIPS.items():
        layer = 'Face_' + face.capitalize()
        if layer not in faces:
            continue
        for name in clips:
            clip = by_hash.get(L.fnv1a(name))
            if clip is None:
                print('   ! clip not in graph:', name); continue
            ev = L.Struct('SubmeshVisibilityEventData',
                          [L.Field('mShowSubmeshList', L.LIST, L.List(L.HASH, [L.fnv1a(layer)]))], L.STRUCT)
            f = clip.field('mEventDataMap')
            if f is None:
                clip.fields.append(L.Field('mEventDataMap', L.MAP, L.Map(L.HASH, L.STRUCT, [])))
                f = clip.field('mEventDataMap')
            f.value.items.append((L.fnv1a('MV_Face_' + face), ev))
            added += 1
    if 'Face_Blink' in faces:
        for name, frames in BLINKS.items():
            clip = by_hash.get(L.fnv1a(name))
            if clip is None:
                print('   ! clip not in graph:', name); continue
            f = clip.field('mEventDataMap')
            if f is None:
                clip.fields.append(L.Field('mEventDataMap', L.MAP, L.Map(L.HASH, L.STRUCT, [])))
                f = clip.field('mEventDataMap')
            for k, fr in enumerate(frames):
                ev = L.Struct('SubmeshVisibilityEventData', [
                    L.Field('mStartFrame', L.F32, float(fr)), L.Field('mEndFrame', L.F32, float(fr + BLINK_LEN)),
                    L.Field('mShowSubmeshList', L.LIST, L.List(L.HASH, [L.fnv1a('Face_Blink')]))], L.STRUCT)
                f.value.items.append((L.fnv1a(f'MV_Blink_{k}'), ev))
                added += 1
    data = L.write(g); L.read(data)
    files[ANIM_BIN] = data
    import copy
    skin = b.entry(SKIN).struct
    conds = skin.field('PersistentEffectConditions').value
    q_spell = L.fnv1a('Characters/Yunara/Spells/YunaraQAbility/YunaraQ')
    def has_spell(st, h):
        for f_ in st.fields:
            if f_.hash == L.fnv1a('Spell') and f_.value == h:
                return True
            v = f_.value
            subs_ = [v] if isinstance(v, L.Struct) else (v.items if isinstance(v, L.List) else [])
            if any(isinstance(x, L.Struct) and has_spell(x, h) for x in subs_):
                return True
        return False
    q_cond = next((c for c in conds.items if c.field('OwnerCondition') and
                   c.get('OwnerCondition').type_hash == L.fnv1a('AllTrueMaterialDriver') and has_spell(c, q_spell)
                   and not any(f_.hash == L.fnv1a('SubmeshVisibilityBoolDriver') for d_ in c.get('OwnerCondition').get('mDrivers').items for f_ in [L.Field(d_.type_hash, 0, 0)])), None)
    shown = []
    for face, spell in (('Flow', 'Characters/Yunara/Spells/YunaraQAbility/YunaraQ'), ('Meta', R_SPELL)):
        layer = 'Face_' + face
        if layer not in faces or q_cond is None:
            continue
        c = copy.deepcopy(q_cond)
        def retarget(st):
            for f_ in st.fields:
                if f_.hash == L.fnv1a('Spell'):
                    f_.value = L.fnv1a(spell)
                v = f_.value
                for x in ([v] if isinstance(v, L.Struct) else (v.items if isinstance(v, L.List) else [])):
                    if isinstance(x, L.Struct):
                        retarget(x)
        retarget(c)
        c.fields = [f_ for f_ in c.fields if f_.hash != L.fnv1a('PersistentVfxs')]
        show = [layer] + (['Awake'] if face == 'Meta' and STATE.get('awake') else [])
        c.fields.append(L.Field('SubmeshesToShow', L.LIST2, L.List(L.HASH, [L.fnv1a(x) for x in show], L.LIST2)))
        conds.items.append(c); shown.append(layer)
    return f'{added} clip events, buff layers {shown}'


def step_custom_skeleton(b, game):
    """Model slots with their own proportions (tools/char/custom_skeleton.py): a byte-patched copy of Yunara's
    skeleton at a new path, and every animation clip retargeted to it. The base skin's animation graph is
    pointed at the new clips, so other Yunara skins keep the original files."""
    lm = os.path.join(CHAR, f'{MODEL_SLOT}_landmarks.json')
    if not os.path.exists(lm):
        return "Yunara's skeleton"
    skl = os.path.join(game, 'assets/characters/yunara/skins/base/yunara_base.skl')
    anm_dir = os.path.join(game, 'anm')
    if not (os.path.exists(skl) and os.path.isdir(anm_dir) and os.path.exists(os.path.join(game, ANIM_BIN))):
        raise SystemExit(f'model slot {MODEL_SLOT} has its own skeleton: run tools/fetch_wad.py + tools/extract_wad.py '
                         f'into {game} first (see README)')
    sys.path.insert(0, os.path.join(HERE, 'char'))
    import custom_skeleton as CS
    import tempfile
    tmp = tempfile.mkdtemp()
    CS.build_skeleton(skl, os.path.join(CHAR, 'yunara_joints.json'), lm, tmp, MODEL_SLOT)
    files[CUSTOM_SKL.lower()] = open(os.path.join(tmp, f'{MODEL_SLOT}.skl'), 'rb').read()
    STATE['joints'] = json.load(open(os.path.join(tmp, f'{MODEL_SLOT}_joints.json')))
    os.makedirs(BUILD, exist_ok=True)
    json.dump(STATE['joints'], open(os.path.join(BUILD, f'{MODEL_SLOT}_joints.json'), 'w'))   # for make_promo.sh
    params = json.load(open(os.path.join(tmp, f'{MODEL_SLOT}_retarget.json')))
    b.entry(SKIN).struct.get('skinMeshProperties').field('skeleton').value = CUSTOM_SKL
    graph = bytearray(open(os.path.join(game, ANIM_BIN), 'rb').read())
    moved = kept = 0
    for f in sorted(os.listdir(anm_dir)):
        raw = open(os.path.join(anm_dir, f), 'rb').read()
        out = CS.retarget_compressed(raw, params)[0] if raw[:8] == b'r3d2canm' else CS.retarget_uncompressed(raw, params)[0]
        old = struct.pack('<Q', int(f[:-4], 16))
        if graph.count(old) >= 1:
            new_path = CUSTOM_ANM_DIR + f
            graph = graph.replace(old, struct.pack('<Q', xxhash.xxh64(new_path.encode()).intdigest()))
            files[new_path] = out; moved += 1
        else:                     # not in the base graph: override in place so this skin never plays a stretched clip
            files[int(f[:-4], 16)] = out; kept += 1
    L.read(bytes(graph))                                      # sanity: must parse again
    files[ANIM_BIN] = bytes(graph)
    return f'custom skeleton, {moved} clips re-linked, {kept} overridden in place'


def step_character(b):
    """Replaces Yunara's body with the original anime striker (Body = body/head/hands/boots, Pants = hair),
    plus an inverted-hull ink outline (League culls back faces, as its double-sided cloth shows)."""
    s = STATE['skn']
    slot = MODEL_SLOT
    d = np.load(os.path.join(CHAR, f'{slot}_rigged.npz'))
    ink = json.load(open(os.path.join(CHAR, f'{slot}_ink.json')))
    joints = STATE.get('joints') or json.load(open(os.path.join(CHAR, 'yunara_joints.json')))
    tris, part = d['tris'], d['part']
    fpath = os.path.join(CHAR, f'{slot}_faces.npz')
    FACES = np.load(fpath) if os.path.exists(fpath) else None
    us = np.array([0.5, 1.0], np.float32) if FACES is not None else np.array([1.0, 1.0], np.float32)  # body: left half
    vpart = np.full(len(d['pos']), -1)
    for k in range(7):
        vpart[np.unique(tris[part == k])] = k
    th = outline_thickness(d['pos'].astype(np.float64), vpart, joints)
    new_v, new_i, subs = [], [], []
    vcount = icount = 0
    for name, sel in (('Body', np.isin(part, (0, 1, 4, 5, 6))), ('Pants', np.isin(part, (2, 3)))):
        t = tris[sel]
        if len(t) == 0:
            continue
        used = np.unique(t)
        remap = np.full(len(d['pos']), -1, np.int64); remap[used] = np.arange(len(used))
        nv = np.zeros(len(used), s.verts.dtype)
        nv['pos'] = d['pos'][used]; nv['nrm'] = d['nrm'][used]; nv['uv'] = d['uv'][used] * us
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
        sv['uv'] = np.where(skin_like[:, None], np.array(ink['ink_skin'], np.float32) * us, np.array(ink['ink_dark'], np.float32) * us)
        if 'col' in sv.dtype.names:
            sv['col'] = 255
        if 'tan' in sv.dtype.names:
            sv['tan'] = (1.0, 0.0, 0.0, 1.0)
        sidx = sremap[shell_tris[:, ::-1]].reshape(-1)
        allv = np.concatenate([nv, sv]); alli = np.concatenate([idx, sidx])
        subs.append(dict(name=name, vstart=vcount, vcount=len(allv), istart=icount, icount=len(alli)))
        new_v.append(allv); new_i.append(alli + vcount); vcount += len(allv); icount += len(alli)
    faces = []
    if FACES is not None:                     # expression overlays (face_expressions.py), hidden until shown
        src = FACES['src']
        for fname in [str(x) for x in FACES['names']]:
            fv = np.zeros(len(src), s.verts.dtype)
            fv['pos'] = FACES['pos_' + fname]; fv['nrm'] = d['nrm'][src]
            uvf = FACES['uv_' + fname]; fv['uv'] = np.stack([0.5 + uvf[:, 0] * 0.5, uvf[:, 1]], 1)
            fv['infl'] = d['infl'][src]; fv['w'] = d['w'][src]
            if 'col' in fv.dtype.names:
                fv['col'] = 255
            if 'tan' in fv.dtype.names:
                fv['tan'] = (1.0, 0.0, 0.0, 1.0)
            fi = FACES['tris'].reshape(-1).astype(np.int64)
            name = 'Face_' + fname.capitalize()
            subs.append(dict(name=name, vstart=vcount, vcount=len(fv), istart=icount, icount=len(fi)))
            new_v.append(fv); new_i.append(fi + vcount); vcount += len(fv); icount += len(fi); faces.append(name)
    STATE['faces'] = faces
    awp = os.path.join(CHAR, f'{slot}_awake.npz')
    if os.path.exists(awp):                   # awakened ult form (char/awakened.py): own texture via materialOverride
        sel = d['tris'][np.load(awp)['tris']]
        uv_ = np.unique(sel.reshape(-1)); rm = {int(v): k for k, v in enumerate(uv_)}
        av = np.zeros(len(uv_), s.verts.dtype)
        av['pos'] = d['pos'][uv_] + d['nrm'][uv_] * AWAKE_OFFSET; av['nrm'] = d['nrm'][uv_]
        av['uv'] = d['uv'][uv_]; av['infl'] = d['infl'][uv_]; av['w'] = d['w'][uv_]
        if 'col' in av.dtype.names:
            av['col'] = 255
        if 'tan' in av.dtype.names:
            av['tan'] = (1.0, 0.0, 0.0, 1.0)
        ai = np.vectorize(rm.get)(sel).reshape(-1).astype(np.int64)
        subs.append(dict(name='Awake', vstart=vcount, vcount=len(av), istart=icount, icount=len(ai)))
        new_v.append(av); new_i.append(ai + vcount); vcount += len(av); icount += len(ai)
        put_tex(AWAKE_TEX, Image.open(os.path.join(CHAR, f'{slot}_awake.png')))
        STATE['awake'] = True
    for name, path in EGO_TEX.items():        # glow layers of the Ego stages, laid out like the body atlas
        src = os.path.join(CHAR, f'{slot}_{name}.png')
        if os.path.exists(src):
            im = Image.open(src).convert('RGBA')
            im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)     # soft glow: half resolution is plenty
            if FACES is not None:
                both = Image.new('RGBA', (im.width * 2, im.height), (0, 0, 0, 0)); both.paste(im, (0, 0)); im = both
            put_tex(path, im)
            STATE.setdefault('ego', {})[name] = path
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
    albedo = Image.open(os.path.join(CHAR, f'{slot}_albedo.png')).convert('RGB')
    if FACES is not None:                     # one texture: body atlas left, expression tiles right
        both = Image.new('RGB', (albedo.width * 2, albedo.height))
        both.paste(albedo, (0, 0)); both.paste(Image.open(os.path.join(CHAR, f'{slot}_faces.png')).convert('RGB').resize(albedo.size), (albedo.width, 0))
        albedo = both
    put_tex(STRIKER_TEX, albedo)
    # loading screen + HUD portraits (same paths and layout as the originals: DXT, no mip chain)
    put_tex('assets/characters/yunara/skins/base/yunaraloadscreen_0.tex', Image.open(os.path.join(CHAR, 'loadscreen.png')), False)
    put_tex('assets/characters/yunara/hud/yunara_square_0.tex', Image.open(os.path.join(CHAR, 'icon_square.png')), False)
    put_tex('assets/characters/yunara/hud/yunara_circle_0.tex', Image.open(os.path.join(CHAR, 'icon_circle.png')), False)
    smp = b.entry(SKIN).struct.get('skinMeshProperties')
    smp.set('texture', L.PATH, xxhash.xxh64(STRIKER_TEX.encode()).intdigest())
    hidden = faces + (['Awake'] if STATE.get('awake') else [])
    if hidden:
        for key in ('initialSubmeshToHide', 'initialSubmeshShadowsToHide', 'initialSubmeshMouseOversToHide'):
            smp.set(key, L.STRING, ((smp.get(key) or '') + ' ' + ' '.join(hidden)).strip())
        order = (smp.get('submeshRenderOrder') or '').split()
        if 'Body' in order:
            order = order[:order.index('Body') + 1] + (['Awake'] if STATE.get('awake') else []) + faces + order[order.index('Body') + 1:]
            smp.set('submeshRenderOrder', L.STRING, ' '.join(order))
    if STATE.get('awake'):                    # same field types as Riot's (Ahri: list of embeds, texture = path hash)
        ov = L.Struct('SkinMeshDataProperties_MaterialOverride', [
            L.Field('texture', L.PATH, xxhash.xxh64(AWAKE_TEX.encode()).intdigest()),
            L.Field('submesh', L.STRING, 'Awake')], L.EMBED)
        f = smp.field('materialOverride')
        if f is None:
            smp.fields.append(L.Field('materialOverride', L.LIST, L.List(L.EMBED, [ov])))
        else:
            f.value.items.append(ov)
    return f"{vcount} verts total, {len(tris)} model tris + ink shell, {len(faces)} expression layers"


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
    RC.recolor_value(st, L.EMBED, {'const': 0, 'anim': 0, 'fresnel': 0})     # the Q template is not green
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
    """R activation: chains wrap around his body and burst (then the Ego beast rises, see step_ult_beast)."""
    for n in ('chain_metal', 'reticle', 'flash_star', 'shock_ring', 'light_dot'):
        put_tex(MV + 'mvfx_' + n + '.tex', gen(n))
    import meshy_props as MP
    chain_tex = 'chain_metal'
    if MP.available('chainlink_lo'):          # Meshy's spiked iron link with runes (v0.16)
        rp, ru, rt = MP.chain_ring(radius=64.0, count=16)
        lp, lu, lt = MP.chain_link()
        put_tex(MV + 'mvfx_chain_meshy.tex', MP.texture('chainlink_lo', 'iron'))
        chain_tex = 'chain_meshy'
    else:
        rp, ru, rt = make_assets.chain_ring(radius=64.0, count=20)
        lp, lu, lt = make_assets.chain_link()
    files[MV + 'mvfx_chain_ring.scb'] = scb_bytes(rp, ru, rt, 'mvfx_chain_ring')
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
        ems.append(V.emitter(f'MV_Chain{k}', T(chain_tex), blend=1, life=BREAK + 0.02, pos=pos, rotation=rot,
                             scale=(1.0, 1.0, 1.0), scale_curve=tighten, spin=(0, 25 * (1 if k % 2 else -1), 0),
                             mesh=MV + 'mvfx_chain_ring.scb', color_curve=fade((1.0, 1.0, 1.0), 0.12, 0.95),
                             pass_=9000 + k, backface=True))
        ems.append(V.emitter(f'MV_ChainGlow{k}', T(chain_tex), blend=4, life=BREAK + 0.02, pos=pos, rotation=rot,
                             scale=(1.03, 1.03, 1.03), scale_curve=tighten, spin=(0, 25 * (1 if k % 2 else -1), 0),
                             mesh=MV + 'mvfx_chain_ring.scb', pass_=9010 + k, backface=True,
                             color_curve=([0.0, 0.5, 0.88, 1.0], [FLOW + (0.0,), FLOW + (0.35,), HI + (1.0,), (1, 1, 1, 0.0)])))
    # ---- the burst
    ems.append(V.emitter('MV_ChainShards', T(chain_tex), blend=1, single=False, rate=650, emitter_life=0.05,
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
    cast = b.entry(PART + 'Yunara_Base_R_Cast').struct
    # Yunara's own ground cast symbols are replaced by the shockwave
    f = cast.field('complexEmitterDefinitionData')
    drop = {'Blend_FLoor1', 'decalDark_backer4', 'decalDark_backer5', 'decalDark_backer6'}
    f.value.items = [e for e in f.value.items if e.get('emitterName') not in drop]
    V.add_emitters(cast, ems)
    return len(ems)


def step_q_flow(b, game):
    """Q = flow state: every Q system in white -> lavender -> violet (brightness-driven, so cores are white and
    fading edges violet), white-violet copies of the shared coloured textures, a white-violet football, and the
    flow elements: an inward light implosion + burst on cast, rising light wisps, violet afterimages and light
    trails behind the hands and the orbiting footballs while Q is active."""
    import copy
    from lolassets import q_rgba, q_image
    stats = {'const': 0, 'anim': 0, 'fresnel': 0}
    pre = os.path.join(game, 'png', 'assets_characters_yunara_skins_base_particles_')
    shared = {(P + n + '.tex').lower(): n for n in RC.COLORED_TEXTURES if not n.endswith('_orb01')}
    swapped = set()
    qsys = [e.struct for e in b.entries if e.struct is not None and e.struct.type_hash == L.fnv1a('VfxSystemDefinitionData')
            and RC.is_q_system(e.struct)]
    for st in qsys:
        RC.recolor_value(st, L.EMBED, stats, fn=q_rgba)
        for em in V.emitters_of(st):
            for key in ('texture',):
                tx = em.get(key)
                if isinstance(tx, str) and tx.lower() in shared:
                    n = shared[tx.lower()]
                    put_tex(MV + 'mvfx_q_' + n + '.tex', q_image(Image.open(pre + n + '.png')))
                    em.set(key, L.STRING, MV + 'mvfx_q_' + n + '.tex'); swapped.add(n)
    put_tex(P + 'yunara_base_q_orb01.tex', gen('ball_sprite_q'))
    T = lambda n: MV + 'mvfx_' + n + '.tex'
    WH = (1.0, 1.0, 1.0); LAV = (0.80, 0.68, 1.0); VIO = (0.55, 0.30, 1.0); DVI = (0.30, 0.10, 0.70)
    flow = lambda a=1.0: ([0.0, 0.18, 0.5, 1.0], [WH + (a,), LAV + (a * 0.9,), VIO + (a * 0.6,), DVI + (0.0,)])
    ems_cast = [
        # light implodes into the striker ...
        V.emitter('MVQ_Implode', T('shock_ring'), blend=4, life=0.22, pos=(0, 110, 0), scale=(70, 70, 1),
                  scale_curve=([0, 1], [(5.0,) * 3, (0.35,) * 3]),
                  color_curve=([0, 0.3, 1], [VIO + (0.0,), LAV + (0.9,), WH + (1.0,)]), pass_=720),
    ] + [
        # 10 light streaks rush into the chest from all around (fixed velocities, no attraction fields)
        V.emitter(f'MVQ_InStreak{k}', T('light_streak'), blend=4, delay=0.01 * (k % 3), life=0.19, bind=1.0,
                  pos=(150 * math.cos(math.radians(36 * k)), 60 + 28 * (k % 4), 150 * math.sin(math.radians(36 * k))),
                  velocity=(-150 * math.cos(math.radians(36 * k)) / 0.19, (110 - (60 + 28 * (k % 4))) / 0.19,
                            -150 * math.sin(math.radians(36 * k)) / 0.19),
                  scale=(7, 7, 7), direction_oriented=True, dir_scale=0.0012, pass_=721,
                  color_curve=([0, 0.4, 1], [VIO + (0.0,), LAV + (0.95,), WH + (1.0,)]))
        for k in range(10)] + [
        # ... then bursts out as the flow switches on
        V.emitter('MVQ_Burst', T('flash_star'), blend=4, delay=0.2, life=0.3, pos=(0, 115, 0), scale=(95, 95, 1),
                  scale_curve=([0, 0.25, 1], [(0.3,) * 3, (1.35,) * 3, (1.6,) * 3]), color_curve=flow(1.0), pass_=722),
        V.emitter('MVQ_BurstRays', T('god_rays'), blend=4, delay=0.2, life=0.45, pos=(0, 115, 0), scale=(150, 150, 1),
                  spin=(90, 0, 0), scale_curve=([0, 0.2, 1], [(0.5,) * 3, (1.0,) * 3, (1.25,) * 3]), color_curve=flow(0.75), pass_=723),
        V.emitter('MVQ_BurstLines', T('light_dot'), blend=4, single=False, rate=1200, emitter_life=0.04, delay=0.2, life=0.4,
                  bind=0.0, pos=(0, 110, 0), scale=(5, 5, 5), drag=(3, 3, 3),
                  velocity=V.vvec3((1100, 800, 1100), rand=[(-1, 1), (-0.5, 1), (-1, 1)]),
                  direction_oriented=True, dir_scale=0.006, color_curve=flow(1.0), pass_=724)]
    a = copy.deepcopy(V.find_emitter(b.entry(PART + 'Yunara_Base_Q_Buff_OnBeads').struct, 'ADD_EdgeGlow'))
    a.set('emitterName', L.STRING, 'MVQ_AfterImage')
    mm = a.get('primitive').get('mMesh')
    mm.set('mSubmeshesToDraw', L.LIST, V.submesh_list(['Body', 'Pants'])); mm.set('mLockMeshToAttachment', L.BOOL, False)
    a.remove('texDiv'); a.remove('isSingleParticle')
    a.set('rate', L.EMBED, V.vfloat(7.0)); a.set('lifetime', L.OPTION, L.Option(L.F32, 8.0))
    a.set('particleLifetime', L.EMBED, V.vfloat(0.32)); a.set('bindWeight', L.EMBED, V.vfloat(0.0))
    # outline ghosts: no fill (black base in additive), only the fresnel rim -> a light trail when moving,
    # no lavender wash over the body when standing still
    a.set('blendMode', L.U8, 4)
    a.set('birthScale0', L.EMBED, V.vvec3((1.0, 1.0, 1.0))); a.set('birthColor', L.EMBED, V.vcolor((0.0, 0.0, 0.0, 0.6)))
    a.set('Color', L.EMBED, V.vcolor((1, 1, 1, 1), [0, 0.4, 1], [(1, 1, 1, 1.0), (1, 1, 1, 0.6), (1, 1, 1, 0.0)]))
    ar = a.field('reflectionDefinition')
    arefl = L.Struct('VfxReflectionDefinitionData', [V.F('fresnelColor', L.VEC4, (0.66, 0.46, 1.0, 0.0))], L.STRUCT)
    if ar is None:
        a.fields.append(V.F('reflectionDefinition', L.STRUCT, arefl))
    else:
        ar.value = arefl
    rim = copy.deepcopy(V.find_emitter(b.entry(PART + 'Yunara_Base_Q_Buff_OnBeads').struct, 'ADD_EdgeGlow'))
    rim.set('emitterName', L.STRING, 'MVQ_FlowRim')
    mm = rim.get('primitive').get('mMesh')
    mm.set('mSubmeshesToDraw', L.LIST, V.submesh_list(['Body', 'Pants'])); mm.set('mLockMeshToAttachment', L.BOOL, True)
    rim.remove('texDiv')
    rim.set('particleLifetime', L.EMBED, V.vfloat(8.0)); rim.set('lifetime', L.OPTION, L.Option(L.F32, 0.1))
    rim.set('blendMode', L.U8, 4); rim.set('birthScale0', L.EMBED, V.vvec3((1.0, 1.0, 1.0)))
    rim.set('birthColor', L.EMBED, V.vcolor((0.0, 0.0, 0.0, 0.25)))
    rim.set('Color', L.EMBED, V.vcolor((1, 1, 1, 1), [0, 0.03, 0.95, 1], [(1, 1, 1, 0), (1, 1, 1, 1), (1, 1, 1, 1), (1, 1, 1, 0)]))
    rf = rim.field('reflectionDefinition')
    refl = L.Struct('VfxReflectionDefinitionData', [V.F('fresnelColor', L.VEC4, (0.92, 0.82, 1.0, 0.0))], L.STRUCT)
    if rf is None:
        rim.fields.append(V.F('reflectionDefinition', L.STRUCT, refl))
    else:
        rf.value = refl
    ems_buff = [
        a, rim,
        V.emitter('MVQ_Wisps', T('light_streak'), blend=4, single=False, rate=30, emitter_life=8.0, life=0.8, bind=0.0,
                  pos=(0, 70, 0), extra=[V.F('SpawnShape', L.STRUCT, L.Struct('VfxShapeBox', [V.F('Size', L.VEC3, (70.0, 110.0, 70.0))], L.STRUCT))],
                  scale=V.vvec3((11, 11, 11), rand=[(0.6, 1.4), None, None]),
                  velocity=V.vvec3((45, 260, 45), rand=[(-1, 1), (0.7, 1.3), (-1, 1)]), drag=(0.9, 0.35, 0.9),
                  direction_oriented=True, dir_scale=0.007, color_curve=flow(1.0), pass_=725, importance=2),
        V.emitter('MVQ_AuraGlow', T('light_dot'), blend=4, life=8.0, pos=(0, 105, -8), scale=(120, 150, 1), uniform=False,
                  color_curve=([0, 0.03, 0.2, 0.4, 0.6, 0.8, 0.97, 1],
                               [VIO + (0.0,), VIO + (0.55,), LAV + (0.4,), VIO + (0.55,), LAV + (0.4,), VIO + (0.55,), VIO + (0.45,), VIO + (0.0,)]),
                  pass_=690),
        V.emitter('MVQ_Sparkle', T('flash_star'), blend=4, single=False, rate=16, emitter_life=8.0, life=0.3, bind=0.0,
                  pos=(0, 100, 0), extra=[V.F('SpawnShape', L.STRUCT, L.Struct('VfxShapeBox', [V.F('Size', L.VEC3, (100.0, 180.0, 100.0))], L.STRUCT))],
                  scale=V.vvec3((13, 13, 1), rand=[(0.5, 1.5), None, None]), color_curve=flow(1.0), pass_=726, importance=2),
        V.emitter('MVQ_FeetGlow', T('light_dot'), blend=4, life=8.0, rotation=(-90, -90, 0), ground=True, scale=(70, 70, 1),
                  color_curve=([0, 0.04, 0.94, 1], [VIO + (0.0,), LAV + (0.55,), VIO + (0.45,), DVI + (0.0,)]), pass_=-2785)]
    trail = lambda name, rate, size: V.emitter(name, T('light_dot'), blend=4, single=False, rate=rate, emitter_life=8.0,
                                                life=0.26, bind=0.0, scale=(size, size, size),
                                                scale_curve=([0, 1], [(1,) * 3, (0.25,) * 3]), color_curve=flow(0.9),
                                                pass_=727, importance=2)
    adds = {'Yunara_Base_Q_Cast': ems_cast, 'Yunara_Base_Q_Buff_OnBase': ems_buff,
            'Yunara_Base_Q_Buff_OnHands': [trail('MVQ_HandTrail', 70, 6.0)],
            'Yunara_Base_Q_Buff_OnBeads': [trail('MVQ_BallTrail', 55, 7.5)]}
    n = 0
    for sysname, ems in adds.items():
        st = b.entry(PART + sysname)
        if st is not None:
            V.add_emitters(st.struct, ems); n += len(ems)
    return f'{len(qsys)} systems white-violet ({stats["const"] + stats["anim"]} colours), {len(swapped)} textures, {n} flow emitters'


KEEP_CAST = ('MV_Chain', 'MV_Burst', 'MV_ImpactLightR')        # of the R cast only the chains + their burst stay


def step_ult_beast(b):
    """The ult: the chains burst on the cast, then the Ego beast rises behind him and stays for the 15 s of the R buff
    (tools/ult_beast.py: animated mesh particle in a persistent system on his layout bone)."""
    import ult_beast as UB
    for n, im in UB.textures(ROOT).items():
        put_tex(MV + 'mvfx_' + n + '.tex', im)
    anim, total = UB.anim_files(ROOT)
    for path, data in anim.items():
        files[path.lower()] = data
    cast = b.entry(PART + 'Yunara_Base_R_Cast').struct
    f = cast.field('complexEmitterDefinitionData')
    f.value.items = [e for e in f.value.items
                     if not str(e.get('emitterName')).startswith('MV_') or str(e.get('emitterName')).startswith(KEEP_CAST)]
    st = UB.install(b, SKIN, RES, MV, R_SPELL)
    pack_used_gen([st])
    return f'Ego beast: {len(st.get("complexEmitterDefinitionData").items)} emitters, animated clip {total:.2f} s'


def _strings(v, out):
    if isinstance(v, L.Struct):
        for f in v.fields:
            if f.type == L.STRING and isinstance(f.value, str):
                out.add(f.value)
            else:
                _strings(f.value, out)
    elif isinstance(v, L.List):
        for x in v.items:
            _strings(x, out)
    elif isinstance(v, L.Option) and v.value is not None:
        _strings(v.value, out)
    return out


def pack_used_gen(structs):
    """Packs generated textures (assets_src/gen) that the given emitters/systems use and no step has packed yet;
    then every mvfx asset they reference must be in the package."""
    used = set()
    for st in structs:
        _strings(st, used)
    for v in used:
        if v.lower().startswith(MV) and v.endswith('.tex') and v.lower() not in files:
            n = v[len(MV) + len('mvfx_'):-4]
            if os.path.exists(os.path.join(GEN, n + '.png')):
                put_tex(v, gen(n))
    missing = sorted(v for v in used if v.lower().startswith(MV) and v.lower().endswith(('.tex', '.scb', '.skn', '.skl', '.anm'))
                     and v.lower() not in files)
    assert not missing, f'missing assets: {missing}'


def step_general(b, game):
    """Recall goal celebration, footstep marks, respawn kick-off, death whistle, Q afterimage prints + flow aura."""
    import general_fx as G
    for n, im in G.textures().items():
        put_tex(MV + 'mvfx_' + n + '.tex', im)
    for name, (p, u, t) in G.meshes().items():
        files[MV + name] = scb_bytes(p, u, t, name[:-4])
    raw = files.get(ANIM_BIN) or open(os.path.join(game, ANIM_BIN), 'rb').read()
    g = L.read(raw)
    n0 = len(b.entries)
    msg = G.install(b, g, SKIN, RES, MV, STATE.get('ego') or {})
    data = L.write(g); L.read(data)
    files[ANIM_BIN] = data
    pack_used_gen([e.struct for e in b.entries[n0:]])
    return msg


def step_multikill(b, game):
    """Quadra (delayed, cancelled by a penta) and penta moments: CAC multikill rules play invisible carrier clips on
    an effect track whose particle events spawn the effects (tools/multikill_fx.py)."""
    import multikill_fx as MK
    import extract_wad
    for n, im in MK.textures().items():
        put_tex(MV + 'mvfx_' + n + '.tex', im)
    for name, (p, u, t) in MK.meshes().items():
        files[MV + name] = scb_bytes(p, u, t, name[:-4])
    raw = files.get(ANIM_BIN) or open(os.path.join(game, ANIM_BIN), 'rb').read()
    g = L.read(raw)
    cac = L.read(os.path.join(game, extract_wad.CAC_BIN))
    added, msg = MK.install(b, g, cac, SKIN, RES, MV)
    data = L.write(g); L.read(data)
    files[ANIM_BIN] = data
    pack_used_gen(added)
    return msg


def step_screen_chains(b):
    """Chains in the corners of the player's own screen for the whole ult (camera-bound, owner only)."""
    import screen_chains as SC
    for n, im in SC.textures().items():
        put_tex(MV + 'mvfx_' + n + '.tex', im)
    n = SC.install(b, SKIN, RES, R_SPELL)
    return f'{n} emitters, camera-bound + owner-only on the R buff'


def _is_warning_red(c):
    return c is not None and c[0] >= 0.9 and c[1] <= 0.15 and c[2] <= 0.15


def step_enemy_warnings(b, game):
    """Clarity: Riot shows enemies their own version of some effects (the W missile and its lingering zone have
    *_Enemy_POV systems) with a pure red ground symbol / circle as a warning. The recolor turned those green; here the
    red warning colours come back exactly as Riot made them (only those emitters, the rest keeps the flow look)."""
    riot = L.read(os.path.join(game, 'data/characters/yunara/skins/skin0.bin'))
    fixed = []
    for e in riot.entries:
        s_ = e.struct
        if s_ is None or not s_.is_type('VfxSystemDefinitionData') or 'nemy' not in str(s_.get('particleName')):
            continue
        ours = b.entry(e.path_hash)
        if ours is None:
            continue
        for em in s_.get('complexEmitterDefinitionData').items:
            reds = []
            for key in ('birthColor', 'Color'):
                v = em.get(key)
                if isinstance(v, L.Struct):
                    vals = [v.get('constantValue')] + (list(v.get('dynamics').get('values').items) if v.get('dynamics') else [])
                    reds.append(any(_is_warning_red(c) for c in vals))
            if not any(reds):
                continue
            mine = V.find_emitter(ours.struct, em.get('emitterName'))
            if mine is None:
                continue
            import copy
            for key in ('birthColor', 'Color'):
                f = em.field(key)
                if f is not None:
                    mine.set(key, f.type, copy.deepcopy(f.value))
            fixed.append(f"{s_.get('particleName')}/{em.get('emitterName')}")
    return f'{len(fixed)} enemy warning emitters back to Riot red: ' + ', '.join(fixed)


def step_prune(b):
    """Drops files of our particle folder that no bin references any more (e.g. textures of removed effects)."""
    used = set()
    for e in b.entries:
        if e.struct is not None:
            _strings(e.struct, used)
    used = {u.lower() for u in used}
    drop = [p for p in list(files) if isinstance(p, str) and p.startswith(MV) and p not in used]
    for p in drop:
        del files[p]
    return f'{len(drop)} unused files removed'


# ------------------------------------------------------------------ packaging
def wad_bytes(entries):
    """WAD v3.3, uncompressed entries, sorted by path hash (keys: game path, or an int path hash)."""
    items = sorted(((p if isinstance(p, int) else xxhash.xxh64(p.lower().encode()).intdigest(), d) for p, d in entries.items()))
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
    put_tex(MV + 'mvfx_ball_rebound.tex', gen('ball_sprite'))
    put_tex(MV + 'mvfx_light_streak.tex', gen('light_streak'))
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
            V.emitter('MV_BallSparks', SPARK, blend=4, single=False, rate=60 + 20 * big, emitter_life=3.0, life=0.34,
                      bind=0.0, scale=V.vvec3((6.0 + big, 6.0 + big, 6.0 + big), rand=[(0.6, 1.2), None, None]),
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
            V.emitter('MV_HitSparks', SPARK, blend=4, single=False, rate=700 + 300 * lvl, emitter_life=0.02, life=0.35, bind=0.0,
                      scale=V.vvec3((4.8, 4.8, 4.8), rand=[(0.6, 1.3), None, None]),
                      velocity=V.vvec3((430 * k, 380 * k, 430 * k), rand=[(-1, 1), (0.2, 1.0), (-1, 1)]),
                      accel=(0, -1300, 0), drag=(1.5, 1.5, 1.5), direction_oriented=True, dir_scale=0.0035,
                      color_curve=([0, 0.5, 1], [HI + (1.0,), FLOW + (0.9,), DEEP + (0.0,)]), pass_=652, importance=2)]
        # the ball rebounds off the target: unmistakably football
        ems.append(V.emitter('MV_HitBall', MV + ('mvfx_ball_ult.tex' if lvl == 2 else 'mvfx_ball_rebound.tex'), blend=1,
                             life=0.38, bind=0.0, scale=(8.5 * k, 8.5 * k, 1),
                             scale_curve=([0, 0.2, 1], [(1.15,) * 3, (1.0,) * 3, (0.8,) * 3]),
                             velocity=V.vvec3((160, 330, 160), rand=[(-1, 1), (0.8, 1.2), (-1, 1)]), accel=(0, -1600, 0),
                             rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=(-1100, 0, 0),
                             color_curve=([0, 0.7, 1], [W1 + (1.0,), W1 + (1.0,), W1 + (0.0,)]), pass_=654))
        if lvl == 2:
            ems += [
                V.emitter('MV_ImpactLight', T('manga_burst_light'), blend=4, life=0.12, scale=(80, 80, 1),
                          scale_curve=([0, 1], [(0.9,) * 3, (1.15,) * 3]),
                          color_curve=([0, 0.35, 1], [HI + (0.8,), FLOW + (0.6,), DEEP + (0.0,)]), pass_=9501),
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
    RC.recolor_value(ghost, L.STRUCT, {'const': 0, 'anim': 0, 'fresnel': 0})  # Q template keeps its own colours
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
        RC.recolor_value(g2, L.STRUCT, {'const': 0, 'anim': 0, 'fresnel': 0})
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
    # ---- R cast: anime impact frame at the chain break
    BREAK = 0.30
    add('Yunara_Base_R_Cast', [
        V.emitter('MV_ImpactFrameR', T('manga_burst'), blend=1, delay=BREAK - 0.01, life=0.12, pos=(0, 110, 0), scale=(240, 240, 1),
                  color_curve=([0, 0.55, 1], [W1 + (0.95,), W1 + (0.85,), W1 + (0.0,)]), pass_=9600),
        V.emitter('MV_ImpactLightR', T('manga_burst_light'), blend=4, delay=BREAK - 0.01, life=0.16, pos=(0, 110, 0),
                  scale=(250, 250, 1), scale_curve=([0, 1], [(0.9,) * 3, (1.15,) * 3]),
                  color_curve=([0, 0.3, 1], [HI + (0.9,), FLOW + (0.7,), DEEP + (0.0,)]), pass_=9601)])
    # ---- R buff (15 s Metavision): tactical ground ring, centre circle, small eye above the head, rising motes
    add('Yunara_Base_R_Buff_OnBase', [
        V.emitter('MV_RGround', T('reticle'), blend=4, life=15.0, rotation=(-90, -90, 0), ground=True, scale=(105, 105, 1),
                  color_curve=([0, 0.02, 0.97, 1], [FLOW + (0.0,), HI + (0.5,), FLOW + (0.42,), FLOW + (0.0,)]), pass_=-2770),
        V.emitter('MV_RCircle', T('center_circle'), blend=4, life=15.0, rotation=(-90, -90, 0), ground=True, scale=(72, 72, 1),
                  color_curve=([0, 0.02, 0.97, 1], [FLOW + (0.0,), FLOW + (0.35,), FLOW + (0.3,), FLOW + (0.0,)]), pass_=-2769),
        V.emitter('MV_RMotes', SPARK, blend=4, single=False, rate=16, emitter_life=15.0, life=1.2, bind=0.0, pos=(0, 8, 0),
                  spawn_radius=32, scale=(4.5, 4.5, 4.5), scale_curve=([0, 1], [(1,) * 3, (0.25,) * 3]),
                  velocity=V.vvec3((0, 170, 0), rand=[None, (0.7, 1.3), None]),
                  color_curve=([0, 0.4, 1], [HI + (0.9,), FLOW + (0.75,), DEEP + (0.0,)]), pass_=703, importance=2),
        # METAVISION keeps reading the field: a scanner ring sweeps up the striker every ~1.4 s
        V.emitter('MV_RScanPulse', T('scan_ring'), blend=4, single=False, rate=0.7, emitter_life=14.6, delay=0.4, life=0.62,
                  pos=(0, 4, 0), rotation=(-90, -90, 0), scale=(46, 46, 1), velocity=(0, 360, 0),
                  scale_curve=([0, 0.5, 1], [(1.25,) * 3, (0.95,) * 3, (0.7,) * 3]),
                  extra=[V.F('primitive', L.STRUCT, L.Struct('VfxPrimitiveArbitraryQuad', [], L.STRUCT)),
                         V.F('disableBackfaceCull', L.BOOL, True)],
                  color_curve=([0, 0.12, 0.7, 1], [HI + (0.0,), HI + (0.75,), FLOW + (0.5,), FLOW + (0.0,)]), pass_=704)])
    return added


def preview_card():
    W, H = 640, 360
    bg = Image.new('RGBA', (W, H), (12, 12, 30, 255))
    eye = gen('eye').resize((560, 280), Image.LANCZOS)
    bg.alpha_composite(eye, (40, 20))
    ball = gen('ball_sprite_ult').resize((150, 150), Image.LANCZOS)
    bg.alpha_composite(ball, (W - 175, H - 165))
    return bg


VARIANTS = {   # diagnostic packages: isolate the model/skeleton part from the effects part
    'full': ('Flow Striker (Yunara)', f'FlowStriker_Yunara_v{VERSION}.fantome'),
    'model': ('Flow Striker TEST - nur Modell', f'FlowStriker_TEST_nur-Modell_v{VERSION}.fantome'),
    'vfx': ('Flow Striker TEST - nur Effekte', f'FlowStriker_TEST_nur-Effekte_v{VERSION}.fantome'),
}


def main(game, variant='full'):
    files.clear(); STATE.clear()
    os.makedirs(BUILD, exist_ok=True)
    b = L.read(os.path.join(game, 'data/characters/yunara/skins/skin0.bin'))
    fx = variant in ('full', 'vfx')
    model = variant in ('full', 'model')
    if fx:
        print('recolor            :', step_recolor(b, game))
        print('football missiles  :', step_ball_projectiles(b))
    print('football beads     :', step_bead_balls(b, game))
    if model:
        print('skeleton           :', step_custom_skeleton(b, game))
        print('striker model      :', step_character(b))
        print('expressions        :', step_expressions(b, game))
    else:
        put_tex(STRIKER_TEX, Image.open(os.path.join(CHAR, f'{MODEL_SLOT}_albedo.png')))   # used by effect afterimages
    step_write_skn()
    if fx:
        print('ult seam conditions:', step_ult_bead_seams(b))
        print('ult cast emitters  :', step_ult_cast(b))
        print('polish emitters    :', step_vfx_polish(b))
        print('Q flow (white-violet):', step_q_flow(b, game))
        print('ult (Ego beast)    :', step_ult_beast(b))
        print('screen chains      :', step_screen_chains(b))
        print('general moments    :', step_general(b, game))
        print('multikills         :', step_multikill(b, game))
    if fx:
        print('enemy warnings     :', step_enemy_warnings(b, game))
        print('prune              :', step_prune(b))
    data = L.write(b)
    L.read(data)                                              # sanity: must parse again
    files['data/characters/yunara/skins/skin0.bin'] = data
    wad = wad_bytes(files)
    name, fname = VARIANTS[variant]
    info = {'Name': name, 'Author': 'Flow Striker Project', 'Version': VERSION,
            'Description': 'Original anime football striker (own model + skeleton, retargeted animations, facial expressions + blinking), football beads + projectiles, white-violet Q flow with aura, METAVISION ult with chains on your own screen corners, recall goal celebration, footstep marks, respawn kick-off, death whistle. Replaces the base skin.',
            'Heading': '', 'Home': ''}
    out = os.path.join(BUILD, fname)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('META/info.json', json.dumps(info, indent=2))
        buf = io.BytesIO(); preview_card().convert('RGB').save(buf, 'PNG')
        z.writestr('META/image.png', buf.getvalue())
        z.writestr('WAD/Yunara.wad.client', wad)
    print(f'{len(files)} files, wad {len(wad) / 1e6:.1f} MB ->', out)
    return out


if __name__ == '__main__':
    # python3 build_mod.py <game dir> [full|model|vfx|all]
    v = sys.argv[2] if len(sys.argv) > 2 else 'full'
    for name in (VARIANTS if v == 'all' else [v]):
        main(sys.argv[1], name)
