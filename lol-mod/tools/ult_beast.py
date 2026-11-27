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
The beast is a floating shadow body: its legs dissolve into smoke (texture alpha, smouldering edge) and trail off as
smoke, a shadow pool lies on the ground under both, so nothing touches the ground and nothing slides. Every hit makes
it sink with its weight (beast_anim.impacts) and sends a shock over the ground under it (a ring and glowing cracks
lying flat at its ground height - a height above him that lines up with it on screen - plus dust, and a ring on the
real ground for the big ones). Its arms are simulated as heavy (lag, swing through, settle).
Timeline (seconds after R): rise + roar, crouch and watch, glide out to his left and watch, glide back, chest pound,
slams, glide to his right and crouch, back, claw swipe, arms-spread bellow, look, slam, crouch, then it hurls itself
into him as the screen chains burst (14.6). Its veins pulse like a heartbeat.
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
GROUND_B = BA.BEHIND * SCREEN_UP           # the ground under the beast, as a height above him
TAIL_Y = GROUND_B + 110                    # where its legs dissolve into smoke (it floats, see beast_anim.HOVER)
FLAT = (90, 0, 0)                          # Riot's rotation for a quad lying flat (not glued to the terrain)
QUAD = L.Struct('VfxPrimitiveArbitraryQuad', [], L.STRUCT)


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


def smoke_violet(s=128):
    """Smoke of the shadow body: dark core, violet-lit fringe, so it reads on the grass."""
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); n = _noise(s, 5, 12)
    a = np.clip(1 - r, 0, 1) ** 1.3 * (0.55 + 0.45 * n)
    fr = np.clip((r - 0.25) / 0.5, 0, 1) * n
    rgb = np.dstack([0.10 + 0.40 * fr, 0.04 + 0.18 * fr, 0.16 + 0.62 * fr])
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a]) * 255).astype(np.uint8), 'RGBA')


def smoke_puff(s=128):
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y)
    a = np.clip(1 - r, 0, 1) ** 1.5 * (0.6 + 0.4 * _noise(s, 5, 11))
    rgb = np.dstack([np.full_like(a, 0.12), np.full_like(a, 0.06), np.full_like(a, 0.18)])
    return Image.fromarray((np.dstack([rgb, a]) * 255).astype(np.uint8), 'RGBA')


FEET_Y = 120.0                     # bind height of Meshy's feet (the mesh also has a tail down to 0)
FADE_LO, FADE_HI = 35.0, 120.0     # above the feet: fully smoke below LO, fully solid above HI (knees ~80)


def leg_fade(root, s=1024):
    """Alpha of the shadow body in texture space: the legs dissolve into smoke from the thighs down. Vertex alpha from
    the bind height, rasterised into the UV layout (barycentric), gaps filled from the nearest texel, the edge made
    ragged with noise. Returns (alpha, edge) with edge = how much a texel sits in the dissolving band."""
    from scipy.ndimage import distance_transform_edt
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    h = b.pos[:, 1] - FEET_Y
    legs = [b.names.index(n) for n in b.names if 'Leg' in n or 'Foot' in n or 'Toe' in n or n == 'Hips']
    legw = (b.w * np.isin(b.infl, legs)).sum(1)                       # only legs / hips dissolve, not the long arms
    va = 1 - np.clip(legw * 1.4, 0, 1) * (1 - np.clip((h - FADE_LO) / (FADE_HI - FADE_LO), 0, 1))
    uv = np.stack([b.uv[:, 0], 1 - b.uv[:, 1]], 1) * (s - 1)        # skn uv (v flipped) -> texel
    acc = np.zeros((s, s)); cnt = np.zeros((s, s))
    for tri in b.tris:
        p = uv[tri]; a = va[tri]
        x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, s - 1), min(y1, s - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
        if abs(d) < 1e-9:
            continue
        l0 = ((p[1, 1] - p[2, 1]) * (gx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (gy - p[2, 1])) / d
        l1 = ((p[2, 1] - p[0, 1]) * (gx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (gy - p[2, 1])) / d
        l2 = 1 - l0 - l1
        m = (l0 > -0.02) & (l1 > -0.02) & (l2 > -0.02)
        acc[gy[m], gx[m]] += (l0 * a[0] + l1 * a[1] + l2 * a[2])[m]; cnt[gy[m], gx[m]] += 1
    covered = cnt > 0
    alpha = np.where(covered, acc / np.maximum(cnt, 1), 0)
    _, (iy, ix) = distance_transform_edt(~covered, return_indices=True)
    alpha = alpha[iy, ix]
    band = (alpha > 0.0) & (alpha < 1.0)
    rag = alpha + (_noise(s, 3, 21) - 0.5) * 0.55 * band
    alpha = np.clip(rag, 0, 1) ** 1.3
    edge = np.clip(4 * alpha * (1 - alpha), 0, 1)
    return alpha, edge


def beast_colour(root, s=1024):
    """Epic green-violet skin from Meshy's base colour: obsidian to violet by brightness, Meshy's own green (eyes,
    horn tips) boosted, plus glowing green veins (iso-lines of a smooth noise). The legs dissolve into smoke (alpha),
    their dissolving edge smoulders violet-green. Returns (skin, emissive)."""
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
    alpha, edge = leg_fade(root, s)
    col = col * (1 - 0.6 * edge[..., None]) + np.array([0.35, 0.12, 0.6]) * 0.6 * edge[..., None]
    skin = Image.fromarray((np.dstack([np.clip(col, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')
    gl = np.clip(glow[..., None] * gcol + (t > 0.85)[..., None] * vio * 0.35, 0, 1)
    ga = np.clip(glow + 0.3 * (t > 0.85), 0, 1) * alpha
    ember = edge * (0.55 + 0.45 * _noise(s, 2, 33))                    # smouldering edge of the dissolve
    ecol = np.array([0.45, 0.25, 1.0]) * (1 - _noise(s, 8, 34)[..., None]) + np.array([0.3, 1.0, 0.55]) * _noise(s, 8, 34)[..., None]
    gl = gl * (1 - ember[..., None]) + ecol * ember[..., None]
    ga = np.maximum(ga, ember * 0.9)
    glow_im = Image.fromarray((np.dstack([np.clip(gl, 0, 1), ga]) * 255).astype(np.uint8), 'RGBA')
    return skin, glow_im


def ground_crack(s=512):
    """Shock under the floating beast: jagged radial cracks with a hot core, green-violet (additive)."""
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    rng = np.random.default_rng(5)
    crack = np.zeros_like(r)
    for k in range(11):
        aa = k * 2 * math.pi / 11 + rng.uniform(-0.2, 0.2)
        wig = aa + 0.08 * np.sin(r * rng.uniform(9, 16) + k) + 0.05 * np.sin(r * 31 + 2 * k)
        da = np.abs((a - wig + math.pi) % (2 * math.pi) - math.pi) * np.maximum(r, 0.05)
        ln = rng.uniform(0.55, 0.95)
        crack = np.maximum(crack, np.exp(-(da / 0.010) ** 2) * (r < ln) * (1 - r / ln) ** 0.4)
    core = np.exp(-(r / 0.16) ** 2)
    v = np.clip(crack + core, 0, 1)
    col = np.dstack([0.45 * v + 0.4 * core, v, 0.6 * v + 0.3 * core])
    return Image.fromarray((np.dstack([np.clip(col, 0, 1), v]) * 255).astype(np.uint8), 'RGBA')


def textures(root):
    skin, glow = beast_colour(root)
    return {'beast_skin2': skin, 'beast_glow': glow, 'shadow_pool': shadow_pool(), 'smoke_puff': smoke_puff(), 'smoke_violet': smoke_violet(),
            'ground_crack': ground_crack()}


def anim_files(root):
    """{game path: bytes} for the beast's .skn/.skl/.anm (+ the penta appearance, multikill_fx.py) and the clip length."""
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    frames, total = BA.compose(b)
    penta, _ = BA.compose_penta(b)
    return BA.files(b, frames, BEAST_BASE, {'_penta': penta}), total


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
    for t, c, a in [(roar, WH, 0.95)] + [(p, HI, 0.85) for p in pounds] + [(t_, HI, 0.85) for t_, w_ in BA.impacts() if w_ >= 1.0] + \
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
    # ---- a shadow body: its legs trail off as smoke, a shadow pool lies under both of them, embers rise
    ems.append(V.emitter('MVB_ShadowFloor', T('shadow_pool'), blend=1, delay=0.45, life=total - 0.9, bind=1.0, ground=True,
                         rotation=(-90, -90, 0), scale=(290, 290, 1), scale_curve=([0, 0.06, 1], [(0.5,) * 3, (1.0,) * 3, (1.0,) * 3]),
                         color_curve=fade(WH, 0.05, 0.92, 0.42), pass_=-2705, **WORLD))
    ems.append(V.emitter('MVB_Tail', T('smoke_violet'), blend=1, single=False, rate=30, emitter_life=total - 0.7, delay=0.35, life=1.3,
                         bind=0.0, pos=(0, TAIL_Y, 0), spawn_radius=165,
                         scale=V.vvec3((40, 40, 40), rand=[(0.6, 1.5), None, None]), scale_curve=([0, 1], [(0.8,) * 3, (2.0,) * 3]),
                         velocity=V.vvec3((0, -45, 0), rand=[None, (0.3, 1.6), None]), drag=(0.5, 0.5, 0.5),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((30, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.15, 0.5, 0.85), pass_=9301))
    ems.append(V.emitter('MVB_TailGlow', T('smoke_puff'), blend=4, single=False, rate=10, emitter_life=total - 0.7, delay=0.4, life=1.1,
                         bind=0.0, pos=(0, TAIL_Y + 20, 0), spawn_radius=120, scale=V.vvec3((50, 50, 50), rand=[(0.7, 1.3), None, None]),
                         scale_curve=([0, 1], [(0.8,) * 3, (1.6,) * 3]), velocity=V.vvec3((0, -20, 0), rand=[None, (0.3, 1.2), None]),
                         color_curve=([0, 0.3, 1], [VIO + (0,), VIO + (0.35,), DEEP + (0,)]), pass_=9304))
    ems.append(V.emitter('MVB_TailWisps', T('smoke_violet'), blend=1, single=False, rate=12, emitter_life=total - 0.7, delay=0.4, life=1.6,
                         bind=0.0, pos=(0, TAIL_Y + 40, 0), spawn_radius=130,
                         scale=V.vvec3((22, 22, 22), rand=[(0.6, 1.4), None, None]), scale_curve=([0, 1], [(0.6,) * 3, (1.8,) * 3]),
                         velocity=V.vvec3((0, 60, 0), rand=[None, (0.4, 1.4), None]),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((25, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.2, 0.55, 0.45), pass_=9302))
    ems.append(V.emitter('MVB_Embers', T('light_dot'), blend=4, single=False, rate=12, emitter_life=total - 0.6, delay=0.5, life=1.6,
                         bind=0.0, pos=(0, TAIL_Y + 30, 0), spawn_radius=150, scale=V.vvec3((2.6, 2.6, 2.6), rand=[(0.6, 1.4), None, None]),
                         velocity=V.vvec3((20, 110, 20), rand=[(-1, 1), (0.5, 1.4), (-1, 1)]), drag=(0.6, 0.6, 0.6),
                         color_curve=([0, 0.2, 0.7, 1], [HI + (0,), HI + (0.9,), VIO + (0.7,), VIO + (0,)]), pass_=9303))
    # ---- every hit: the body sinks with its weight (beast_anim.impacts) and a shock runs over the ground under it -
    # a ring and glowing cracks lying flat at its ground, dust thrown up, plus a ring on the real ground for the big ones
    for k, (t, w) in enumerate(BA.impacts()):
        col = HI if k % 2 else VIO
        ems.append(V.emitter(f'MVB_Shock{k}', T('shock_ring'), blend=4, delay=t, life=0.5, bind=1.0, pos=(0, GROUND_B, 0),
                             rotation=FLAT, scale=(40 + 30 * w, 40 + 30 * w, 1), scale_curve=([0, 1], [(1,) * 3, (5.5,) * 3]),
                             color_curve=([0, 0.1, 1], [col + (0,), col + (0.5 + 0.5 * w,), DEEP + (0,)]), pass_=9380 + k,
                             linger=0.3, primitive=QUAD, backface=True, **WORLD))
        ems.append(V.emitter(f'MVB_Crack{k}', T('ground_crack'), blend=4, delay=t, life=0.7, bind=1.0, pos=(0, GROUND_B + 2, 0),
                             rotation=FLAT, scale=(70 + 60 * w, 70 + 60 * w, 1), scale_curve=([0, 0.12, 1], [(0.6,) * 3, (1.0,) * 3, (1.05,) * 3]),
                             color_curve=([0, 0.06, 0.4, 1], [HI + (0,), WH + (0.4 + 0.6 * w,), HI + (0.5 * w,), FLOW + (0,)]),
                             pass_=9400 + k, linger=0.3, primitive=QUAD, backface=True, **WORLD))
        ems.append(V.emitter(f'MVB_Dust{k}', T('smoke_puff'), blend=1, single=False, rate=int(120 + 200 * w), emitter_life=0.05, delay=t,
                             life=0.8, bind=0.0, pos=(0, GROUND_B + 15, 0), spawn_radius=120 + 60 * w,
                             scale=V.vvec3((24, 24, 24), rand=[(0.6, 1.4), None, None]), scale_curve=([0, 1], [(0.6,) * 3, (1.6,) * 3]),
                             velocity=V.vvec3((0, 110, 0), rand=[None, (0.4, 1.4), None]),
                             color_curve=fade(WH, 0.1, 0.5, 0.35 + 0.25 * w), pass_=9420 + k))
        if w >= 0.9:
            ems.append(_ground_ring(f'MVB_GroundShock{k}', T, t + 0.04, col, -2670 + k, size=60, grow=6.5))
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
