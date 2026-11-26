"""METAVISION screen chains: an overlay in the corners of the player's own screen for the whole ult.

How Riot does screen overlays (Vi skin 48 R, Yone skin 58 E, Aatrox skin 33 R, Viego skin 43):
a PersistentVfxData with AttachToCamera = True + ShowToOwnerOnly = True. The system then lives in a camera
frame: x = screen right, z = screen up, y = depth; the visible area is about x -160..160, z -90..90 (16:9).
Screen quads are VfxPrimitiveArbitraryQuad with birthRotation0 (-90, -90, 0), miscRenderFlags 5,
no backface culling, high pass. Aatrox binds it to his R buff (HasBuff) - exactly what we do with YunaraR.

The chain graphic is one texture, symmetric under left/right and up/down mirroring, centred on each screen
corner, so it sits correctly in all four corners whichever way the engine flips the texture (image u = screen
x and v = screen z: Vi's tall 256x512 vein texture is drawn with scale (50, 90)). Timeline (YunaraR lasts 15 s, every rank):
  0.00 - 0.45  chains shoot in from the corner, spike into the screen and are yanked tight (overshoot, snap)
  0.45 - 14.6  held taut: tugs every ~1.3 s, glow pulses, light runs along the links, sparks crackle
  14.6 - 15.6  flare, then the chains burst: links fly off the screen, flash in every corner
If the ult ends early (death), everything fades out over 0.3 s (particle linger).
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import lolbin as L
import vfxlib as V

F = L.Field
FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); WH = (1.0, 1.0, 1.0)
HALF_W, HALF_H = 160.0, 90.0           # visible camera-frame area (16:9)
CHAIN_S = 88.0                        # half-extent of the corner chain quad (texture centre = screen corner)
ARMS = ((14.0, 0.88), (37.0, 0.80), (61.0, 0.60))   # (angle from the horizontal, end radius) per quadrant arm
R0 = 0.31                              # arms start at the shackle ring (fraction of the half-extent)
DUR = 15.0                             # YunaraR buff duration
BURST = 14.62                          # chains break (a little before the buff ends -> system destroyed)
SYSTEM = 'Characters/Yunara/Skins/Skin0/Particles/Yunara_Base_R_ScreenChains'
KEY = 'Yunara_Base_R_ScreenChains'


# ------------------------------------------------------------------ textures
def _link(face, L_=96, W_=56, t=14):
    """One chain link sprite (RGBA, long axis = x), steel with a dark rim and a highlight. face: seen face-on
    (an oval ring) or edge-on (a rounded bar)."""
    s = 4
    w, h = L_ * s, (W_ if face else t + 6) * s
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    if face:
        d.rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=255)
        d.rounded_rectangle([t * s, t * s, w - 1 - t * s, h - 1 - t * s], radius=max(1, h // 2 - t * s), fill=0)
    else:
        d.rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=255)
    a = np.asarray(m.resize((L_, m.height // s), Image.LANCZOS)).astype(np.float32) / 255
    yy = np.linspace(-1, 1, a.shape[0])[:, None] * np.ones((1, a.shape[1]))
    # steel: dark bottom, bright top edge, cool tint
    shade = 0.38 + 0.42 * np.clip(-yy, 0, 1) ** 0.7 + 0.12 * (1 - np.abs(yy))
    rgb = np.dstack([shade * 0.86, shade * 0.90, shade * 0.98])
    from scipy.ndimage import binary_erosion
    inner = binary_erosion(a > 0.5, iterations=2)
    rim = (a > 0.05) & ~inner
    rgb[rim] *= 0.25                                                   # dark outline: readable on any map
    return np.dstack([rgb, a])


def _paste(canvas, sprite, cx, cy, ang):
    im = Image.fromarray((np.clip(sprite, 0, 1) * 255).astype(np.uint8), 'RGBA').rotate(ang, Image.BICUBIC, expand=True)
    canvas.alpha_composite(im, (int(round(cx - im.width / 2)), int(round(cy - im.height / 2))))


def arm_dirs():
    """(dx, dy, end radius) of all 12 arms (x right, y up)."""
    out = []
    for q in range(4):
        sx = 1 if q in (0, 3) else -1; sy = 1 if q in (0, 1) else -1
        for a, r1 in ARMS:
            out.append((sx * math.cos(math.radians(a)), sy * math.sin(math.radians(a)), r1))
    return out


def chain_star(size=1024):
    """The corner chains: a heavy shackle ring at the centre (= screen corner), 12 chains (3 per quadrant), each
    ending in an iron stake that pins it into the screen."""
    S = size * 2
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    c = S / 2; half = S / 2
    face, edge = _link(True, 92, 54, 13), _link(False, 92, 54, 13)
    face = np.asarray(Image.fromarray((face * 255).astype(np.uint8)).resize((face.shape[1] * 2, face.shape[0] * 2), Image.LANCZOS)).astype(np.float32) / 255
    edge = np.asarray(Image.fromarray((edge * 255).astype(np.uint8)).resize((edge.shape[1] * 2, edge.shape[0] * 2), Image.LANCZOS)).astype(np.float32) / 255
    step = face.shape[1] * 0.74
    for dx, dy, R1 in arm_dirs():
        ang = math.degrees(math.atan2(dy, dx))
        r = R0 * half
        k = 0
        while r < R1 * half - step * 0.6:
            px, py = c + dx * r, c - dy * r
            _paste(cv, face if k % 2 == 0 else edge, px, py, ang)
            r += step; k += 1
        # the stake: dark iron spike pointing inwards (away from the corner = along the arm)
        tip = R1 * half + 70
        base = r - 4
        nx, ny = -dy, dx
        pts = [(c + dx * tip, c - dy * tip), (c + dx * base + nx * 40, c - dy * base - ny * 40),
               (c + dx * (base - 44), c - dy * (base - 44)), (c + dx * base - nx * 40, c - dy * base + ny * 40)]
        d = ImageDraw.Draw(cv)
        d.polygon(pts, fill=(8, 10, 12, 255))
        inset = [(c + dx * (tip - 10), c - dy * (tip - 10)), (c + dx * base + nx * 30, c - dy * base - ny * 30),
                 (c + dx * (base - 30), c - dy * (base - 30)), (c + dx * base - nx * 30, c - dy * base + ny * 30)]
        d.polygon(inset, fill=(46, 54, 62, 255))
        d.line([(c + dx * base + nx * 30, c - dy * base - ny * 30), (c + dx * (tip - 10), c - dy * (tip - 10))],
               fill=(170, 182, 192, 255), width=6)
    # the shackle ring at the corner
    d = ImageDraw.Draw(cv)
    for rr, wd, col in ((0.135, 46, (16, 20, 24, 255)), (0.135, 34, (120, 128, 140, 255)), (0.135, 10, (200, 210, 220, 255))):
        R = rr * S
        d.ellipse([c - R, c - R, c + R, c + R], outline=col, width=wd)
    for k in range(16):                                               # rivets
        a = 2 * math.pi * k / 16; R = 0.135 * S
        x, y = c + R * math.cos(a), c + R * math.sin(a)
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(60, 66, 74, 255))
    return cv.resize((size, size), Image.LANCZOS)


def chain_glow(size=512):
    """Additive energy layer for the chains: a soft halo along every arm + bright cracks where the stakes pin the
    screen + a ring of light around the shackle."""
    S = size * 2
    m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
    c = S / 2; half = S / 2
    core = Image.new('L', (S, S), 0); dc = ImageDraw.Draw(core)
    rng = np.random.default_rng(3)
    for dx, dy, R1 in arm_dirs():
        p0 = (c + dx * R0 * half, c - dy * R0 * half); p1 = (c + dx * R1 * half, c - dy * R1 * half)
        d.line([p0, p1], fill=120, width=40)
        tip = (c + dx * (R1 * half + 34), c - dy * (R1 * half + 34))
        base_a = math.atan2(-dy, dx)
        for j in range(4):                                            # glass cracks where the stake pierces
            a = base_a + (j - 1.5) * 0.9 + rng.uniform(-0.2, 0.2)
            x, y = tip; pts = [(x, y)]
            for seg in range(2):
                a += rng.uniform(-0.25, 0.25); ln = rng.uniform(12, 20)
                x += math.cos(a) * ln; y += math.sin(a) * ln; pts.append((x, y))
            dc.line(pts, fill=200, width=2)
        d.ellipse([tip[0] - 26, tip[1] - 26, tip[0] + 26, tip[1] + 26], fill=230)
        dc.ellipse([tip[0] - 6, tip[1] - 6, tip[0] + 6, tip[1] + 6], fill=255)
    R = 0.135 * S
    d.ellipse([c - R, c - R, c + R, c + R], outline=200, width=40)
    dc.ellipse([c - R, c - R, c + R, c + R], outline=255, width=6)
    a = np.asarray(m.filter(ImageFilter.GaussianBlur(14))).astype(np.float32) / 255 * 0.75
    a += np.asarray(core.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
    a = np.clip(a, 0, 1)
    im = Image.fromarray((np.dstack([np.ones_like(a)] * 3 + [a]) * 255).astype(np.uint8), 'RGBA')
    return im.resize((size, size), Image.LANCZOS)


def corner_shade(size=256):
    """Soft dark vignette centred on the corner (alpha blend) so the chains read on bright terrain."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / (size - 1) * 2 - 1
    r = np.hypot(x, y)
    a = np.clip(1 - r, 0, 1) ** 1.6
    rgb = np.dstack([np.full_like(a, 0.01), np.full_like(a, 0.05), np.full_like(a, 0.03)])
    return Image.fromarray((np.dstack([rgb, a]) * 255).astype(np.uint8), 'RGBA')


def chain_frag(size=128):
    """A single loose link for the burst (billboard sprite)."""
    lk = _link(True, 92, 54, 13)
    im = Image.fromarray((lk * 255).astype(np.uint8), 'RGBA')
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im.resize((int(size * 0.9), int(size * 0.9 * im.height / im.width)), Image.LANCZOS),
                        (int(size * 0.05), int(size / 2 - size * 0.45 * im.height / im.width)))
    return out


def textures():
    return {'sc_chain_star': chain_star(), 'sc_chain_glow': chain_glow(), 'sc_corner_shade': corner_shade(),
            'sc_chain_frag': chain_frag()}


# ------------------------------------------------------------------ emitters (camera frame)
QUAD = dict(primitive=L.Struct('VfxPrimitiveArbitraryQuad', [], L.STRUCT), rotation=(-90, -90, 0), misc=5,
            backface=True, uniform=False)


def _tugs():
    """Particle-life scale keys (life = BURST): shoot in, spike, yank tight, then tugs until the burst."""
    life = BURST
    keys = [(0.0, 0.25), (0.16, 1.16), (0.27, 0.95), (0.36, 1.02), (0.45, 1.0)]
    rng = np.random.default_rng(21)
    t = 0.45
    while t < life - 1.2:
        t += rng.uniform(1.0, 1.6)
        keys += [(t, 1.0), (t + 0.07, 0.975), (t + 0.16, 1.006), (t + 0.26, 1.0)]
    keys += [(life - 0.25, 1.0), (life - 0.05, 1.05), (life, 1.08)]
    return [k[0] / life for k in keys], [(v, v, 1.0) for _, v in keys]


def _pulse(base, hi, n=11, life=BURST):
    """Glow colour keys: flash when yanked tight, breathing pulses, flare before the burst."""
    t = [0.0, 0.16, 0.3, 0.55]; v = [base + (0.0,), WH + (0.9,), hi + (0.7,), base + (0.42,)]
    k = 0.55
    while k < life - 1.0:
        k += 1.3
        t += [min(k, life - 0.9), min(k + 0.45, life - 0.8)]; v += [hi + (0.62,), base + (0.34,)]
    t += [life - 0.4, life - 0.08, life]; v += [hi + (0.85,), WH + (1.0,), WH + (0.0,)]
    return [x / life for x in t], v


def emitters(T):
    ems = []
    corners = [(1, 1), (-1, 1), (1, -1), (-1, -1)]
    tug = _tugs()
    hold = ([0.0, 0.02, 0.985, 1.0], [WH + (0.0,), WH + (1.0,), WH + (1.0,), WH + (0.0,)])
    shade = ([0.0, 0.03, 0.97, 1.0], [WH + (0.0,), WH + (0.62,), WH + (0.62,), WH + (0.0,)])
    glow = _pulse(FLOW, HI)
    for k, (sx, sz) in enumerate(corners):
        C = (sx * HALF_W, 0.0, sz * HALF_H)
        out = np.array([sx, 0.0, sz]) / math.sqrt(2)                     # away from the screen centre
        ems.append(V.emitter(f'MVS_Shade{k}', T('sc_corner_shade'), blend=1, life=BURST + 0.2, pos=C, scale=(150, 150, 0),
                             color_curve=shade, pass_=9990, linger=0.3, **QUAD))
        ems.append(V.emitter(f'MVS_Chain{k}', T('sc_chain_star'), blend=1, life=BURST, pos=C, scale=(CHAIN_S, CHAIN_S, 0),
                             scale_curve=tug, color_curve=hold, pass_=9993, linger=0.3, **QUAD))
        ems.append(V.emitter(f'MVS_Glow{k}', T('sc_chain_glow'), blend=4, life=BURST, pos=C, scale=(CHAIN_S, CHAIN_S, 0),
                             scale_curve=tug, color_curve=glow, pass_=9994, linger=0.3, **QUAD))
        # light running along the three inward arms (texture is symmetric: these directions always lie on arms)
        for j, (a, R1) in enumerate(ARMS):
            d = np.array([-sx * math.cos(math.radians(a)), 0.0, -sz * math.sin(math.radians(a))])
            start = np.array(C) + d * R0 * CHAIN_S
            ems.append(V.emitter(f'MVS_Glint{k}_{j}', T('light_dot'), blend=4, single=False, rate=0.9 + 0.25 * j,
                                 emitter_life=BURST - 0.6, delay=0.5 + 0.2 * j + 0.1 * k, life=0.55, pos=tuple(start),
                                 velocity=tuple(d * (R1 - R0) * CHAIN_S / 0.55), scale=(5.5, 5.5, 5.5),
                                 color_curve=([0, 0.2, 0.8, 1], [HI + (0,), WH + (1,), HI + (0.9,), FLOW + (0,)]),
                                 pass_=9995, misc=5, linger=0.3))
        # tension sparks crackling at the shackle and along the arms
        ems.append(V.emitter(f'MVS_Crackle{k}', T('light_dot'), blend=4, single=False, rate=7, emitter_life=BURST - 0.5, delay=0.4,
                             life=0.32, pos=tuple(np.array(C) - out * 26), spawn_radius=34, scale=(2.6, 2.6, 2.6), drag=(2, 2, 2),
                             velocity=V.vvec3((120, 0, 120), rand=[(-1, 1), None, (-1, 1)]), direction_oriented=True, dir_scale=0.02,
                             color_curve=([0, 0.3, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9996, misc=5, linger=0.3))
        # snap: flash where the chains are yanked tight
        ems.append(V.emitter(f'MVS_Snap{k}', T('flash_star'), blend=4, delay=0.24, life=0.3, pos=tuple(np.array(C) - out * 30),
                             scale=(42, 42, 42), scale_curve=([0, 0.3, 1], [(0.4,) * 3, (1.3,) * 3, (1.5,) * 3]),
                             color_curve=([0, 0.25, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9997, misc=5))
        # ---- the burst
        ems.append(V.emitter(f'MVS_BurstFlash{k}', T('flash_star'), blend=4, delay=BURST - 0.03, life=0.4, pos=tuple(np.array(C) - out * 45),
                             scale=(62, 62, 62), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.4,) * 3, (1.8,) * 3]),
                             color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9998, misc=5, linger=0.6))
        ems.append(V.emitter(f'MVS_BurstLinks{k}', T('sc_chain_frag'), blend=1, single=False, rate=650, emitter_life=0.05, delay=BURST,
                             life=0.95, pos=tuple(np.array(C) - out * 55), spawn_radius=50,
                             scale=V.vvec3((7, 7, 7), rand=[(0.6, 1.5), None, None]),
                             velocity=V.vvec3((sx * 260, 0, sz * 200), rand=[(-0.4, 1.6), None, (-0.4, 1.6)]),
                             accel=(0, 0, -260), drag=(0.6, 0.6, 0.6),
                             rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]),
                             spin=V.vvec3((600, 0, 0), rand=[(-1, 1), None, None]),
                             color_curve=([0, 0.7, 1], [WH + (1,), WH + (1,), WH + (0,)]), pass_=9998, misc=5, linger=1.0))
        ems.append(V.emitter(f'MVS_BurstSparks{k}', T('light_dot'), blend=4, single=False, rate=900, emitter_life=0.04, delay=BURST,
                             life=0.5, pos=tuple(np.array(C) - out * 50), spawn_radius=40, scale=(2.5, 2.5, 2.5), drag=(2, 2, 2),
                             velocity=V.vvec3((sx * 300, 0, sz * 260), rand=[(-0.6, 1.6), None, (-0.6, 1.6)]),
                             direction_oriented=True, dir_scale=0.02,
                             color_curve=([0, 0.4, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9999, misc=5, linger=0.8))
    return ems


def system_struct(T):
    return L.Struct('VfxSystemDefinitionData', [
        F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, emitters(T))),
        F('particleName', L.STRING, SYSTEM.split('/')[-1]),
        F('particlePath', L.STRING, SYSTEM)], L.STRUCT)


def install(b, skin_path, resolver_path, spell_link):
    """Adds the system, its resource key and the persistent condition (R buff -> camera-bound, owner only)."""
    T = lambda n: 'assets/characters/yunara/skins/base/particles/mvfx/mvfx_' + n + '.tex'
    st = system_struct(T)
    st.fields.append(F('objectPath', L.HASH, L.fnv1a(SYSTEM)))         # like Riot's systems (objectPath = own path)
    b.entries.append(L.Entry(SYSTEM, st))
    V.add_resource(b, resolver_path, KEY, SYSTEM)
    # same field types as Riot's own (Aatrox skin 33 / Yunara skin 0): condition = pointer struct, Spell = hash,
    # PersistentVfxs = list2 of embeds
    cond = L.Struct('PersistentEffectConditionData', [
        F('OwnerCondition', L.STRUCT, L.Struct('HasBuffDynamicMaterialBoolDriver', [F('Spell', L.HASH, L.fnv1a(spell_link))], L.STRUCT)),
        F('PersistentVfxs', L.LIST2, L.List(L.EMBED, [L.Struct('PersistentVfxData', [
            F('effectKey', L.HASH, L.fnv1a(KEY)),
            F('ShowToOwnerOnly', L.BOOL, True),
            F('AttachToCamera', L.BOOL, True)], L.EMBED)], L.LIST2))], L.STRUCT)
    b.entry(skin_path).struct.field('PersistentEffectConditions').value.items.append(cond)
    return len(st.get('complexEmitterDefinitionData').items)
