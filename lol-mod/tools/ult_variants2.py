"""Second round of ult proposals (Blue-Lock-inspired, own designs). Each starts after the chain burst of
step_ult_cast (0.30 s) and replaces the eye / hologram stadium.  ULT_VARIANT=<name> python3 build_mod.py ...

  beast  - Ego-Bestie: a colossal shadow beast (Meshy) rises behind him, its chains burst, it roars and dives into him
  echoes - Zukunfts-Echos: four hologram copies of him (his real model, frozen in action poses) fan out as possible
           futures; three drift off and dissolve, the true one is pulled back into him
  popup  - Aufklapp-Spielfeld: a glowing mini pitch unfolds like a pop-up book (pieces, goal), folds flat again and
           fires a light path towards the goal
  stage  - Weltbuehne No.1: a spotlight from the sky, camera flashes all around, a No.1 ranking pillar rises behind him
           with ranking panels circling, then shatters into confetti

Nothing turns with the champion: every piece that is laid out around him lives inside a mesh with world orientation
(isLocalOrientation = 0, bindWeight 0), so the layout is fixed in the world from the cast on; free particles only
use height offsets. League world: +z = away from the camera (behind him on screen), meshes face -z (the camera).
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import lolbin as L
import vfxlib as V
from stadium_fx import holo, fade, quad, cone, combine, load_vfx_mesh

F = L.Field
FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); WH = (1.0, 1.0, 1.0)
VIO = (0.55, 0.30, 0.95); SHADOW = (0.05, 0.02, 0.08)
VARIANTS = ('beast', 'echoes', 'popup', 'stage')
START = 0.34
WORLD = dict(bind=0.0, local_orientation=False)            # fixed in the world from the cast on
STRIKER_TEX = 'assets/characters/yunara/skins/base/mvfx_striker_tx_cm.tex'
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')

# layout (world units, +z behind him)
BEAST_Z = 110.0                         # the beast stands this far behind him
BEAST_PIVOT = 110.0                     # mesh origin at his chest height: shrinking pulls the beast into him
EYES = [(-16.0, 382.0, -78.0), (16.0, 382.0, -78.0)]  # beast eyes in its own mesh space
ECHO_AT = {3: -70.0, 1: -25.0, 0: 25.0, 2: 70.0}       # echo index -> angle from "behind" (deg), radius ECHO_R
ECHO_R = 235.0
TRUE_ECHO = 0
PIECES = [(-170.0, 150.0), (-60.0, 250.0), (70.0, 200.0), (175.0, 110.0), (-120.0, -40.0)]
GOAL_Z = 330.0
PILLAR_Z = 175.0


# ------------------------------------------------------------------ textures
def _rgba(i, rgb=(1, 1, 1)):
    i = np.clip(i, 0, 1)
    return Image.fromarray((np.dstack([np.full_like(i, rgb[0]), np.full_like(i, rgb[1]), np.full_like(i, rgb[2]), i]) * 255).astype(np.uint8), 'RGBA')


def _noise(s, sigma, seed):
    from scipy.ndimage import gaussian_filter
    n = gaussian_filter(np.random.default_rng(seed).random((s, s)), sigma, mode='wrap')
    return (n - n.min()) / (np.ptp(n) + 1e-9)


def beast_skin(s=512):
    """Smoky shadow for the beast (u across, v = height, row 0 = feet): near-black violet with drifting smoke,
    the feet dissolve into wisps."""
    v = np.linspace(0, 1, s)[:, None] * np.ones((1, s))
    n = 0.6 * _noise(s, 10, 1) + 0.4 * _noise(s, 3, 2)
    rgb = np.dstack([0.07 + 0.10 * n, 0.03 + 0.05 * n, 0.12 + 0.16 * n])
    a = np.clip(0.92 * np.clip((v - 0.05) / 0.22 + (n - 0.5) * 0.5, 0, 1), 0, 0.92)
    return Image.fromarray((np.dstack([rgb, a]) * 255).astype(np.uint8), 'RGBA')


def beast_erode(s=256):
    """Erosion map: high at the feet (row 0), low at the head -> with a falling drive it builds up from below."""
    v = np.linspace(0, 1, s)[:, None] * np.ones((1, s))
    e = np.clip(1.0 - v * 0.92 + (_noise(s, 4, 5) - 0.5) * 0.10, 0, 1)
    return Image.fromarray((np.dstack([e, e, e, np.ones_like(e)]) * 255).astype(np.uint8), 'RGBA')


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
    rgb = np.dstack([SHADOW[0] + rim * FLOW[0], SHADOW[1] + rim * FLOW[1], SHADOW[2] + rim * FLOW[2]])
    alpha = np.maximum(alpha, rim * 0.8)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')


def smoke_puff(s=128):
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y)
    a = np.clip(1 - r, 0, 1) ** 1.5 * (0.6 + 0.4 * _noise(s, 5, 11))
    rgb = np.dstack([np.full_like(a, 0.12), np.full_like(a, 0.06), np.full_like(a, 0.18)])
    return Image.fromarray((np.dstack([rgb, a]) * 255).astype(np.uint8), 'RGBA')


def beast_colour(root, s=1024):
    """Epic green-violet skin for the animated beast from Meshy's base colour: obsidian to violet by brightness,
    Meshy's own green (eyes, horn tips) boosted, plus glowing green veins (iso-lines of a smooth noise)."""
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


def eye_glow(s=128):
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x * 0.8, y * 1.6)
    return _rgba(np.exp(-(r / 0.18) ** 2) * 1.2 + np.exp(-(r / 0.5) ** 2) * 0.5)


def pitch_lines(w=1024, h=1024):
    """Top view of the pop-up pitch (u = x, v = z with row 0 at the far end): glowing lines, goal box at the top."""
    S = 2
    im = Image.new('L', (w * S, h * S), 0); d = ImageDraw.Draw(im)
    lw = 7 * S; m = 24 * S
    W, H = w * S, h * S
    d.rectangle([m, m, W - m, H - m], outline=255, width=lw)
    hy = int(H * 0.66)                                             # halfway line: through his position
    d.line([(m, hy), (W - m, hy)], fill=255, width=lw)
    R = int(W * 0.13); cx = W // 2
    d.ellipse([cx - R, hy - R, cx + R, hy + R], outline=255, width=lw)
    d.ellipse([cx - 9 * S, hy - 9 * S, cx + 9 * S, hy + 9 * S], fill=255)
    bw, bh = int(W * 0.46), int(H * 0.17)
    d.rectangle([cx - bw // 2, m, cx + bw // 2, m + bh], outline=255, width=lw)
    sw, sh = int(W * 0.22), int(H * 0.07)
    d.rectangle([cx - sw // 2, m, cx + sw // 2, m + sh], outline=255, width=lw)
    d.arc([cx - R // 2, m + bh - R // 2, cx + R // 2, m + bh + R // 2], 0, 180, fill=255, width=lw)
    a = np.asarray(im.resize((w, h), Image.LANCZOS)).astype(float) / 255
    glow = np.asarray(im.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(8))).astype(float) / 255
    grid = ((np.mod(np.arange(w), 64) < 2)[None, :] | (np.mod(np.arange(h), 64) < 2)[:, None]) * 0.10
    return _rgba(np.clip(a * 1.1 + glow * 0.8 + grid + 0.06, 0, 1))


def piece_card(s=256):
    """A pop-up figure: a chess-pawn-like piece silhouette with a glowing outline (vertical card)."""
    S = 4
    im = Image.new('L', (s * S, s * S), 0); d = ImageDraw.Draw(im)
    c = s * S / 2; u = s * S / 256
    d.ellipse([c - 34 * u, 28 * u, c + 34 * u, 96 * u], fill=255)                       # head
    d.polygon([(c - 26 * u, 92 * u), (c + 26 * u, 92 * u), (c + 52 * u, 200 * u), (c - 52 * u, 200 * u)], fill=255)
    d.rounded_rectangle([c - 78 * u, 196 * u, c + 78 * u, 238 * u], radius=int(14 * u), fill=255)   # base
    d.rounded_rectangle([c - 50 * u, 98 * u, c + 50 * u, 116 * u], radius=int(8 * u), fill=255)     # collar
    m = np.asarray(im.resize((s, s), Image.LANCZOS)).astype(float) / 255
    from scipy.ndimage import binary_erosion
    inner = binary_erosion(m > 0.5, iterations=5)
    rim = (m > 0.4) & ~inner
    i = rim * 1.0 + inner * 0.22 + np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) / 255 * 0.3
    return _rgba(i)


def goal_card(w=512, h=256):
    """Front view of a goal for the pop-up (posts, bar, net lines)."""
    im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im)
    d.rectangle([20, 16, w - 21, h - 1], outline=255, width=12)
    for x in range(40, w - 20, 26):
        d.line([(x, 28), (x, h - 1)], fill=110, width=3)
    for y in range(40, h, 26):
        d.line([(28, y), (w - 28, y)], fill=110, width=3)
    a = np.asarray(im).astype(float) / 255
    g = np.asarray(im.filter(ImageFilter.GaussianBlur(6))).astype(float) / 255
    return _rgba(np.clip(a + g * 0.6, 0, 1))


def _font(n):
    try:
        return ImageFont.truetype(FONT, n)
    except OSError:
        return ImageFont.load_default()


def rank_pillar(w=256, h=1024):
    """Front of the ranking pillar: a big 'No.1', a star, rising bars and a scan grid (additive)."""
    im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im)
    d.rectangle([6, 6, w - 7, h - 7], outline=255, width=6)
    f = _font(150)
    tw = d.textlength('No.1', font=f)
    d.text(((w - tw) / 2, 70), 'No.1', font=f, fill=255)
    cx, cy, R = w / 2, 330, 44
    pts = [(cx + R * (1 if k % 2 == 0 else 0.45) * math.sin(k * math.pi / 5), cy - R * (1 if k % 2 == 0 else 0.45) * math.cos(k * math.pi / 5)) for k in range(10)]
    d.polygon(pts, fill=255)
    for k in range(7):
        y = 430 + k * 78; ln = int((w - 60) * (0.95 - k * 0.11))
        d.rectangle([30, y, 30 + ln, y + 34], fill=200 if k == 0 else 120)
    for y in range(0, h, 16):
        d.line([(6, y), (w - 7, y)], fill=40, width=1)
    a = np.asarray(im).astype(float) / 255
    g = np.asarray(im.filter(ImageFilter.GaussianBlur(5))).astype(float) / 255
    return _rgba(np.clip(a + g * 0.5, 0, 1))


def rank_panel(w=256, h=384):
    im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im)
    d.rectangle([4, 4, w - 5, h - 5], outline=230, width=4)
    f = _font(44)
    for k in range(5):
        y = 24 + k * 70
        d.text((16, y), f'{k + 2}', font=f, fill=255)
        d.rectangle([62, y + 14, 62 + int((w - 90) * (0.9 - k * 0.13)), y + 38], fill=150)
    a = np.asarray(im).astype(float) / 255
    g = np.asarray(im.filter(ImageFilter.GaussianBlur(4))).astype(float) / 255
    return _rgba(np.clip(a * 0.9 + g * 0.5, 0, 1))


def spot_pool(s=256):
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y)
    return _rgba(np.clip((1 - r) / 0.25, 0, 1) * 0.55 + np.exp(-((r - 0.88) / 0.05) ** 2) * 0.8)


def confetti(s=64):
    im = Image.new('L', (s, s), 0); ImageDraw.Draw(im).rectangle([s * 0.2, s * 0.35, s * 0.8, s * 0.65], fill=255)
    return _rgba(np.asarray(im).astype(float) / 255)


def textures(root, variant):
    tx = {}
    if variant == 'beast':
        skin, glow = beast_colour(root)
        tx.update(beast_skin2=skin, beast_glow=glow, shadow_pool=shadow_pool(), smoke_puff=smoke_puff())
    elif variant == 'echoes':
        import ult_variants as UV
        tx.update(tactic_arrow=UV.tactic_arrow(), along_erode=UV.along_erode())
    elif variant == 'popup':
        import ult_variants as UV
        tx.update(popup_pitch=pitch_lines(), piece_card=piece_card(), goal_card=goal_card(), along_erode=UV.along_erode(),
                  radial_erode=UV.radial_erode())
    elif variant == 'stage':
        tx.update(rank_pillar=rank_pillar(), rank_panel=rank_panel(), spot_pool=spot_pool(), confetti=confetti())
    return tx


# ------------------------------------------------------------------ meshes (League world, see module doc)
def _card(cx, cz, w, h, y0=0.0, facing_deg=0.0, uv=((0, 1), (1, 1), (1, 0), (0, 0))):
    """Vertical card standing on the ground, facing the camera (-z) turned by facing_deg about y."""
    a = math.radians(facing_deg); ux, uz = math.cos(a), math.sin(a)
    p0 = (cx - ux * w / 2, y0, cz - uz * w / 2); p1 = (cx + ux * w / 2, y0, cz + uz * w / 2)
    p2 = (p1[0], y0 + h, p1[2]); p3 = (p0[0], y0 + h, p0[2])
    return quad(p0, p1, p2, p3, uv)


def _flat(x0, x1, z0, z1, y=3.0):
    """Flat quad on the ground; uv row 0 at the far end (+z)."""
    return quad((x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1), ((0, 1), (1, 1), (1, 0), (0, 0)))


def _strip(p0, p1, width, y=4.0, seg=16):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0; n = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
    P, U, T = [], [], []
    for k in range(seg + 1):
        t = k / seg; c = p0 + d * t
        for j, s in enumerate((-1, 1)):
            q = c + n * s * width / 2
            P.append((q[0], y, q[1])); U.append((t, j))
    for k in range(seg):
        i = 2 * k
        T += [(i, i + 2, i + 3), (i, i + 3, i + 1)]
    return np.array(P, float), np.array(U, float), np.array(T)


BEAST_BASE = 'assets/characters/yunara/skins/base/particles/mvfx/mvfx_v2_beast'


def anim_files(root, variant):
    """Animated meshes of a variant: {game path: bytes} (.skn/.skl/.anm) and the clip length."""
    if variant != 'beast':
        return {}, 0.0
    import beast_anim as BA
    b = BA.Beast(os.path.join(root, 'assets_src', 'vfx', 'beast_rig.npz'))
    frames, total = BA.compose(b)
    return BA.files(b, frames, BEAST_BASE), total


def echo_pos(k):
    a = math.radians(ECHO_AT[k])
    return np.array([ECHO_R * math.sin(a), 0.0, ECHO_R * math.cos(a)])


def meshes(root, variant):
    out = {}
    if variant == 'echoes':
        for k in range(4):
            P, U, T = load_vfx_mesh(root, f'echo_{k}')
            out[f'mvfx_v2_echo_{k}.scb'] = (P + echo_pos(k), U, T)
        paths, rings = [], []
        for k in range(4):
            e = echo_pos(k)
            paths.append(_strip((0, 0), (e[0] * 0.86, e[2] * 0.86), 30.0))
            rings.append(_flat(e[0] - 70, e[0] + 70, e[2] - 70, e[2] + 70, y=5.0))
        out['mvfx_v2_echo_paths.scb'] = combine(paths)
        out['mvfx_v2_echo_rings.scb'] = combine(rings)
    elif variant == 'popup':
        out['mvfx_v2_pitch.scb'] = _flat(-270, 270, -180, 360, y=3.0)
        for k, (x, z) in enumerate(PIECES):
            out[f'mvfx_v2_piece_{k}.scb'] = _card(x, z, 90, 90)
        out['mvfx_v2_goal.scb'] = _card(0, GOAL_Z, 250, 125)
        out['mvfx_v2_path.scb'] = _strip((0, 0), (0, GOAL_Z - 10), 46.0, y=6.0)
    elif variant == 'stage':
        out['mvfx_v2_cone.scb'] = cone((0, 1000, 0), (0, 0, 0), 30.0, 125.0, seg=28)
        h, H = 39.0, 460.0                       # four sides, each showing the whole texture upright
        sides = []
        for (ax, az), (bx, bz) in (((-h, -h), (h, -h)), ((h, -h), (h, h)), ((h, h), (-h, h)), ((-h, h), (-h, -h))):
            sides.append(quad((ax, 0, az + PILLAR_Z), (bx, 0, bz + PILLAR_Z), (bx, H, bz + PILLAR_Z), (ax, H, az + PILLAR_Z),
                              ((0, 1), (1, 1), (1, 0), (0, 0))))
        sides.append(quad((-h, H, -h + PILLAR_Z), (h, H, -h + PILLAR_Z), (h, H, h + PILLAR_Z), (-h, H, h + PILLAR_Z),
                          ((0, 0.02), (1, 0.02), (1, 0), (0, 0))))
        out['mvfx_v2_pillar.scb'] = combine(sides)
        panels = []
        for k in range(6):
            a = math.radians(30 + k * 60)
            cx, cz = 285 * math.sin(a), 285 * math.cos(a)
            panels.append(_card(cx, cz, 92, 138, y0=90.0, facing_deg=-math.degrees(a) + 0))
        out['mvfx_v2_panels.scb'] = combine(panels)
    return out


# ------------------------------------------------------------------ emitters
def em_beast(T, M):
    ems = []
    t0 = START
    ems.append(V.emitter('MVB_Pool', T('shadow_pool'), blend=1, delay=t0, life=2.45, ground=True, pos=(0, 0, 150), rotation=(-90, -90, 0),
                         scale=(240, 240, 1), scale_curve=([0, 0.1, 0.2, 1], [(0.2,) * 3, (1.08,) * 3, (1.0,) * 3, (1.02,) * 3]),
                         color_curve=fade(WH, 0.04, 0.85, 1.0), pass_=-2700, **WORLD))
    ems.append(V.emitter('MVB_PoolRing', T('shock_ring'), blend=4, delay=t0, life=0.55, ground=True, pos=(0, 0, 150), rotation=(-90, -90, 0),
                         scale=(60, 60, 1), scale_curve=([0, 1], [(1,) * 3, (5.5,) * 3]),
                         color_curve=([0, 0.1, 1], [VIO + (0,), FLOW + (1,), DEEP + (0,)]), pass_=-2690, **WORLD))
    ems.append(V.emitter('MVB_Smoke', T('smoke_puff'), blend=1, single=False, rate=70, emitter_life=1.6, delay=t0 + 0.02, life=1.1,
                         pos=(0, 20, 150), spawn_radius=200, scale=V.vvec3((40, 40, 40), rand=[(0.6, 1.6), None, None]),
                         scale_curve=([0, 1], [(0.6,) * 3, (1.6,) * 3]), velocity=V.vvec3((0, 160, 0), rand=[None, (0.5, 1.5), None]),
                         rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((40, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=fade(WH, 0.15, 0.6, 0.7), pass_=9300, **WORLD))
    import beast_anim as BA
    segs, total = BA.timeline()
    RISE = t0 + 0.05                                                  # the animated beast is born here
    sc0 = segs[1]
    ROAR = RISE + sc0[0] + (1.2 - sc0[3]) / sc0[4]                     # the crouched roar inside the scream clip
    DIVE = RISE + total - BA.DIVE; END = RISE + total
    life = total
    nt = lambda t: (t - RISE) / life
    anim_mesh = L.Struct('VfxPrimitiveMesh', [F('mMesh', L.EMBED, L.Struct('VfxMeshDefinitionData', [
        F('mMeshName', L.STRING, BEAST_BASE + '.skn'), F('mMeshSkeletonName', L.STRING, BEAST_BASE + '.skl'),
        F('mAnimationName', L.STRING, BEAST_BASE + '.anm')], L.EMBED))], L.STRUCT)
    drive = ([0, nt(RISE + 0.40), nt(END - 0.12), 1], [1.0, 0.0, 0.0, 0.6])        # builds up from the pool, frays at the end
    ems.append(V.emitter('MVB_Beast', T('beast_skin2'), blend=1, delay=RISE, life=life, primitive=anim_mesh, scale=(1, 1, 1), backface=True, pass_=9310,
                         color_curve=([0, 0.04, nt(DIVE), nt(END - 0.04), 1], [WH + (0,), WH + (1,), WH + (1,), (0.8, 0.6, 1.0, 0.9), VIO + (0,)]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.30, 0.10, 0.55)), **WORLD))
    # emissive layer: veins, eyes and horn tips glow green, flare white-green on the roar, violet on the dive
    ems.append(V.emitter('MVB_BeastGlow', T('beast_glow'), blend=4, delay=RISE, life=life, primitive=anim_mesh, scale=(1.01, 1.01, 1.01), backface=True, pass_=9311,
                         color_curve=([0, nt(RISE + 0.3), nt(ROAR - 0.05), nt(ROAR + 0.05), nt(ROAR + 0.35), nt(DIVE), nt(END), 1],
                                      [FLOW + (0,), HI + (0.55,), HI + (0.55,), WH + (0.95,), HI + (0.65,), VIO + (0.9,), WH + (1,), WH + (0,)]),
                         extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.06, 0.40, 0.18)), **WORLD))
    # roar: shock rings at head height and on the ground, chains on its wrists burst
    for j in range(3):
        ems.append(V.emitter(f'MVB_Roar{j}', T('shock_ring'), blend=4, delay=ROAR + 0.08 * j, life=0.45, bind=0.0, pos=(0, 300, 150),
                             scale=(50, 50, 1), scale_curve=([0, 1], [(1,) * 3, (7.0,) * 3]),
                             color_curve=([0, 0.15, 1], [(HI if j % 2 else VIO) + (0,), (FLOW if j % 2 else VIO) + (0.9,), DEEP + (0,)]),
                             pass_=9320 + j))
    ems.append(V.emitter('MVB_RoarGround', T('shock_ring'), blend=4, delay=ROAR, life=0.6, ground=True, rotation=(-90, -90, 0),
                         scale=(80, 80, 1), scale_curve=([0, 1], [(1,) * 3, (6.5,) * 3]),
                         color_curve=([0, 0.1, 1], [VIO + (0,), VIO + (1,), DEEP + (0,)]), pass_=-2680, pos=(0, 0, 150), **WORLD))
    ems.append(V.emitter('MVB_ChainBurst', T('chain_metal'), blend=1, single=False, rate=500, emitter_life=0.06, delay=ROAR + 0.12,
                         life=1.0, bind=0.0, pos=(0, 260, 150), spawn_radius=150, mesh=T('chain_link').replace('.tex', '.scb'),
                         backface=True, scale=V.vvec3((1.4, 1.4, 1.4), rand=[(0.7, 1.3), None, None]),
                         velocity=V.vvec3((700, 600, 700), rand=[(-1, 1), (0.1, 1.0), (-1, 1)]), accel=(0, -1500, 0),
                         rotation=V.vvec3((180, 180, 180), rand=[(-1, 1)] * 3), spin=V.vvec3((800, 600, 0), rand=[(-1, 1), (-1, 1), None]),
                         color_curve=([0, 0.1, 0.7, 1], [HI + (1,), WH + (1,), WH + (1,), FLOW + (0,)]), pass_=9330))
    ems.append(V.emitter('MVB_ChainFlash', T('flash_star'), blend=4, delay=ROAR + 0.1, life=0.3, bind=0.0, pos=(0, 260, 150),
                         scale=(140, 140, 1), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.8,), FLOW + (0,)]), pass_=9331))
    # dive: an implosion ring and a flare on him, then dark wisps rise from him
    ems.append(V.emitter('MVB_Implode', T('shock_ring'), blend=4, delay=DIVE, life=0.32, pos=(0, 110, 0), scale=(60, 60, 1),
                         scale_curve=([0, 1], [(6.0,) * 3, (0.4,) * 3]), color_curve=([0, 0.3, 1], [VIO + (0,), VIO + (1,), HI + (1,)]),
                         pass_=9340))
    ems.append(V.emitter('MVB_Impact', T('flash_star'), blend=4, delay=END - 0.04, life=0.4, pos=(0, 110, 0), scale=(130, 130, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.4,) * 3, (1.7,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), VIO + (0.9,), FLOW + (0,)]), pass_=9341))
    ems.append(V.emitter('MVB_ImpactRing', T('shock_ring'), blend=4, delay=END, life=0.5, ground=True, rotation=(-90, -90, 0),
                         scale=(50, 50, 1), scale_curve=([0, 1], [(1,) * 3, (6.0,) * 3]),
                         color_curve=([0, 0.1, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=-2670, **WORLD))
    ems.append(V.emitter('MVB_Wisps', T('smoke_puff'), blend=1, single=False, rate=22, emitter_life=1.0, delay=END, life=0.9,
                         pos=(0, 60, 0), spawn_radius=40, scale=V.vvec3((18, 18, 18), rand=[(0.7, 1.4), None, None]),
                         scale_curve=([0, 1], [(0.6,) * 3, (1.5,) * 3]), velocity=V.vvec3((0, 140, 0), rand=[None, (0.6, 1.4), None]),
                         color_curve=fade(WH, 0.15, 0.6, 0.65), pass_=9342))
    return ems


def em_echoes(T, M):
    ems = []
    t0 = START
    along = holo(T('along_erode'), [0, 0.35, 1.0], [1, 0, 0])[0].value
    ems.append(V.emitter('MVE_Paths', T('tactic_arrow'), blend=4, delay=t0, life=1.55, mesh=M('v2_echo_paths'), scale=(1, 1, 1),
                         backface=True, color_curve=fade(HI, 0.02, 0.8, 0.9), pass_=-2700,
                         extra=[F('alphaErosionDefinition', L.STRUCT, along)], **WORLD))
    ems.append(V.emitter('MVE_Split', T('flash_star'), blend=4, delay=t0, life=0.3, pos=(0, 110, 0), scale=(110, 110, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.5,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9400))
    APPEAR = t0 + 0.1; HOLD = APPEAR + 0.4; CUT = t0 + 1.05; PULL = CUT + 0.22; END = PULL + 0.24
    for k in range(4):
        true = k == TRUE_ECHO
        life = (END if true else CUT + 0.4) - (APPEAR + 0.04 * k)
        b = APPEAR + 0.04 * k
        nt = lambda t: (t - b) / life
        if true:
            sc = ([0, nt(PULL), 1], [(1,) * 3, (1.0,) * 3, (0.03,) * 3])
            drive = ([0, nt(HOLD), 1], [1.0, 0.0, 0.0])
            col = ([0, nt(HOLD), nt(CUT), nt(PULL), 1], [HI + (0,), (0.75, 1, 0.82, 0.75), (0.75, 1, 0.82, 0.75), WH + (1,), WH + (0.6,)])
            glow = ([0, nt(HOLD), nt(CUT), nt(PULL), 1], [FLOW + (0,), FLOW + (0.45,), FLOW + (0.45,), WH + (1,), WH + (1,)])
        else:
            sc = ([0, nt(CUT), 1], [(1,) * 3, (1.0,) * 3, (1.18,) * 3])
            drive = ([0, nt(HOLD), nt(CUT), 1], [1.0, 0.0, 0.0, 1.0])
            col = ([0, nt(HOLD), nt(CUT), nt(CUT + 0.08), 1], [HI + (0,), (0.75, 1, 0.82, 0.6), (0.75, 1, 0.82, 0.6), WH + (0.9,), VIO + (0,)])
            glow = ([0, nt(HOLD), nt(CUT), nt(CUT + 0.1), 1], [FLOW + (0,), FLOW + (0.35,), FLOW + (0.35,), WH + (1,), VIO + (0,)])
        ems.append(V.emitter(f'MVE_Echo{k}', STRIKER_TEX, blend=1, delay=b, life=life, mesh=M(f'v2_echo_{k}'), scale=(1, 1, 1),
                             scale_curve=sc, backface=True, color_curve=col, pass_=9410 + k,
                             extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.5, 1.0, 0.7)), **WORLD))
        ems.append(V.emitter(f'MVE_EchoGlow{k}', T('holo_body'), blend=4, delay=b, life=life, mesh=M(f'v2_echo_{k}'),
                             scale=(1.01, 1.01, 1.01), scale_curve=sc, backface=True, color_curve=glow, pass_=9420 + k,
                             extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.45, 1.0, 0.62)), **WORLD))
    ems.append(V.emitter('MVE_Rings', T('scan_ring'), blend=4, delay=APPEAR, life=CUT + 0.3 - APPEAR, mesh=M('v2_echo_rings'), scale=(1, 1, 1),
                         spin=(0, 0, 0), backface=True, color_curve=fade(HI, 0.1, 0.75, 0.8), pass_=-2690, **WORLD))
    ems.append(V.emitter('MVE_Merge', T('flash_star'), blend=4, delay=END - 0.03, life=0.4, pos=(0, 110, 0), scale=(150, 150, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.4,) * 3, (1.8,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9440))
    ems.append(V.emitter('MVE_MergeRing', T('shock_ring'), blend=4, delay=END, life=0.5, ground=True, rotation=(-90, -90, 0),
                         scale=(50, 50, 1), scale_curve=([0, 1], [(1,) * 3, (6.5,) * 3]),
                         color_curve=([0, 0.1, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=-2680, **WORLD))
    ems.append(V.emitter('MVE_Lines', T('light_dot'), blend=4, single=False, rate=1000, emitter_life=0.05, delay=END, life=0.6,
                         bind=0.0, pos=(0, 120, 0), spawn_radius=60, scale=(6, 6, 6), drag=(1.5, 1.5, 1.5),
                         velocity=V.vvec3((650, 900, 650), rand=[(-1, 1), (-0.3, 1.0), (-1, 1)]), direction_oriented=True, dir_scale=0.006,
                         color_curve=([0, 0.5, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9441))
    return ems


def em_popup(T, M):
    ems = []
    t0 = START
    OPEN = t0 + 0.05; FOLD = t0 + 1.55; END = FOLD + 0.22
    life = END - OPEN
    nt = lambda t: (t - OPEN) / life
    ems.append(V.emitter('MVP_Pitch', T('popup_pitch'), uniform=False, blend=4, delay=OPEN, life=life + 0.2, mesh=M('v2_pitch'), scale=(1, 1, 1),
                         backface=True, pass_=-2700,
                         scale_curve=([0, nt(OPEN + 0.18), nt(OPEN + 0.26), nt(FOLD), nt(END), 1],
                                      [(0.05, 1, 0.05), (1.05, 1, 1.05), (1, 1, 1), (1, 1, 1), (0.04, 1, 1.0), (0.0, 1, 1.0)]),
                         color_curve=([0, 0.05, nt(FOLD), 1], [HI + (0,), HI + (0.95,), HI + (0.95,), WH + (0,)]), **WORLD))
    ems.append(V.emitter('MVP_OpenRing', T('shock_ring'), blend=4, delay=OPEN, life=0.45, ground=True, rotation=(-90, -90, 0),
                         scale=(60, 60, 1), scale_curve=([0, 1], [(1,) * 3, (6.0,) * 3]),
                         color_curve=([0, 0.1, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=-2690, **WORLD))
    cards = [(f'v2_piece_{k}', 'piece_card', 0.20 + 0.06 * k) for k in range(len(PIECES))] + [('v2_goal', 'goal_card', 0.55)]
    for k, (mesh, tex, dt) in enumerate(cards):
        b = OPEN + dt; lf = FOLD + 0.12 - b
        n2 = lambda t: (t - b) / lf
        pop = ([0, n2(b + 0.10), n2(b + 0.16), n2(b + 0.22), n2(FOLD), 1],
               [(1, 0.02, 1), (1, 1.18, 1), (1, 0.94, 1), (1, 1, 1), (1, 1, 1), (1, 0.02, 1)])
        ems.append(V.emitter(f'MVP_Card{k}', T(tex), uniform=False, blend=4, delay=b, life=lf, mesh=M(mesh), scale=(1, 1, 1), scale_curve=pop,
                             backface=True, pass_=9450 + k,
                             color_curve=([0, 0.06, n2(FOLD) - 0.05, 1], [WH + (0,), HI + (1,), HI + (1,), WH + (0.5,)]), **WORLD))
    ems.append(V.emitter('MVP_GoalFlash', T('flash_star'), blend=4, delay=OPEN + 0.6, life=0.3, bind=0.0, pos=(0, 60, 0), scale=(40, 40, 1),
                         color_curve=([0, 0.2, 1], [WH + (0.9,), HI + (0.6,), FLOW + (0,)]), pass_=9460))
    along = holo(T('along_erode'), [0, 0.3, 1.0], [1, 0, 0])[0].value
    ems.append(V.emitter('MVP_Path', T('light_beam'), blend=4, delay=FOLD + 0.1, life=0.7, mesh=M('v2_path'), scale=(1, 1, 1), backface=True,
                         pass_=-2680, color_curve=([0, 0.1, 0.6, 1], [WH + (1,), HI + (1,), FLOW + (0.8,), DEEP + (0,)]),
                         extra=[F('alphaErosionDefinition', L.STRUCT, along)], **WORLD))
    ems.append(V.emitter('MVP_Fold', T('flash_star'), blend=4, delay=FOLD + 0.08, life=0.35, pos=(0, 40, 0), scale=(120, 120, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9470))
    ems.append(V.emitter('MVP_Sparks', T('light_dot'), blend=4, single=False, rate=800, emitter_life=0.05, delay=FOLD + 0.1, life=0.55,
                         bind=0.0, pos=(0, 20, 0), spawn_radius=200, scale=(5, 5, 5), drag=(1.5, 1.5, 1.5),
                         velocity=V.vvec3((0, 800, 0), rand=[None, (0.4, 1.2), None]), direction_oriented=True, dir_scale=0.006,
                         color_curve=([0, 0.5, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9471))
    return ems


def em_stage(T, M):
    ems = []
    t0 = START
    ON = t0 + 0.02; OFF = t0 + 1.95
    ems.append(V.emitter('MVS2_Cone', T('light_beam'), uniform=False, blend=4, delay=ON, life=OFF - ON, mesh=M('v2_cone'), scale=(1, 1, 1), backface=True,
                         pass_=9500, scale_curve=([0, 0.06, 1], [(0.3, 1, 0.3), (1, 1, 1), (1, 1, 1)]),
                         color_curve=([0, 0.04, 0.85, 1], [WH + (0,), (0.85, 1, 0.9, 0.6), (0.85, 1, 0.9, 0.6), WH + (0,)]), **WORLD))
    ems.append(V.emitter('MVS2_Spot', T('spot_pool'), blend=4, delay=ON, life=OFF - ON, ground=True, rotation=(-90, -90, 0), scale=(125, 125, 1),
                         color_curve=fade((0.85, 1, 0.9), 0.05, 0.85, 0.9), pass_=-2700, **WORLD))
    ems.append(V.emitter('MVS2_Flashes', T('flash_star'), blend=4, single=False, rate=34, emitter_life=OFF - ON - 0.3, delay=ON + 0.1, life=0.12,
                         bind=0.0, pos=(0, 110, 0), spawn_radius=520, scale=V.vvec3((22, 22, 22), rand=[(0.6, 1.4), None, None]),
                         rotation=V.vvec3((45, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=([0, 0.2, 1], [WH + (1,), WH + (0.8,), WH + (0,)]), pass_=9501))
    ems.append(V.emitter('MVS2_FlashGlow', T('light_dot'), blend=4, single=False, rate=34, emitter_life=OFF - ON - 0.3, delay=ON + 0.1, life=0.16,
                         bind=0.0, pos=(0, 110, 0), spawn_radius=520, scale=(40, 40, 40),
                         color_curve=([0, 0.2, 1], [WH + (0.8,), HI + (0.4,), HI + (0,)]), pass_=9502))
    RISE = ON + 0.15; BREAK = ON + 1.45
    life = BREAK + 0.25 - RISE
    nt = lambda t: (t - RISE) / life
    ems.append(V.emitter('MVS2_Pillar', T('rank_pillar'), uniform=False, blend=4, delay=RISE, life=life, mesh=M('v2_pillar'), scale=(1, 1, 1), backface=True,
                         pass_=9510, scale_curve=([0, nt(RISE + 0.22), nt(RISE + 0.3), nt(BREAK), 1],
                                                 [(1, 0.02, 1), (1, 1.08, 1), (1, 1.0, 1), (1, 1, 1), (1.3, 1.05, 1.3)]),
                         color_curve=([0, 0.06, nt(BREAK), nt(BREAK + 0.06), 1], [HI + (0,), HI + (1,), HI + (1,), WH + (1,), WH + (0,)]),
                         extra=holo(T('holo_erode'), [0, nt(BREAK), 1], [0.0, 0.0, 1.0], rim=(0.5, 1.0, 0.7)), **WORLD))
    ems.append(V.emitter('MVS2_Panels', T('rank_panel'), blend=4, delay=RISE + 0.2, life=BREAK - RISE - 0.1, mesh=M('v2_panels'), scale=(1, 1, 1),
                         spin=(0, 55, 0), backface=True, pass_=9511,
                         scale_curve=([0, 0.12, 1], [(0.4, 0.4, 0.4), (1, 1, 1), (1, 1, 1)]),
                         color_curve=fade((0.75, 1, 0.82), 0.1, 0.85, 0.9), **WORLD))
    ems.append(V.emitter('MVS2_Break', T('flash_star'), blend=4, delay=BREAK, life=0.35, bind=0.0, pos=(0, 300, 0), scale=(150, 150, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.4,) * 3, (1.7,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9520))
    ems.append(V.emitter('MVS2_Shards', T('holo_shard'), blend=4, single=False, rate=1200, emitter_life=0.05, delay=BREAK, life=0.9, bind=0.0,
                         pos=(0, 280, 0), spawn_radius=150, scale=V.vvec3((12, 12, 12), rand=[(0.5, 1.5), None, None]),
                         velocity=V.vvec3((500, 400, 500), rand=[(-1, 1), (-0.2, 1), (-1, 1)]), accel=(0, -900, 0), drag=(0.8, 0.8, 0.8),
                         spin=V.vvec3((500, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9521))
    for j, c in enumerate((WH, HI, VIO, FLOW)):
        ems.append(V.emitter(f'MVS2_Confetti{j}', T('confetti'), blend=1, single=False, rate=500, emitter_life=0.05, delay=BREAK + 0.05,
                             life=1.3, bind=0.0, pos=(0, 380, 0), spawn_radius=200, scale=V.vvec3((7, 7, 7), rand=[(0.6, 1.3), None, None]),
                             velocity=V.vvec3((260, 260, 260), rand=[(-1, 1), (0.2, 1), (-1, 1)]), accel=(0, -420, 0), drag=(1.2, 1.2, 1.2),
                             rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((540, 0, 0), rand=[(-1, 1), None, None]),
                             color_curve=([0, 0.75, 1], [c + (1,), c + (1,), c + (0,)]), pass_=9522 + j))
    return ems


EMITTERS = {'beast': em_beast, 'echoes': em_echoes, 'popup': em_popup, 'stage': em_stage}


def emitters(variant, MV):
    T = lambda n: MV + 'mvfx_' + n + '.tex'
    M = lambda n: MV + 'mvfx_' + n + '.scb'
    return EMITTERS[variant](T, M)
