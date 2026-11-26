"""The ult: METAVISION's chains burst and the Ego beast rises behind the striker and stays for the whole ult.

The beast is Meshy's rigged monster with 12 catalog actions, choreographed into one 15 s clip (tools/beast_anim.py)
and shipped as an animated mesh particle (skn + skl + anm in VfxMeshDefinitionData, like Riot's Aurora / Ambessa
effects). It lives in a persistent system on the R buff (YunaraR lasts 15 s), attached to his layout bone so it
follows him everywhere:
  - its offset behind him (+z, world) is in the animation's root joint and the mesh uses world orientation
    (isLocalOrientation 0), so it never turns when he turns;
  - every other emitter in the system has no sideways offset (only height), so nothing depends on his facing.
    Effects at the beast's head use a height that lines up with it on screen (League's camera looks down ~56 deg:
    being 160 units further back looks like ~240 units higher).
Timeline (seconds after R): rise + roar, crouch and watch, prowl out to his left and watch, prowl back, chest pound,
stomps, prowl to his right and crouch, back, claw swipe, arms-spread bellow, look, stomp, crouch, then it hurls itself
into him as the screen chains burst (14.6). A procedural layer (breathing, head looking around, sway) runs on top, its
veins pulse like a heartbeat and it keeps smoking, so it never stands frozen.
"""
import math
import os

import numpy as np
from PIL import Image

import lolbin as L
import vfxlib as V
import beast_anim as BA
from vfxshapes import holo, fade

F = L.Field
FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); WH = (1.0, 1.0, 1.0)
VIO = (0.55, 0.30, 0.95); LAV = (0.80, 0.70, 1.0); SHADOW = (0.05, 0.02, 0.08)
PART = 'Characters/Yunara/Skins/Skin0/Particles/'
SYSTEM = 'MV_R_EgoBeast'
BEAST_BASE = 'assets/characters/yunara/skins/base/particles/mvfx/mvfx_v2_beast'
WORLD = dict(local_orientation=False)
SCREEN_UP = math.tan(math.radians(56))          # height that matches being further back on screen
HEAD_Y = 400 + BA.BEHIND * SCREEN_UP           # the beast's head, as a height above him
CHEST_Y = 290 + BA.BEHIND * SCREEN_UP


# ------------------------------------------------------------------ textures
def _noise(s, sigma, seed):
    from scipy.ndimage import gaussian_filter
    n = gaussian_filter(np.random.default_rng(seed).random((s, s)), sigma, mode='wrap')
    return (n - n.min()) / (np.ptp(n) + 1e-9)


def shadow_pool(s=512):
    """Ground pool the beast climbs out of: dark violet ink with a green rim and tendrils (alpha blend)."""
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    wob = 0.72 + 0.06 * np.sin(a * 7 + 1.3) + 0.04 * np.sin(a * 13) + 0.05 * (_noise(s, 6, 8) - 0.5)
    tend = np.zeros_like(r)
    for k in range(9):
        aa = k * 2 * math.pi / 9 + 0.3 * math.sin(k * 3.1)
        da = np.abs((a - aa + math.pi) % (2 * math.pi) - math.pi)
        tend = np.maximum(tend, (da < 0.06 * (1.1 - r)) * (r < 0.97))
    body = np.clip((wob - r) / 0.04, 0, 1)
    alpha = np.clip(np.maximum(body * 0.9, tend * 0.8), 0, 1)
    rim = np.exp(-((r - wob) / 0.025) ** 2) * 0.9
    rgb = np.dstack([SHADOW[0] + rim * VIO[0], SHADOW[1] + rim * VIO[1], SHADOW[2] + rim * VIO[2]])
    alpha = np.maximum(alpha, rim * 0.8)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')


def smoke_puff(s=128):
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y)
    a = np.clip(1 - r, 0, 1) ** 1.5 * (0.6 + 0.4 * _noise(s, 5, 11))
    rgb = np.dstack([np.full_like(a, 0.12), np.full_like(a, 0.06), np.full_like(a, 0.18)])
    return Image.fromarray((np.dstack([rgb, a]) * 255).astype(np.uint8), 'RGBA')


def beast_colour(root, s=1024):
    """Epic green-violet skin from Meshy's base colour: obsidian to violet by brightness, Meshy's own green (eyes,
    horn tips) boosted, plus glowing green veins (iso-lines of a smooth noise). Returns (skin, emissive)."""
    from scipy.ndimage import gaussian_filter
    base = np.asarray(Image.open(os.path.join(root, 'assets_src', 'vfx', 'beast_basecolor.png')).convert('RGB').resize((s, s))).astype(np.float32) / 255
    Lum = base.mean(-1)
    t = np.clip(Lum * 2.2, 0, 1) ** 1.1
    deep = np.array([0.05, 0.015, 0.09]); vio = np.array([0.46, 0.20, 0.80]); hi = np.array([0.78, 0.62, 1.0])
    col = deep + (vio - deep) * t[..., None] + (hi - vio) * np.clip(t - 0.75, 0, 1)[..., None] * 2
    green = np.clip((base[..., 1] - np.maximum(base[..., 0], base[..., 2])) * 6, 0, 1)
    n = gaussian_filter(np.random.default_rng(14).random((s, s)), 22, mode='wrap'); n = (n - n.min()) / np.ptp(n)
    n2 = gaussian_filter(np.random.default_rng(15).random((s, s)), 40, mode='wrap'); n2 = (n2 - n2.min()) / np.ptp(n2)
    veins = (np.exp(-((n - 0.5) / 0.010) ** 2) + 0.7 * np.exp(-((n - 0.32) / 0.008) ** 2)) * np.clip((n2 - 0.45) * 4, 0, 1)
    veins = np.clip(veins, 0, 1) * (Lum < 0.45)
    glow = np.clip(np.maximum(green, veins * 0.9), 0, 1)
    gcol = np.array([0.25, 1.0, 0.50])
    col = col * (1 - glow[..., None]) + gcol * glow[..., None]
    skin = Image.fromarray((np.dstack([np.clip(col, 0, 1), np.ones((s, s))]) * 255).astype(np.uint8), 'RGBA')
    gl = np.clip(glow[..., None] * gcol + (t > 0.85)[..., None] * vio * 0.35, 0, 1)
    glow_im = Image.fromarray((np.dstack([gl, np.clip(glow + 0.3 * (t > 0.85), 0, 1)]) * 255).astype(np.uint8), 'RGBA')
    return skin, glow_im


def textures(root):
    skin, glow = beast_colour(root)
    return {'beast_skin2': skin, 'beast_glow': glow, 'shadow_pool': shadow_pool(), 'smoke_puff': smoke_puff()}


def anim_files(root):
    """{game path: bytes} for the beast's .skn/.skl/.anm and the clip length."""
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    frames, total = BA.compose(b)
    return BA.files(b, frames, BEAST_BASE), total


# ------------------------------------------------------------------ the persistent system (R buff, 15 s)
def _ring(name, T, t, y, col, pass_, size=50, grow=7.0, life=0.45):
    return V.emitter(name, T('shock_ring'), blend=4, delay=t, life=life, bind=1.0, pos=(0, y, 0), scale=(size, size, 1),
                     scale_curve=([0, 1], [(1,) * 3, (grow,) * 3]),
                     color_curve=([0, 0.15, 1], [col + (0,), col + (0.9,), DEEP + (0,)]), pass_=pass_, linger=0.3)


def _ground_ring(name, T, t, col, pass_, size=60, grow=6.0, life=0.6):
    return V.emitter(name, T('shock_ring'), blend=4, delay=t, life=life, bind=1.0, ground=True, rotation=(-90, -90, 0),
                     scale=(size, size, 1), scale_curve=([0, 1], [(1,) * 3, (grow,) * 3]),
                     color_curve=([0, 0.1, 1], [col + (0,), col + (1,), DEEP + (0,)]), pass_=pass_, linger=0.3, **WORLD)


def emitters(T):
    ems = []
    total = BA.timeline()[1]
    nt = lambda t: min(max(t / total, 0.0), 1.0)
    roar = BA.event_times('roar', 0.45)[0]
    pounds = [a + d for a in BA.event_times('pound', 0.0) for d in (0.18, 0.45, 0.72)]
    stomps = [a + d for a in BA.event_times('stomp', 0.0) for d in (0.27, 0.69)]
    swipe = BA.event_times('swipe', 0.0)[0] + 0.55
    shout = BA.event_times('shout', 0.0)[0] + 0.51
    dive = total - BA.DIVE
    # ---- rising out of the pool
    ems.append(V.emitter('MVB_Pool', T('shadow_pool'), blend=1, life=1.7, bind=1.0, ground=True, rotation=(-90, -90, 0),
                         scale=(270, 270, 1), scale_curve=([0, 0.1, 0.2, 1], [(0.2,) * 3, (1.08,) * 3, (1.0,) * 3, (1.02,) * 3]),
                         color_curve=fade(WH, 0.04, 0.7, 1.0), pass_=-2700, **WORLD))
    ems.append(_ground_ring('MVB_PoolRing', T, 0.0, VIO, -2690, grow=5.5, life=0.55))
    ems.append(V.emitter('MVB_Smoke', T('smoke_puff'), blend=1, single=False, rate=70, emitter_life=1.4, delay=0.02, life=1.1,
                         bind=0.0, pos=(0, 20, 0), spawn_radius=230, scale=V.vvec3((40, 40, 40), rand=[(0.6, 1.6), None, None]),
                         scale_curve=([0, 1], [(0.6,) * 3, (1.6,) * 3]), velocity=V.vvec3((0, 160, 0), rand=[None, (0.5, 1.5), None]),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((40, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.15, 0.6, 0.7), pass_=9300))
    # ---- the beast (whole ult) + its emissive veins, flaring on every action
    anim_mesh = L.Struct('VfxPrimitiveMesh', [F('mMesh', L.EMBED, L.Struct('VfxMeshDefinitionData', [
        F('mMeshName', L.STRING, BEAST_BASE + '.skn'), F('mMeshSkeletonName', L.STRING, BEAST_BASE + '.skl'),
        F('mAnimationName', L.STRING, BEAST_BASE + '.anm')], L.EMBED))], L.STRUCT)
    drive = ([0, nt(0.40), nt(total - 0.12), 1], [1.0, 0.0, 0.0, 0.6])        # builds up from the pool, frays at the end
    ems.append(V.emitter('MVB_Beast', T('beast_skin2'), blend=1, life=total, bind=1.0, primitive=anim_mesh, scale=(1, 1, 1),
                         backface=True, pass_=9310,
                         color_curve=([0, 0.004, nt(dive), nt(total - 0.04), 1], [WH + (0,), WH + (1,), WH + (1,), (0.8, 0.6, 1.0, 0.9), VIO + (0,)]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.30, 0.10, 0.55)), **WORLD))
    keys = [(0.0, FLOW, 0.0), (0.3, HI, 0.55)]
    beat = 0.9                                                         # its veins pulse like a heartbeat
    while beat < total - 0.8:
        keys += [(beat, HI, 0.78), (beat + 0.12, HI, 0.5), (beat + 0.24, HI, 0.68), (beat + 0.5, HI, 0.5)]
        beat += 1.15
    for t, c, a in [(roar, WH, 0.95)] + [(p, HI, 0.85) for p in pounds] + [(s_, HI, 0.85) for s_ in stomps] + \
                   [(swipe, LAV, 0.9), (shout, WH, 1.0), (dive, VIO, 0.9), (total - 0.05, WH, 1.0)]:
        keys += [(t - 0.06, HI, 0.55), (t, c, a), (t + 0.25, HI, 0.55)]
    keys += [(total, WH, 0.0)]
    keys.sort(key=lambda k: k[0])
    dedup = []                                                          # actions override heartbeat keys nearby
    for k in keys:
        if dedup and k[0] - dedup[-1][0] < 0.03:
            if k[2] >= dedup[-1][2]:
                dedup[-1] = k
            continue
        dedup.append(k)
    keys = dedup
    ems.append(V.emitter('MVB_BeastGlow', T('beast_glow'), blend=4, life=total, bind=1.0, primitive=anim_mesh, scale=(1.01, 1.01, 1.01),
                         backface=True, pass_=9311, color_curve=([nt(k[0]) for k in keys], [k[1] + (k[2],) for k in keys]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.06, 0.40, 0.18)), **WORLD))
    # ---- a shadow beast: it smokes all the time (left behind in the world, so it trails when he moves) + embers
    ems.append(V.emitter('MVB_Shroud', T('smoke_puff'), blend=1, single=False, rate=14, emitter_life=total - 0.6, delay=0.5, life=1.4,
                         bind=0.0, pos=(0, BA.BEHIND * SCREEN_UP * 0.55, 0), spawn_radius=150,
                         scale=V.vvec3((34, 34, 34), rand=[(0.6, 1.5), None, None]), scale_curve=([0, 1], [(0.7,) * 3, (1.7,) * 3]),
                         velocity=V.vvec3((0, 70, 0), rand=[None, (0.4, 1.4), None]),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((25, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.2, 0.55, 0.55), pass_=9301))
    ems.append(V.emitter('MVB_Embers', T('light_dot'), blend=4, single=False, rate=10, emitter_life=total - 0.6, delay=0.5, life=1.6,
                         bind=0.0, pos=(0, BA.BEHIND * SCREEN_UP * 0.8, 0), spawn_radius=160, scale=V.vvec3((2.6, 2.6, 2.6), rand=[(0.6, 1.4), None, None]),
                         velocity=V.vvec3((20, 110, 20), rand=[(-1, 1), (0.5, 1.4), (-1, 1)]), drag=(0.6, 0.6, 0.6),
                         color_curve=([0, 0.2, 0.7, 1], [HI + (0,), HI + (0.9,), VIO + (0.7,), VIO + (0,)]), pass_=9302))
    # ---- roar: rings at its head, its wrist chains burst
    for j in range(3):
        ems.append(_ring(f'MVB_Roar{j}', T, roar + 0.08 * j, HEAD_Y, HI if j % 2 else VIO, 9320 + j))
    ems.append(_ground_ring('MVB_RoarGround', T, roar, VIO, -2680, size=80, grow=6.5))
    ems.append(V.emitter('MVB_ChainBurst', T('chain_metal'), blend=1, single=False, rate=500, emitter_life=0.06, delay=roar + 0.1,
                         life=1.0, bind=0.0, pos=(0, CHEST_Y, 0), spawn_radius=150, mesh=T('chain_link').replace('.tex', '.scb'),
                         backface=True, scale=V.vvec3((1.4, 1.4, 1.4), rand=[(0.7, 1.3), None, None]),
                         velocity=V.vvec3((700, 600, 700), rand=[(-1, 1), (0.1, 1.0), (-1, 1)]), accel=(0, -1500, 0),
                         rotation=V.vvec3((180, 180, 180), rand=[(-1, 1)] * 3), spin=V.vvec3((800, 600, 0), rand=[(-1, 1), (-1, 1), None]),
                         color_curve=([0, 0.1, 0.7, 1], [HI + (1,), WH + (1,), WH + (1,), FLOW + (0,)]), pass_=9330))
    ems.append(V.emitter('MVB_ChainFlash', T('flash_star'), blend=4, delay=roar + 0.08, life=0.3, bind=1.0, pos=(0, CHEST_Y, 0),
                         scale=(140, 140, 1), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.8,), FLOW + (0,)]), pass_=9331))
    # ---- chest pound: green sparks off its chest
    for k, t in enumerate(pounds):
        ems.append(V.emitter(f'MVB_Pound{k}', T('light_dot'), blend=4, single=False, rate=500, emitter_life=0.04, delay=t, life=0.45,
                             bind=1.0, pos=(0, CHEST_Y, 0), spawn_radius=30, scale=(5, 5, 5), drag=(2, 2, 2),
                             velocity=V.vvec3((420, 300, 420), rand=[(-1, 1), (-0.3, 1), (-1, 1)]), direction_oriented=True, dir_scale=0.008,
                             color_curve=([0, 0.4, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9335 + k))
    # ---- stomps: shock rings over the ground and dust
    for k, t in enumerate(stomps):
        ems.append(_ground_ring(f'MVB_Stomp{k}', T, t, HI if k % 2 else VIO, -2675 + k, size=70, grow=6.0))
        ems.append(V.emitter(f'MVB_StompDust{k}', T('smoke_puff'), blend=1, single=False, rate=260, emitter_life=0.05, delay=t, life=0.8,
                             bind=0.0, pos=(0, 15, 0), spawn_radius=260, scale=V.vvec3((26, 26, 26), rand=[(0.6, 1.4), None, None]),
                             scale_curve=([0, 1], [(0.6,) * 3, (1.5,) * 3]), velocity=V.vvec3((0, 90, 0), rand=[None, (0.4, 1.4), None]),
                             color_curve=fade(WH, 0.1, 0.5, 0.6), pass_=9340 + k))
    # ---- claw swipe: three violet slash streaks across its upper body
    for k in range(3):
        ems.append(V.emitter(f'MVB_Swipe{k}', T('light_streak'), blend=4, delay=swipe + 0.03 * k, life=0.32, bind=1.0,
                             pos=(0, CHEST_Y + 40, 0), uniform=False, scale=(14, 130, 1), rotation=(35 + 12 * k, 0, 0),
                             scale_curve=([0, 0.3, 1], [(0.4, 0.2, 1), (1, 1, 1), (0.6, 1.2, 1)]),
                             color_curve=([0, 0.15, 1], [WH + (1,), LAV + (0.9,), VIO + (0,)]), pass_=9350 + k))
    # ---- arms-spread bellow: violet rings + a flash at its head
    for j in range(3):
        ems.append(_ring(f'MVB_Shout{j}', T, shout + 0.1 * j, HEAD_Y, VIO if j % 2 else LAV, 9360 + j, size=60, grow=8.0, life=0.55))
    ems.append(V.emitter('MVB_ShoutFlash', T('flash_star'), blend=4, delay=shout, life=0.35, bind=1.0, pos=(0, HEAD_Y, 0),
                         scale=(120, 120, 1), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), VIO + (0.8,), VIO + (0,)]), pass_=9363))
    # ---- the dive: the pool returns, an implosion on him, the impact as the ult ends
    ems.append(V.emitter('MVB_PoolEnd', T('shadow_pool'), blend=1, delay=dive - 0.2, life=BA.DIVE + 0.5, bind=1.0, ground=True,
                         rotation=(-90, -90, 0), scale=(220, 220, 1), color_curve=fade(WH, 0.2, 0.7, 0.9), pass_=-2695, linger=0.4, **WORLD))
    ems.append(V.emitter('MVB_Implode', T('shock_ring'), blend=4, delay=dive, life=BA.DIVE, bind=1.0, pos=(0, 110, 0), scale=(60, 60, 1),
                         scale_curve=([0, 1], [(6.0,) * 3, (0.4,) * 3]), color_curve=([0, 0.3, 1], [VIO + (0,), VIO + (1,), HI + (1,)]),
                         pass_=9370, linger=0.3))
    end = total - 0.06
    ems.append(V.emitter('MVB_Impact', T('flash_star'), blend=4, delay=end, life=0.4, bind=1.0, pos=(0, 110, 0), scale=(130, 130, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.4,) * 3, (1.7,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), VIO + (0.9,), FLOW + (0,)]), pass_=9371, linger=0.5))
    ems.append(_ground_ring('MVB_ImpactRing', T, end, HI, -2670, size=50, grow=6.0, life=0.5))
    ems.append(V.emitter('MVB_Wisps', T('smoke_puff'), blend=1, single=False, rate=40, emitter_life=0.06, delay=end, life=0.9,
                         bind=0.0, pos=(0, 60, 0), spawn_radius=40, scale=V.vvec3((18, 18, 18), rand=[(0.7, 1.4), None, None]),
                         scale_curve=([0, 1], [(0.6,) * 3, (1.5,) * 3]), velocity=V.vvec3((0, 140, 0), rand=[None, (0.6, 1.4), None]),
                         color_curve=fade(WH, 0.15, 0.6, 0.65), pass_=9372, linger=0.9))
    return ems


def install(b, skin_path, resolver_path, mv, r_spell):
    """Adds the beast system, its resource key and the R-buff condition (attached to his layout bone)."""
    T = lambda n: mv + 'mvfx_' + n + '.tex'
    path = PART + SYSTEM
    ems = emitters(T)
    st = L.Struct('VfxSystemDefinitionData', [
        F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, ems)),
        F('particleName', L.STRING, SYSTEM), F('particlePath', L.STRING, path),
        F('objectPath', L.HASH, L.fnv1a(path))], L.STRUCT)
    b.entries.append(L.Entry(path, st))
    V.add_resource(b, resolver_path, SYSTEM, path)
    cond = L.Struct('PersistentEffectConditionData', [
        F('OwnerCondition', L.STRUCT, L.Struct('HasBuffDynamicMaterialBoolDriver', [F('Spell', L.HASH, L.fnv1a(r_spell))], L.STRUCT)),
        F('PersistentVfxs', L.LIST2, L.List(L.EMBED, [L.Struct('PersistentVfxData', [
            F('boneName', L.STRING, 'C_Buffbone_Glb_Layout_Loc'), F('effectKey', L.HASH, L.fnv1a(SYSTEM))], L.EMBED)], L.LIST2))], L.STRUCT)
    b.entry(skin_path).struct.field('PersistentEffectConditions').value.items.append(cond)
    return st
