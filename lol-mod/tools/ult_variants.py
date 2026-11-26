"""Four alternative METAVISION ult casts (proposals). Each starts after the chain burst of step_ult_cast (0.30 s)
and replaces the eye / hologram stadium. Build one with:  python3 build_mod.py <game> full  (ULT_VARIANT=<name>)

  puzzle  - Puzzle-Gehirn: the ground breaks into glowing puzzle pieces that fly up and lock into a brain
  neuro   - Neuronen-Schaltkreis: neural/circuit pathways spread over the ground, signals rush to the head,
            a giant circuit iris turns above it
  manga   - Manga-Moment: black-and-white ink: concentration lines, an inked eye panel, torn manga fragments
  radar   - Supersinne-Radar: radar waves and a sweep over the field, positions marked as puzzle pieces and
            linked with tactical arrows, everything dissolves into light lines
Meshes / art: brain (Meshy 3D), manga eye + torn fragments + neural pattern (Meshy images), rest procedural."""
import math
import os

import numpy as np
from PIL import Image, ImageDraw

import lolbin as L
import make_assets
import vfxlib as V
from stadium_fx import holo, fade, flat_quad, load_vfx_mesh, quad, combine

F = L.Field
FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); WH = (1.0, 1.0, 1.0)
VARIANTS = ('puzzle', 'neuro', 'manga', 'radar')
START = 0.34


# ------------------------------------------------------------------ procedural textures
def _rgba(i, rgb=(1, 1, 1)):
    i = np.clip(i, 0, 1)
    return Image.fromarray((np.dstack([np.full_like(i, rgb[0]), np.full_like(i, rgb[1]), np.full_like(i, rgb[2]), i]) * 255).astype(np.uint8), 'RGBA')


def puzzle_piece(size=256):
    """One jigsaw piece: bright rim, translucent fill (additive)."""
    s = size; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im)
    a, b = int(s * 0.22), int(s * 0.78); r = int(s * 0.11)
    d.rectangle([a, a, b, b], fill=255)
    d.ellipse([s // 2 - r, a - 2 * r + 4, s // 2 + r, a + 4], fill=255)        # tab top
    d.ellipse([b - 4, s // 2 - r, b + 2 * r - 4, s // 2 + r], fill=255)        # tab right
    d.ellipse([s // 2 - r, b - 2 * r + 4, s // 2 + r, b + 4], fill=0)          # blank bottom
    d.ellipse([a - 4, s // 2 - r, a + 2 * r - 4, s // 2 + r], fill=0)          # blank left
    m = np.asarray(im).astype(float) / 255
    from scipy.ndimage import gaussian_filter, binary_erosion
    inner = binary_erosion(m > 0.5, iterations=6)
    rim = (m > 0.5) & ~inner
    i = gaussian_filter(rim.astype(float), 1.2) * 1.4 + inner * 0.28 + gaussian_filter(m, 8) * 0.25
    return _rgba(i)


def circuit_iris(size=512):
    """Original iris: concentric rings, fine spokes, circuit segments, small bright pupil (additive)."""
    s = size; y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    i = np.zeros_like(r)
    for rr, w in ((0.92, 0.012), (0.78, 0.008), (0.55, 0.010), (0.34, 0.008), (0.16, 0.02)):
        i += np.exp(-((r - rr) / w) ** 2)
    spokes = (np.cos(a * 48) > 0.92) * ((r > 0.36) & (r < 0.76)) * 0.7
    segs = ((np.cos(a * 12 + 0.4) > 0.6) & (r > 0.80) & (r < 0.90)) * 0.8
    ticks = ((np.cos(a * 96) > 0.8) & (r > 0.93) & (r < 0.98)) * 0.6
    pupil = np.exp(-(r / 0.07) ** 2) * 1.2
    i = (i + spokes + segs + ticks + pupil) * (r < 1)
    return _rgba(i)


def speed_ring(size=1024):
    """Manga concentration lines: black ink strokes from the edge inwards, empty centre (alpha blend)."""
    s = size; y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    rng = np.random.default_rng(5)
    n = 220; ang = rng.uniform(-np.pi, np.pi, n); inner = rng.uniform(0.38, 0.72, n); width = rng.uniform(0.002, 0.009, n)
    i = np.zeros_like(r)
    for k in range(n):
        da = np.abs((a - ang[k] + np.pi) % (2 * np.pi) - np.pi)
        w = width[k] * np.clip((r - inner[k]) / (1 - inner[k]), 0, 1)
        i = np.maximum(i, (da < w) * (r > inner[k]))
    i *= np.clip((1.0 - r) / 0.05, 0, 1)
    return Image.fromarray((np.dstack([np.zeros_like(i)] * 3 + [i]) * 255).astype(np.uint8), 'RGBA')


def ink_splat(size=256):
    rng = np.random.default_rng(9); im = Image.new('L', (size, size), 0); d = ImageDraw.Draw(im)
    c = size / 2
    d.ellipse([c - 50, c - 50, c + 50, c + 50], fill=255)
    for _ in range(26):
        a = rng.uniform(0, 2 * np.pi); L_ = rng.uniform(50, 120); r = rng.uniform(4, 14)
        x, y = c + np.cos(a) * L_, c + np.sin(a) * L_
        d.line([(c, c), (x, y)], fill=255, width=int(r))
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    from scipy.ndimage import gaussian_filter
    m = gaussian_filter(np.asarray(im).astype(float) / 255, 1.0)
    return Image.fromarray((np.dstack([np.zeros_like(m)] * 3 + [m]) * 255).astype(np.uint8), 'RGBA')


def radar_sweep(size=512):
    """Wedge texture for the sweep mesh: u = angle within the wedge (1 = leading edge), v = radius."""
    s = size; v, u = np.mgrid[0:s, 0:s].astype(float) / (s - 1)
    i = u ** 3 * 0.8 + np.exp(-((u - 1) / 0.02) ** 2) * 1.0
    i *= np.clip(v / 0.05, 0, 1) * np.clip((1 - v) / 0.02, 0, 1)
    i += (np.abs(np.mod(v * 6, 1) - 0.5) > 0.47) * 0.35 * u
    return _rgba(i)


def tactic_arrow(size=256):
    """Arrow along u (0 tail -> 1 head), v across: dashed body + head (additive)."""
    w, h = size * 2, size // 2
    v, u = np.mgrid[0:h, 0:w].astype(float); u /= w - 1; v = v / (h - 1) * 2 - 1
    body = (np.abs(v) < 0.16) & (u < 0.82) & (np.mod(u * 14, 1) < 0.7)
    head = (u >= 0.80) & (np.abs(v) < (1 - u) / 0.2 * 0.95)
    from scipy.ndimage import gaussian_filter
    i = gaussian_filter((body | head).astype(float), 1.0) * 1.1 + gaussian_filter((body | head).astype(float), 5) * 0.4
    return _rgba(i)


def halftone(size=512):
    s = size; y, x = np.mgrid[0:s, 0:s].astype(float)
    r = np.hypot(x / (s - 1) * 2 - 1, y / (s - 1) * 2 - 1)
    cell = 12; cx = (np.mod(x, cell) - cell / 2); cy = (np.mod(y, cell) - cell / 2)
    rad = np.clip((1 - r) * 0.9, 0, 1) * cell * 0.48
    i = (np.hypot(cx, cy) < rad) * np.clip((1 - r) / 0.2, 0, 1)
    return Image.fromarray((np.dstack([np.zeros_like(i)] * 3 + [i * 0.85]) * 255).astype(np.uint8), 'RGBA')


def radial_erode(size=256):
    """Erosion map: dark in the centre, bright outside -> with a falling drive the pattern grows outwards."""
    s = size; y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    rng = np.random.default_rng(2)
    from scipy.ndimage import gaussian_filter
    n = gaussian_filter(rng.random((s, s)), 3); n = (n - n.mean()) / n.std()
    e = np.clip(np.hypot(x, y) * 0.9 + 0.04 * n + 0.04, 0, 1)
    return Image.fromarray((np.dstack([e, e, e, np.ones_like(e)]) * 255).astype(np.uint8), 'RGBA')


def along_erode(size=256):
    """Erosion map along u: arrows draw themselves from tail to head."""
    u = np.tile(np.linspace(0, 1, size * 2), (size // 2, 1))
    e = np.clip(u * 0.94 + 0.03, 0, 1)
    return Image.fromarray((np.dstack([e, e, e, np.ones_like(e)]) * 255).astype(np.uint8), 'RGBA')


def textures(root):
    vfx = os.path.join(root, 'assets_src', 'vfx')
    tx = {'puzzle_piece': puzzle_piece(), 'circuit_iris': circuit_iris(), 'speed_ring': speed_ring(),
          'ink_splat': ink_splat(), 'radar_sweep': radar_sweep(), 'tactic_arrow': tactic_arrow(),
          'halftone': halftone(), 'radial_erode': radial_erode(), 'along_erode': along_erode(),
          'manga_eye': Image.open(os.path.join(vfx, 'manga_eye.png')).convert('RGBA').resize((512, 512), Image.LANCZOS),
          'neuro': Image.open(os.path.join(vfx, 'neuro.png')).convert('RGBA').resize((1024, 1024), Image.LANCZOS)}
    for k in range(6):
        tx[f'manga_frag_{k}'] = Image.open(os.path.join(vfx, f'manga_frag_{k}.png')).convert('RGBA')
    return tx


# ------------------------------------------------------------------ meshes
def fan(r0, r1, deg, seg=24, y=3.0):
    """Flat wedge on the ground (radar sweep), u = angle, v = radius."""
    P, U, T = [], [], []
    for k in range(seg + 1):
        a = math.radians(-deg * k / seg)
        for j, r in enumerate((r0, r1)):
            P.append((r * math.cos(a), y, r * math.sin(a))); U.append((k / seg, j))
    for k in range(seg):
        i = 2 * k
        T += [(i, i + 1, i + 3), (i, i + 3, i + 2)]
    return np.array(P, float), np.array(U, float), np.array(T)


def arrow_strip(p0, p1, bend, width=26.0, seg=20, y=4.0):
    """Curved flat arrow strip on the ground from p0 to p1 (u along, v across)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0; n = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
    P, U, T = [], [], []
    for k in range(seg + 1):
        t = k / seg
        c = p0 + d * t + n * bend * math.sin(math.pi * t)
        tan = d + n * bend * math.pi * math.cos(math.pi * t); tan /= np.linalg.norm(tan)
        side = np.array([-tan[1], tan[0]])
        for j, s in enumerate((-1, 1)):
            q = c + side * s * width / 2
            P.append((q[0], y, q[1])); U.append((t, j))
    for k in range(seg):
        i = 2 * k
        T += [(i, i + 2, i + 3), (i, i + 3, i + 1)]
    return np.array(P, float), np.array(U, float), np.array(T)


MARKS = [(260, 70), (330, 145), (420, 215), (300, 290), (380, 20)]      # radar markers: (radius, angle deg)


def meshes(root):
    br = load_vfx_mesh(root, 'brain')
    P = br[0].copy(); P[:, 1] -= 50                                     # centred on its own middle
    out = {'mvfx_v_brain.scb': (P, br[1], br[2]), 'mvfx_v_sweep.scb': fan(20, 520, 70)}
    arrows = []
    for k, (r, a) in enumerate(MARKS):
        p1 = (r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))
        p0 = (40 * math.cos(math.radians(a + 40)), 40 * math.sin(math.radians(a + 40)))
        arrows.append(arrow_strip(p0, p1, bend=60 if k % 2 else -60))
    out['mvfx_v_arrows.scb'] = combine(arrows)
    return out


# ------------------------------------------------------------------ emitters
def em_puzzle(T, M):
    ems = []
    rng = np.random.default_rng(11)
    BR = np.array([0.0, 275.0, 0.0])
    ems.append(V.emitter('MVV_PzCrack', T('shock_ring'), blend=4, delay=START - 0.02, life=0.5, bind=0.0, ground=True,
                         rotation=(-90, -90, 0), scale=(60, 60, 1), scale_curve=([0, 1], [(1,) * 3, (5.0,) * 3]),
                         color_curve=([0, 0.1, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=-2700))
    n = 30
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.1, 0.1); r = rng.uniform(140, 260)
        start = np.array([r * math.cos(a), 6.0, r * math.sin(a)])
        ang = rng.uniform(0, 2 * math.pi); el = rng.uniform(-0.8, 0.8)
        target = BR + 52 * np.array([math.cos(ang) * math.cos(el), math.sin(el), math.sin(ang) * math.cos(el)])
        t0 = START + 0.02 * (k % 8); dur = 0.55 + 0.02 * (k % 5)
        ems.append(V.emitter(f'MVV_PzPiece{k}', T('puzzle_piece'), blend=4, delay=t0, life=dur, bind=0.0, pos=tuple(start),
                             velocity=tuple((target - start) / dur), scale=(13, 13, 1), spin=(rng.uniform(-540, 540), 0, 0),
                             rotation=(rng.uniform(0, 360), 0, 0),
                             color_curve=([0, 0.15, 0.85, 1], [HI + (0,), HI + (1,), FLOW + (1,), WH + (0.9,)]), pass_=9400 + k % 10))
    LOCK = START + 0.62
    ems.append(V.emitter('MVV_PzBrain', T('holo_body'), blend=4, delay=LOCK - 0.08, life=1.55, bind=0.0, pos=tuple(BR),
                         mesh=M('v_brain'), scale=(1, 1, 1), spin=(0, 70, 0), backface=True, pass_=9420,
                         color_curve=fade(tuple(min(1, c * 1.3) for c in FLOW), 0.05, 0.85, 1.0),
                         extra=holo(T('holo_erode'), [0.0, 0.18, 0.82, 1.0], [1.0, 0.0, 0.0, 1.0])))
    ems.append(V.emitter('MVV_PzLockFlash', T('flash_star'), blend=4, delay=LOCK + 0.05, life=0.35, bind=0.0, pos=tuple(BR),
                         scale=(110, 110, 1), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.4,) * 3, (1.7,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.8,), FLOW + (0,)]), pass_=9421))
    ems.append(V.emitter('MVV_PzAura', T('light_dot'), blend=4, delay=LOCK, life=1.4, bind=0.0, pos=tuple(BR), scale=(95, 95, 1),
                         color_curve=fade(FLOW, 0.1, 0.8, 0.45), pass_=9419))
    for j, t in enumerate((LOCK + 0.25, LOCK + 0.5, LOCK + 0.75)):
        ems.append(V.emitter(f'MVV_PzThreads{j}', T('light_streak'), blend=4, single=False, rate=500, emitter_life=0.05, delay=t,
                             life=0.5, bind=0.0, pos=tuple(BR), scale=(9, 9, 9), drag=(1.0, 1.0, 1.0),
                             velocity=V.vvec3((900, 500, 900), rand=[(-1, 1), (-1, 0.4), (-1, 1)]),
                             direction_oriented=True, dir_scale=0.004, color_curve=([0, 0.4, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9422))
    END = LOCK + 1.3
    ems.append(V.emitter('MVV_PzShatter', T('puzzle_piece'), blend=4, single=False, rate=1400, emitter_life=0.04, delay=END,
                         life=0.9, bind=0.0, pos=tuple(BR), spawn_radius=40, scale=V.vvec3((10, 10, 1), rand=[(0.6, 1.4), None, None]),
                         velocity=V.vvec3((650, 550, 650), rand=[(-1, 1), (-0.3, 1), (-1, 1)]), accel=(0, -1200, 0), drag=(1, 1, 1),
                         spin=V.vvec3((720, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9423))
    ems.append(V.emitter('MVV_PzEndRing', T('shock_ring'), blend=4, delay=END, life=0.5, bind=0.0, pos=tuple(BR), scale=(50, 50, 1),
                         scale_curve=([0, 1], [(1,) * 3, (6.0,) * 3]), color_curve=([0, 0.15, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=9424))
    return ems


def em_neuro(T, M):
    ems = []
    G0 = START + 0.02
    ems.append(V.emitter('MVV_NeNet', T('neuro'), blend=4, delay=G0, life=2.3, bind=0.0, ground=True, rotation=(-90, -90, 0),
                         scale=(330, 330, 1), pass_=-2700,
                         color_curve=([0, 0.05, 0.2, 0.3, 0.45, 0.55, 0.85, 1],
                                      [FLOW + (0,), HI + (1,), FLOW + (0.85,), HI + (1,), FLOW + (0.85,), HI + (1,), FLOW + (0.8,), DEEP + (0,)]),
                         extra=[F('alphaErosionDefinition', L.STRUCT, holo(T('radial_erode'), [0, 0.25, 0.85, 1], [1, 0, 0, 1])[0].value)]))
    ems.append(V.emitter('MVV_NeNodes', T('flash_star'), blend=4, single=False, rate=26, emitter_life=1.9, delay=G0 + 0.2, life=0.25,
                         bind=0.0, pos=(0, 6, 0), extra=[F('SpawnShape', L.STRUCT, L.Struct('VfxShapeBox', [F('Size', L.VEC3, (560.0, 4.0, 560.0))], L.STRUCT))],
                         scale=V.vvec3((16, 16, 1), rand=[(0.6, 1.5), None, None]),
                         color_curve=([0, 0.3, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9430))
    ems.append(V.emitter('MVV_NeSparks', T('light_dot'), blend=4, single=False, rate=90, emitter_life=1.8, delay=G0 + 0.1, life=0.55,
                         bind=0.0, pos=(0, 6, 0), scale=(6, 6, 6), velocity=V.vvec3((620, 0, 620), rand=[(-1, 1), None, (-1, 1)]),
                         direction_oriented=True, dir_scale=0.006, color_curve=([0, 0.5, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9431))
    rng = np.random.default_rng(4)
    for k in range(8):                                   # signals rush from the net into the head
        a = 2 * math.pi * k / 8 + 0.3; r = rng.uniform(180, 280)
        s0 = np.array([r * math.cos(a), 8.0, r * math.sin(a)]); s1 = np.array([0.0, 190.0, 0.0]); dur = 0.22
        ems.append(V.emitter(f'MVV_NeSignal{k}', T('light_streak'), blend=4, delay=G0 + 0.35 + 0.05 * k, life=dur, bind=1.0,
                             pos=tuple(s0), velocity=tuple((s1 - s0) / dur), scale=(10, 10, 10), direction_oriented=True, dir_scale=0.0012,
                             color_curve=([0, 0.4, 1], [FLOW + (0,), HI + (1,), WH + (1,)]), pass_=9432))
    IR = START + 0.75; EYE = (0, 305, 0)
    open_ = ([0, 0.12, 0.2, 1], [(0.2,) * 3, (1.15,) * 3, (1.0,) * 3, (1.04,) * 3])
    ems.append(V.emitter('MVV_NeIris', T('circuit_iris'), blend=4, delay=IR, life=1.4, pos=EYE, scale=(150, 150, 1), spin=(40, 0, 0),
                         scale_curve=open_, color_curve=fade(HI, 0.1, 0.85, 1.0), pass_=9440))
    ems.append(V.emitter('MVV_NeIris2', T('circuit_iris'), blend=4, delay=IR + 0.05, life=1.35, pos=EYE, scale=(100, 100, 1), spin=(-70, 0, 0),
                         scale_curve=open_, color_curve=fade(FLOW, 0.1, 0.85, 0.9), pass_=9441))
    ems.append(V.emitter('MVV_NeIrisGlow', T('light_dot'), blend=4, delay=IR, life=1.4, pos=EYE, scale=(170, 170, 1),
                         color_curve=fade(FLOW, 0.1, 0.85, 0.5), pass_=9439))
    ems.append(V.emitter('MVV_NePupil', T('flash_star'), blend=4, delay=IR + 1.2, life=0.35, pos=EYE, scale=(90, 90, 1),
                         scale_curve=([0, 0.3, 1], [(1.4,) * 3, (0.5,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.3, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9442))
    ems.append(V.emitter('MVV_NeRain', T('light_dot'), blend=4, single=False, rate=1000, emitter_life=0.05, delay=IR + 1.3, life=0.6,
                         bind=0.0, pos=EYE, spawn_radius=90, scale=(6, 6, 6), drag=(1.5, 1.5, 1.5),
                         velocity=V.vvec3((700, 900, 700), rand=[(-1, 1), (-1.0, 0.2), (-1, 1)]), direction_oriented=True, dir_scale=0.006,
                         color_curve=([0, 0.5, 1], [HI + (1,), FLOW + (0.9,), DEEP + (0,)]), pass_=9443))
    return ems


def em_manga(T, M):
    ems = []
    t0 = START
    ems.append(V.emitter('MVV_MgFlash', T('flash_star'), blend=4, delay=t0 - 0.04, life=0.18, pos=(0, 120, 0), scale=(380, 380, 1),
                         color_curve=([0, 0.3, 1], [WH + (1,), WH + (0.8,), WH + (0,)]), pass_=9450))
    ems.append(V.emitter('MVV_MgLines', T('speed_ring'), blend=1, delay=t0, life=1.0, pos=(0, 120, 0), scale=(340, 340, 1),
                         spin=V.vvec3((0, 0, 0), rand=[(-6, 6), None, None]),
                         scale_curve=([0, 0.1, 1], [(1.25,) * 3, (1.0,) * 3, (0.95,) * 3]),
                         color_curve=([0, 0.06, 0.8, 1], [WH + (0,), WH + (1,), WH + (0.9,), WH + (0,)]), pass_=9451))
    ems.append(V.emitter('MVV_MgTone', T('halftone'), blend=1, delay=t0 + 0.02, life=1.6, bind=0.0, ground=True, rotation=(-90, -90, 0),
                         scale=(260, 260, 1), color_curve=fade(WH, 0.08, 0.8, 0.9), pass_=-2700))
    for k in range(10):
        ems.append(V.emitter(f'MVV_MgInk{k}', T('ink_splat'), blend=1, delay=t0 + 0.01 * k, life=1.2, bind=0.0,
                             pos=(150 * math.cos(k * 2.4), 30 + 18 * (k % 5), 150 * math.sin(k * 2.4) * 0.5), scale=(24 + 4 * (k % 3), 24 + 4 * (k % 3), 1),
                             rotation=(k * 37.0, 0, 0), scale_curve=([0, 0.08, 1], [(0.2,) * 3, (1.0,) * 3, (1.05,) * 3]),
                             color_curve=fade(WH, 0.02, 0.75, 1.0), pass_=9452))
    EY = t0 + 0.12
    pop = ([0, 0.07, 0.12, 1], [(0.6, 0.05, 1), (1.08, 1.1, 1), (1.0, 1.0, 1), (1.03, 1.03, 1)])
    ems.append(V.emitter('MVV_MgEye', T('manga_eye'), blend=1, delay=EY, life=1.55, pos=(0, 310, -30), scale=(175, 175, 1),
                         uniform=False, scale_curve=pop, color_curve=fade(WH, 0.04, 0.85, 1.0), pass_=9455))
    ems.append(V.emitter('MVV_MgIrisGlow', T('light_dot'), blend=4, delay=EY + 0.12, life=1.35, pos=(0, 308, -28), scale=(50, 50, 1),
                         color_curve=([0, 0.1, 0.4, 0.6, 0.85, 1], [FLOW + (0,), HI + (0.9,), FLOW + (0.6,), HI + (0.9,), FLOW + (0.6,), FLOW + (0,)]),
                         pass_=9456))
    rng = np.random.default_rng(8)
    for k in range(6):
        ems.append(V.emitter(f'MVV_MgFrag{k}', T(f'manga_frag_{k}'), blend=1, single=False, rate=5, emitter_life=0.5, delay=t0 + 0.05 * k,
                             life=1.3, bind=0.0, pos=(0, 60, 0), spawn_radius=110,
                             scale=V.vvec3((30, 30, 1), rand=[(0.8, 1.4), None, None]),
                             velocity=V.vvec3((120, 360, 120), rand=[(-1, 1), (0.6, 1.3), (-1, 1)]), drag=(0.8, 0.6, 0.8),
                             spin=V.vvec3((260, 0, 0), rand=[(-1, 1), None, None]), rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]),
                             color_curve=fade(WH, 0.06, 0.8, 1.0), pass_=9453 + k))
    END = t0 + 1.55
    ems.append(V.emitter('MVV_MgTear', T('flash_star'), blend=4, delay=END, life=0.3, pos=(0, 300, -30), scale=(160, 160, 1),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.8,), FLOW + (0,)]), pass_=9460))
    ems.append(V.emitter('MVV_MgTearBits', T('manga_frag_5'), blend=1, single=False, rate=600, emitter_life=0.04, delay=END, life=0.8,
                         bind=0.0, pos=(0, 300, -30), spawn_radius=80, scale=V.vvec3((14, 14, 1), rand=[(0.5, 1.5), None, None]),
                         velocity=V.vvec3((500, 300, 200), rand=[(-1, 1), (-0.5, 1), (-1, 1)]), accel=(0, -900, 0),
                         spin=V.vvec3((600, 0, 0), rand=[(-1, 1), None, None]), color_curve=fade(WH, 0.0, 0.7, 1.0), pass_=9461))
    return ems


def em_radar(T, M):
    ems = []
    for j, t in enumerate((START, START + 0.28, START + 0.56)):
        ems.append(V.emitter(f'MVV_RdWave{j}', T('shock_ring'), blend=4, delay=t, life=0.9, bind=0.0, ground=True, rotation=(-90, -90, 0),
                             scale=(40, 40, 1), scale_curve=([0, 1], [(1,) * 3, (15.0,) * 3]),
                             color_curve=([0, 0.08, 0.7, 1], [HI + (0,), HI + (1,), FLOW + (0.6,), DEEP + (0,)]), pass_=-2700 + j))
    ems.append(V.emitter('MVV_RdCentre', T('reticle'), blend=4, delay=START, life=2.1, bind=0.0, ground=True, rotation=(-90, -90, 0),
                         scale=(90, 90, 1), color_curve=fade(HI, 0.05, 0.85, 0.8), pass_=-2690))
    ems.append(V.emitter('MVV_RdSweep', T('radar_sweep'), blend=4, delay=START + 0.1, life=1.9, bind=0.0, mesh=M('v_sweep'), scale=(1, 1, 1),
                         spin=(0, -300, 0), backface=True, color_curve=fade(HI, 0.08, 0.85, 0.75), pass_=-2685))
    for k, (r, a) in enumerate(MARKS):
        p = (r * math.cos(math.radians(a)), 0.0, r * math.sin(math.radians(a)))
        tk = START + 0.15 + (a % 360) / 300.0                           # when the sweep passes
        ems.append(V.emitter(f'MVV_RdMark{k}', T('puzzle_piece'), blend=4, delay=tk, life=2.25 - (tk - START), bind=0.0,
                             pos=(p[0], 70, p[2]), scale=(26, 26, 1), spin=(30, 0, 0),
                             scale_curve=([0, 0.08, 0.15, 1], [(2.2,) * 3, (0.85,) * 3, (1.0,) * 3, (1.0,) * 3]),
                             color_curve=fade(HI, 0.05, 0.85, 1.0), pass_=9470 + k))
        ems.append(V.emitter(f'MVV_RdPillar{k}', T('light_streak'), blend=4, delay=tk, life=0.6, bind=0.0, pos=(p[0], 70, p[2]),
                             scale=(10, 70, 1), uniform=False, color_curve=([0, 0.15, 1], [WH + (1,), HI + (0.8,), FLOW + (0,)]), pass_=9480 + k))
        ems.append(V.emitter(f'MVV_RdRing{k}', T('scan_ring'), blend=4, delay=tk, life=0.7, bind=0.0, ground=True, rotation=(-90, -90, 0),
                             pos=p, scale=(40, 40, 1), scale_curve=([0, 1], [(0.5,) * 3, (1.4,) * 3]),
                             color_curve=([0, 0.1, 1], [HI + (0,), HI + (1,), FLOW + (0,)]), pass_=-2680 + k))
    AR = START + 1.05
    ems.append(V.emitter('MVV_RdArrows', T('tactic_arrow'), blend=4, delay=AR, life=1.15, bind=0.0, mesh=M('v_arrows'), scale=(1, 1, 1),
                         backface=True, color_curve=fade(HI, 0.02, 0.85, 1.0), pass_=-2670,
                         extra=[F('alphaErosionDefinition', L.STRUCT, holo(T('along_erode'), [0, 0.35, 1.0], [1, 0, 0])[0].value)]))
    END = START + 2.2
    ems.append(V.emitter('MVV_RdLines', T('light_dot'), blend=4, single=False, rate=1200, emitter_life=0.05, delay=END, life=0.6, bind=0.0,
                         pos=(0, 20, 0), spawn_radius=380, scale=(6, 6, 6), drag=(1, 1, 1),
                         velocity=V.vvec3((0, 900, 0), rand=[None, (0.5, 1.2), None]), direction_oriented=True, dir_scale=0.006,
                         color_curve=([0, 0.4, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9490))
    return ems


EMITTERS = {'puzzle': em_puzzle, 'neuro': em_neuro, 'manga': em_manga, 'radar': em_radar}


def emitters(variant, MV):
    T = lambda n: MV + 'mvfx_' + n + '.tex'
    M = lambda n: MV + 'mvfx_' + n + '.scb'
    return EMITTERS[variant](T, M)
