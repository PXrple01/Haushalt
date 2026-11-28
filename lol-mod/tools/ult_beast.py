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
The beast is an Ego ghost: cut off at the hips (beast_anim.Beast.ghost) with a winding smoke tail of its own
(own .skn on 8 extra joints of the same skeleton, same animation), see-through (55 %, head more opaque so the face
reads) with a bright rim and an inner light, veins pulsing like a heartbeat; solid only for a moment on each hit. A
ring with faint mist lies on the ground under both. It floats like under water (figure eight, slow sway, soft
cross-fades, arms and head swinging through, the tail trailing every glide). Every hit makes it sink with its weight
(beast_anim.impacts) and sends a shock over the ground under it (a ring and glowing cracks lying flat at its ground
height - a height above him that lines up with it on screen - plus dust, and a ring on the real ground for the big
ones).
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
import meshy_props as MP
from vfxshapes import holo, fade

F = L.Field
FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); WH = (1.0, 1.0, 1.0)
VIO = (0.55, 0.30, 0.95); LAV = (0.80, 0.70, 1.0); SHADOW = (0.05, 0.02, 0.08)
BODY_ALPHA = 0.55                          # the ghost's opacity between its hits (clarity)
PART = 'Characters/Yunara/Skins/Skin0/Particles/'
SYSTEM = 'MV_R_EgoBeast'
BEAST_BASE = 'assets/characters/yunara/skins/base/particles/mvfx/mvfx_v2_beast'
WORLD = dict(local_orientation=False)
SCREEN_UP = math.tan(math.radians(56))          # height that matches being further back on screen
HEAD_Y = 390 + BA.HOVER + BA.BEHIND * SCREEN_UP   # the beast's head, as a height above him (it floats at HOVER)
CHEST_Y = 300 + BA.HOVER + BA.BEHIND * SCREEN_UP
GROUND_B = BA.BEHIND * SCREEN_UP           # the ground under the beast, as a height above him
TAIL_Y = GROUND_B + 150                    # around the middle of its smoke tail (it floats, see beast_anim.HOVER)
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


def shadow_ring(s=512):
    """Clarity version of the shadow floor: a thin violet ring with a green inner line and only a faint mist inside,
    so enemy ground markers under it stay readable (alpha blend)."""
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    wob = 0.86 + 0.025 * np.sin(a * 7 + 1.3) + 0.015 * np.sin(a * 13)
    ring = np.exp(-((r - wob) / 0.022) ** 2)
    inner = np.exp(-((r - wob + 0.06) / 0.010) ** 2) * 0.8
    mist = np.clip((r - 0.45) / (wob - 0.45), 0, 1) ** 2 * (r < wob) * 0.22 * (0.6 + 0.4 * _noise(s, 8, 9))
    rgb = (np.dstack([np.full_like(r, VIO[0]), np.full_like(r, VIO[1]), np.full_like(r, VIO[2])]) * ring[..., None]
           + np.dstack([np.full_like(r, HI[0]), np.full_like(r, HI[1]), np.full_like(r, HI[2])]) * inner[..., None]
           + np.dstack([np.full_like(r, SHADOW[0]), np.full_like(r, SHADOW[1]), np.full_like(r, SHADOW[2])]) * mist[..., None])
    alpha = np.clip(np.maximum(np.maximum(ring, inner), mist), 0, 1)
    return Image.fromarray((np.dstack([np.clip(rgb / np.maximum(alpha, 1e-3)[..., None], 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')


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


BODY_TEX_ALPHA = 0.8               # body opacity in the texture; the head keeps 1.0 (its face stays readable)


def _raster(b, values, s, uv=None, tris=None):
    """A per-vertex value rasterised into a UV layout (barycentric), gaps filled from the nearest texel. Default: the
    (cut) body, whose skn uv is the npz uv with v flipped; uv/tris: any mesh with uv already in image convention."""
    from scipy.ndimage import distance_transform_edt
    uv = (np.stack([b.uv[:, 0], 1 - b.uv[:, 1]], 1) if uv is None else np.asarray(uv, float)) * (s - 1)
    tris = b.tris if tris is None else tris
    acc = np.zeros((s, s)); cnt = np.zeros((s, s))
    for tri in tris:
        p = uv[tri]; a = values[tri]
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
    field = np.where(covered, acc / np.maximum(cnt, 1), 0)
    _, (iy, ix) = distance_transform_edt(~covered, return_indices=True)
    return field[iy, ix]


def ghost_alpha(root, s=1024):
    """Alpha of the ghost body in texture space: the hips (cut, see beast_anim.Beast.ghost) dissolve into a ragged
    smoky edge where the tail takes over; the head stays more opaque than the body so the face reads clearly.
    Returns (alpha, edge) with edge = how much a texel sits in the dissolving band."""
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    cut = 1 - np.clip((b.legw - 0.10) / (BA.CUT_LEGW - 0.10), 0, 1)
    head = [b.names.index(n) for n in ('neck', 'Head', 'head_end', 'headfront')]
    headw = np.clip((b.w * np.isin(b.infl, head)).sum(1) * 1.5, 0, 1)
    a_cut = _raster(b, cut, s)
    band = (a_cut > 0.0) & (a_cut < 1.0)
    a_cut = np.clip(a_cut + (_noise(s, 3, 21) - 0.5) * 0.6 * band, 0, 1) ** 1.3
    edge = np.clip(4 * a_cut * (1 - a_cut), 0, 1)
    a_head = _raster(b, headw, s)
    alpha = a_cut * (BODY_TEX_ALPHA + (1 - BODY_TEX_ALPHA) * a_head)
    return alpha, edge


def beast_colour(root, s=1024):
    """Epic green-violet skin from Meshy's base colour: obsidian to violet by brightness, Meshy's own green (eyes,
    horn tips) boosted, plus glowing green veins (iso-lines of a smooth noise). The cut hips dissolve into smoke (alpha),
    their dissolving edge smoulders violet-green; the head is more opaque. Returns (skin, emissive, inner light)."""
    from scipy.ndimage import gaussian_filter
    base = np.asarray(Image.open(os.path.join(root, 'assets_src', 'vfx', 'beast_basecolor.png')).convert('RGB').resize((s, s))).astype(np.float32) / 255
    v2 = os.path.join(root, 'assets_src', 'vfx', 'beast_basecolor_v2.png')
    if os.path.exists(v2):      # Meshy retexture in the genie tail's style (same UVs): its surface detail drives the shading
        skin2 = np.asarray(Image.open(v2).convert('RGB').resize((s, s))).astype(np.float32) / 255
        Lum = skin2.mean(-1)
        t = np.clip((Lum - np.percentile(Lum, 5)) / (np.percentile(Lum, 98) - np.percentile(Lum, 5) + 1e-6), 0, 1) ** 1.2
    else:
        Lum = base.mean(-1)
        t = np.clip(Lum * 2.2, 0, 1) ** 1.1
    deep = np.array([0.05, 0.015, 0.09]); vio = np.array([0.46, 0.20, 0.80]); hi = np.array([0.78, 0.62, 1.0])
    col = deep + (vio - deep) * t[..., None] + (hi - vio) * np.clip(t - 0.75, 0, 1)[..., None] * 2
    green = np.clip((base[..., 1] - np.maximum(base[..., 0], base[..., 2])) * 6, 0, 1)
    warm = np.clip((np.minimum(base[..., 0], base[..., 1]) - base[..., 2]) * 4 - 0.4, 0, 1)    # the glowing mouth
    green = np.maximum(green, warm)
    n = gaussian_filter(np.random.default_rng(14).random((s, s)), 22, mode='wrap'); n = (n - n.min()) / np.ptp(n)
    n2 = gaussian_filter(np.random.default_rng(15).random((s, s)), 40, mode='wrap'); n2 = (n2 - n2.min()) / np.ptp(n2)
    veins = (np.exp(-((n - 0.5) / 0.010) ** 2) + 0.7 * np.exp(-((n - 0.32) / 0.008) ** 2)) * np.clip((n2 - 0.45) * 4, 0, 1)
    veins = np.clip(veins, 0, 1) * (t < 0.55)
    glow = np.clip(np.maximum(green, veins * 0.9), 0, 1)
    gcol = np.array([0.25, 1.0, 0.50])
    col = col * (1 - glow[..., None]) + gcol * glow[..., None]
    alpha, edge = ghost_alpha(root, s)
    col = col * (1 - 0.6 * edge[..., None]) + np.array([0.35, 0.12, 0.6]) * 0.6 * edge[..., None]
    skin = Image.fromarray((np.dstack([np.clip(col, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')
    gl = np.clip(glow[..., None] * gcol + (t > 0.85)[..., None] * vio * 0.35, 0, 1)
    ga = np.clip(glow + 0.3 * (t > 0.85), 0, 1) * alpha
    ember = edge * (0.55 + 0.45 * _noise(s, 2, 33))                    # smouldering edge of the dissolve
    ecol = np.array([0.45, 0.25, 1.0]) * (1 - _noise(s, 8, 34)[..., None]) + np.array([0.3, 1.0, 0.55]) * _noise(s, 8, 34)[..., None]
    gl = gl * (1 - ember[..., None]) + ecol * ember[..., None]
    ga = np.maximum(ga, ember * 0.9)
    glow_im = Image.fromarray((np.dstack([np.clip(gl, 0, 1), ga]) * 255).astype(np.uint8), 'RGBA')
    # inner light: the ghost glows from within (soft, violet-white, brighter where the skin is lighter)
    inner = gaussian_filter(np.clip(t * 1.2, 0, 1), 6) * alpha
    icol = np.array([0.55, 0.40, 1.0]) * (1 - inner[..., None] * 0.4) + np.array([0.9, 0.95, 1.0]) * inner[..., None] * 0.4
    inner_im = Image.fromarray((np.dstack([np.clip(icol * inner[..., None], 0, 1), inner]) * 255).astype(np.uint8), 'RGBA')
    return skin, glow_im, inner_im


def meshy_tail_textures(root, s=1024):
    """The genie tail Meshy modelled: its colours mapped to the ghost palette (obsidian -> violet by brightness, like
    the body), see-through like the body and fading out towards the tip (alpha from each vertex's distance along the
    tail, rasterised into its UV layout); the bright smoke ribbons glow green-violet in the additive layer."""
    from scipy.ndimage import gaussian_filter
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    tl = b.tail
    base = np.asarray(Image.open(os.path.join(root, 'assets_src', 'vfx', 'genie_tail_basecolor.png')).convert('RGB').resize((s, s))).astype(np.float32) / 255
    Lum = base.mean(-1)
    t = np.clip((Lum - np.percentile(Lum, 5)) / (np.percentile(Lum, 98) - np.percentile(Lum, 5) + 1e-6), 0, 1) ** 1.2
    deep = np.array([0.05, 0.015, 0.09]); vio = np.array([0.46, 0.20, 0.80]); hi = np.array([0.80, 0.66, 1.0])
    col = deep + (vio - deep) * t[..., None] + (hi - vio) * np.clip(t - 0.7, 0, 1)[..., None] * 2.5
    sv = _raster(b, b.tail_s, s, uv=tl['uv'], tris=tl['tris'])
    fade = 1 - np.clip((sv - 0.72) / 0.28, 0, 1) ** 1.5
    alpha = np.clip(BODY_TEX_ALPHA * fade * (0.75 + 0.25 * t), 0, 1)
    smoke = Image.fromarray((np.dstack([np.clip(col, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')
    rib = np.clip((t - 0.62) * 3.0, 0, 1)
    n = gaussian_filter(np.random.default_rng(41).random((s, s)), 18, mode='wrap'); n = (n - n.min()) / np.ptp(n)
    gcol = np.array([0.30, 1.0, 0.55]) * n[..., None] + np.array([0.60, 0.35, 1.0]) * (1 - n[..., None])
    ga = rib * fade
    glow = Image.fromarray((np.dstack([np.clip(gcol * ga[..., None], 0, 1), ga]) * 255).astype(np.uint8), 'RGBA')
    return smoke, glow


def tail_textures(w=256, h=512, root=None):
    """Smoke tail (u around, v from the hips to the tip): twisting smoke streaks, dark violet with lighter folds,
    fading out to the tip (alpha blend) + thin green-violet wisps winding along it (additive). With the Meshy genie
    tail present its own textures (meshy_tail_textures) are used instead."""
    if root is not None and os.path.exists(BA.MESHY_TAIL):
        return meshy_tail_textures(root)
    from scipy.ndimage import gaussian_filter
    rng = np.random.default_rng(31)
    v = np.linspace(0, 1, h)[:, None].repeat(w, 1)
    streak = gaussian_filter(rng.random((h, w)), (14, 3), mode='wrap'); streak = (streak - streak.min()) / np.ptp(streak)
    fold = gaussian_filter(rng.random((h, w)), (30, 8), mode='wrap'); fold = (fold - fold.min()) / np.ptp(fold)
    fade = (1 - v) ** 0.9 * np.clip(v / 0.05, 0.55, 1)
    alpha = np.clip(fade * (0.55 + 0.45 * streak) * (0.75 + 0.25 * fold), 0, 1)
    lite = np.clip((streak - 0.55) * 2.5, 0, 1)
    col = np.array([0.22, 0.10, 0.38]) * (1 - lite[..., None]) + np.array([0.62, 0.42, 1.0]) * lite[..., None]
    smoke = Image.fromarray((np.dstack([np.clip(col, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')
    wisp = np.exp(-((streak - 0.62) / 0.025) ** 2) * (fold > 0.45)
    wisp = np.clip(gaussian_filter(wisp, 1.2) * 2.2, 0, 1) * (1 - v) ** 1.0
    green = fold[..., None]
    wcol = np.array([0.30, 1.0, 0.55]) * green + np.array([0.60, 0.35, 1.0]) * (1 - green)
    glow = Image.fromarray((np.dstack([np.clip(wcol * wisp[..., None], 0, 1), wisp]) * 255).astype(np.uint8), 'RGBA')
    return smoke, glow


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
    skin, glow, inner = beast_colour(root)
    tail, tail_glow = tail_textures(root=root)
    out = {}
    if MP.available('crown'):
        cr = np.asarray(MP.texture('crown')).astype(np.float32) / 255
        green = np.clip((cr[..., 1] - np.maximum(cr[..., 0], cr[..., 2])) * 5, 0, 1)
        violet = np.clip((cr[..., 2] - cr[..., 1]) * 4 - 0.3, 0, 1)
        gl = np.clip(green[..., None] * np.array([0.3, 1.0, 0.55]) + violet[..., None] * np.array([0.65, 0.35, 1.0]), 0, 1)
        out['beast_crown'] = Image.fromarray((np.clip(cr * 1.5 + 0.04, 0, 1) * 255).astype(np.uint8))
        out['beast_crownglow'] = Image.fromarray((np.dstack([gl, np.maximum(green, violet)]) * 255).astype(np.uint8), 'RGBA')
    return {**out, 'beast_skin2': skin, 'beast_glow': glow, 'beast_inner': inner, 'beast_tail': tail, 'beast_tailglow': tail_glow, 'shadow_pool': shadow_pool(), 'shadow_ring': shadow_ring(),
            'smoke_puff': smoke_puff(), 'smoke_violet': smoke_violet(),
            'ground_crack': ground_crack()}


def anim_files(root):
    """{game path: bytes} for the beast's .skn/.skl/.anm (+ the penta appearance, multikill_fx.py) and the clip length."""
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    frames, total = BA.compose(b)
    penta, _ = BA.compose_penta(b)
    extra = {}
    if MP.available('crown'):                 # the penta ghost's crown of chains and horns, on its Head joint
        head = b.pos[np.argmax(b.pos[:, 1])]
        P, N, U, T = MP.crown(head)
        hi = b.names.index('Head')
        I = np.zeros((len(P), 4), np.int64); I[:, 0] = hi
        W = np.zeros((len(P), 4)); W[:, 0] = 1.0
        extra['_crown'] = dict(pos=P, nrm=N, uv=U, tris=T, infl=I, w=W)
    return BA.files(b, frames, BEAST_BASE, {'_penta': penta}, extra), total


# ------------------------------------------------------------------ the persistent system (R buff, 15 s)
def mesh_prim(skn_suffix, anm_suffix, base=None):
    """Animated mesh primitive: one of the beast's meshes (body / tail) with the shared skeleton and an animation."""
    base = base or BEAST_BASE
    return L.Struct('VfxPrimitiveMesh', [F('mMesh', L.EMBED, L.Struct('VfxMeshDefinitionData', [
        F('mMeshName', L.STRING, base + skn_suffix), F('mMeshSkeletonName', L.STRING, base + '.skl'),
        F('mAnimationName', L.STRING, base + anm_suffix)], L.EMBED))], L.STRUCT)


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
                         color_curve=fade(WH, 0.04, 0.7, 0.6), pass_=-2700, **WORLD))
    ems.append(_ground_ring('MVB_PoolRing', T, 0.0, VIO, -2690, grow=5.5, life=0.55))
    ems.append(V.emitter('MVB_Smoke', T('smoke_puff'), blend=1, single=False, rate=70, emitter_life=1.4, delay=0.02, life=1.1,
                         bind=0.0, pos=(0, 20, 0), spawn_radius=230, scale=V.vvec3((40, 40, 40), rand=[(0.6, 1.6), None, None]),
                         scale_curve=([0, 1], [(0.6,) * 3, (1.6,) * 3]), velocity=V.vvec3((0, 160, 0), rand=[None, (0.5, 1.5), None]),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((40, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.15, 0.6, 0.7), pass_=9300))
    # ---- the beast (whole ult) + its emissive veins, flaring on every action
    anim_mesh = mesh_prim('.skn', '.anm')
    tail_mesh = mesh_prim('_tail.skn', '.anm')
    drive = ([0, nt(0.40), nt(total - 0.12), 1], [1.0, 0.0, 0.0, 0.6])        # builds up from the pool, frays at the end
    # clarity: after rising it is see-through (BODY_ALPHA) with a bright rim, solid only for a moment on every hit
    ak = [(0.0, 0.0), (0.12, 1.0), (0.9, 1.0), (1.3, BODY_ALPHA)]
    groups = []                                                        # hits close together share one solid window
    for t_, w_ in BA.impacts():
        if t_ <= 1.3:
            continue
        if groups and t_ - 0.1 < groups[-1][1] + 0.6:
            groups[-1] = (groups[-1][0], t_, max(groups[-1][2], w_))
        else:
            groups.append((t_, t_, w_))
    for a_, b_, w_ in groups:
        peak = BODY_ALPHA + (1.0 - BODY_ALPHA) * w_
        ak += [(a_ - 0.1, BODY_ALPHA), (a_ - 0.02, peak), (b_ + 0.3, peak), (b_ + 0.6, BODY_ALPHA)]
    ak += [(dive - 0.1, BODY_ALPHA), (dive + 0.1, 1.0), (total - 0.04, 0.9), (total, 0.0)]
    ak.sort()
    ems.append(V.emitter('MVB_Beast', T('beast_skin2'), blend=1, life=total, bind=1.0, primitive=anim_mesh, scale=(1, 1, 1),
                         backface=True, pass_=9310,
                         color_curve=([nt(t_) for t_, _ in ak], [(0.8, 0.6, 1.0, a_) if t_ > total - 0.05 else WH + (a_,) for t_, a_ in ak]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.75, 0.50, 1.0)), **WORLD))
    body_curve = ([nt(t_) for t_, _ in ak], [(0.8, 0.6, 1.0, a_) if t_ > total - 0.05 else WH + (a_,) for t_, a_ in ak])
    # the smoke tail (same skeleton + animation, own mesh): smoke streaks + winding green-violet wisps
    ems.append(V.emitter('MVB_TailMesh', T('beast_tail'), blend=1, life=total, bind=1.0, primitive=tail_mesh, scale=(1, 1, 1),
                         backface=True, pass_=9308, color_curve=body_curve,
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.45, 0.25, 0.85)), **WORLD))
    ems.append(V.emitter('MVB_TailWispMesh', T('beast_tailglow'), blend=4, life=total, bind=1.0, primitive=tail_mesh, scale=(1.01, 1.01, 1.01),
                         backface=True, pass_=9309, color_curve=([0, nt(0.5), nt(total - 0.3), 1], [HI + (0,), WH + (0.5,), WH + (0.5,), VIO + (0,)]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.05, 0.30, 0.15)), **WORLD))
    # it glows from within (soft violet-white light through the see-through body)
    ems.append(V.emitter('MVB_BeastInner', T('beast_inner'), blend=4, life=total, bind=1.0, primitive=anim_mesh, scale=(1.0, 1.0, 1.0),
                         backface=True, pass_=9312, color_curve=([0, nt(0.4), nt(total - 0.2), 1], [WH + (0,), WH + (0.45,), WH + (0.45,), VIO + (0,)]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.0, 0.0, 0.0)), **WORLD))
    keys = [(0.0, FLOW, 0.0), (0.3, HI, 0.6)]
    beat = 0.9                                                         # its veins pulse like a heartbeat (strong)
    while beat < total - 0.8:
        keys += [(beat, WH, 0.95), (beat + 0.12, HI, 0.45), (beat + 0.24, HI, 0.85), (beat + 0.55, HI, 0.45)]
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
    ems.append(V.emitter('MVB_ShadowFloor', T('shadow_ring'), blend=1, delay=0.45, life=total - 0.9, bind=1.0, ground=True,
                         rotation=(-90, -90, 0), scale=(290, 290, 1), scale_curve=([0, 0.06, 1], [(0.5,) * 3, (1.0,) * 3, (1.0,) * 3]),
                         color_curve=fade(WH, 0.05, 0.92, 0.8), pass_=-2705, **WORLD))
    ems.append(V.emitter('MVB_Tail', T('smoke_violet'), blend=1, single=False, rate=20, emitter_life=total - 0.7, delay=0.35, life=1.3,
                         bind=0.0, pos=(0, TAIL_Y, 0), spawn_radius=165,
                         scale=V.vvec3((40, 40, 40), rand=[(0.6, 1.5), None, None]), scale_curve=([0, 1], [(0.8,) * 3, (2.0,) * 3]),
                         velocity=V.vvec3((0, -45, 0), rand=[None, (0.3, 1.6), None]), drag=(0.5, 0.5, 0.5),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((30, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.15, 0.5, 0.85), pass_=9301))
    ems.append(V.emitter('MVB_TailGlow', T('smoke_puff'), blend=4, single=False, rate=7, emitter_life=total - 0.7, delay=0.4, life=1.1,
                         bind=0.0, pos=(0, TAIL_Y + 20, 0), spawn_radius=120, scale=V.vvec3((50, 50, 50), rand=[(0.7, 1.3), None, None]),
                         scale_curve=([0, 1], [(0.8,) * 3, (1.6,) * 3]), velocity=V.vvec3((0, -20, 0), rand=[None, (0.3, 1.2), None]),
                         color_curve=([0, 0.3, 1], [VIO + (0,), VIO + (0.35,), DEEP + (0,)]), pass_=9304))
    ems.append(V.emitter('MVB_TailWisps', T('smoke_violet'), blend=1, single=False, rate=8, emitter_life=total - 0.7, delay=0.4, life=1.6,
                         bind=0.0, pos=(0, TAIL_Y + 40, 0), spawn_radius=130,
                         scale=V.vvec3((22, 22, 22), rand=[(0.6, 1.4), None, None]), scale_curve=([0, 1], [(0.6,) * 3, (1.8,) * 3]),
                         velocity=V.vvec3((0, 60, 0), rand=[None, (0.4, 1.4), None]),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((25, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.2, 0.55, 0.45), pass_=9302))
    ems.append(V.emitter('MVB_Embers', T('light_dot'), blend=4, single=False, rate=8, emitter_life=total - 0.6, delay=0.5, life=1.6,
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
        ems.append(V.emitter(f'MVB_Dust{k}', T('smoke_puff'), blend=1, single=False, rate=int(70 + 120 * w), emitter_life=0.05, delay=t,
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
    ems.append(V.emitter('MVB_ChainBurst', T('chain_meshy' if MP.available('chainlink_lo') else 'chain_metal'), blend=1, single=False, rate=500, emitter_life=0.06, delay=roar + 0.1,
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
    # ---- casting: a rune of light flares at its raised claw, sparks gather
    for k, t in enumerate(BA.event_times('cast', 0.45)):
        ems.append(V.emitter(f'MVB_CastRune{k}', T('reticle'), blend=4, delay=t, life=0.9, bind=1.0, pos=(0, HEAD_Y + 40, 0),
                             scale=(60, 60, 1), scale_curve=([0, 0.25, 1], [(0.3,) * 3, (1.1,) * 3, (1.3,) * 3]), spin=(90, 0, 0),
                             color_curve=([0, 0.2, 0.7, 1], [HI + (0,), WH + (0.9,), VIO + (0.6,), VIO + (0,)]), pass_=9380 + 40 + k))
        ems.append(V.emitter(f'MVB_CastSparks{k}', T('light_dot'), blend=4, single=False, rate=60, emitter_life=0.6, delay=t - 0.2,
                             life=0.5, bind=1.0, pos=(0, HEAD_Y + 20, 0), spawn_radius=110, scale=V.vvec3((2.4, 2.4, 2.4), rand=[(0.6, 1.4), None, None]),
                             velocity=V.vvec3((0, 60, 0), rand=[None, (0.5, 1.5), None]), drag=(1.5, 1.5, 1.5),
                             color_curve=([0, 0.3, 1], [WH + (0,), HI + (0.9,), VIO + (0,)]), pass_=9380 + 44 + k))
    # ---- charging before the dive: rings pull inwards, a light grows between its raised claws
    ch = BA.event_times('charge', 0.0)[0]
    for j in range(5):
        ems.append(V.emitter(f'MVB_ChargeRing{j}', T('shock_ring'), blend=4, delay=ch + 0.35 + 0.55 * j, life=0.55, bind=1.0,
                             pos=(0, HEAD_Y - 30, 0), scale=(70, 70, 1), scale_curve=([0, 1], [(5.0,) * 3, (0.4,) * 3]),
                             color_curve=([0, 0.3, 1], [VIO + (0,), HI + (0.8,), WH + (1,)]), pass_=9450 + j))
    ems.append(V.emitter('MVB_ChargeCore', T('light_dot'), blend=4, delay=ch + 0.2, life=dive - ch - 0.1, bind=1.0, pos=(0, HEAD_Y - 30, 0),
                         scale=(30, 30, 30), scale_curve=([0, 0.85, 1], [(0.4,) * 3, (2.6,) * 3, (4.0,) * 3]),
                         color_curve=([0, 0.2, 0.9, 1], [HI + (0,), HI + (0.6,), WH + (1,), WH + (0,)]), pass_=9456))
    ems.append(V.emitter('MVB_ChargeMotes', T('light_dot'), blend=4, single=False, rate=40, emitter_life=dive - ch - 0.4, delay=ch + 0.2,
                         life=0.7, bind=1.0, pos=(0, HEAD_Y - 40, 0), spawn_radius=170, scale=V.vvec3((2.2, 2.2, 2.2), rand=[(0.6, 1.4), None, None]),
                         velocity=V.vvec3((0, 150, 0), rand=[None, (0.6, 1.4), None]), drag=(1.0, 1.0, 1.0),
                         color_curve=([0, 0.3, 1], [WH + (0,), HI + (0.9,), FLOW + (0,)]), pass_=9457))
    # ---- arms-spread bellow: violet rings + a flash at its head
    for j in range(3):
        ems.append(_ring(f'MVB_Shout{j}', T, shout + 0.1 * j, HEAD_Y, VIO if j % 2 else LAV, 9360 + j, size=60, grow=8.0, life=0.55))
    ems.append(V.emitter('MVB_ShoutFlash', T('flash_star'), blend=4, delay=shout, life=0.35, bind=1.0, pos=(0, HEAD_Y, 0),
                         scale=(120, 120, 1), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), VIO + (0.8,), VIO + (0,)]), pass_=9363))
    # ---- the dive: the pool returns, an implosion on him, the impact as the ult ends
    ems.append(V.emitter('MVB_PoolEnd', T('shadow_pool'), blend=1, delay=dive - 0.2, life=BA.DIVE + 0.5, bind=1.0, ground=True,
                         rotation=(-90, -90, 0), scale=(220, 220, 1), color_curve=fade(WH, 0.2, 0.7, 0.55), pass_=-2695, linger=0.4, **WORLD))
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
