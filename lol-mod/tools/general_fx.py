"""Extra moments outside the ult (own designs):

  recall   Torjubel: a goal of light builds up around him, a ball bounces on his foot (keepie-uppie), at the end the
           net bulges, confetti flies and he is gone              -> recall clip (ParticleEventData, like Riot's own)
  steps    Laufspuren: chalk dash + grass flecks at every foot contact of the run cycles -> run clips
  qsteps   during Q: white-violet afterimage footprints               -> persistent effect on the Q buff (feet)
  qaura    Flow aura: white-violet sparks rise from hair, shoulders and feet while Q is active (persistent, Q buff)
  respawn  Anstoss: a centre circle draws itself on the ground, a floodlight cone falls on him -> respawn clip
  death    Abpfiff: whistle waves, a grey shockwave, the ball rolls away, the eye glow fades -> death clip

Timing/positions: the goal, circle and footprints are world-fixed (isLocalOrientation 0, bindWeight 0); the ball and
the sparks follow him (they are on his body).
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import os

import lolbin as L
import vfxlib as V
from vfxshapes import holo, fade, quad, box, cone, combine

F = L.Field
FLOW = (0.10, 0.65, 0.30); HI = (0.62, 0.98, 0.72); DEEP = (0.02, 0.36, 0.16); WH = (1.0, 1.0, 1.0)
LAV = (0.80, 0.70, 1.0); VIO = (0.55, 0.30, 0.95); CHALK = (0.95, 0.97, 0.93); GRASS = (0.30, 0.78, 0.32)
WORLD = dict(bind=0.0, local_orientation=False)
PART = 'Characters/Yunara/Skins/Skin0/Particles/'
FPS = 30.0

# (clip, frames, bone) from the striker's retargeted run cycles (toe height minima, see char/ tools)
STEPS = {'run_base': {'L': [16, 46, 76, 106], 'R': [1, 31, 61, 91]}, 'run_slow': {'L': [12], 'R': [25]},
         'run_in': {'L': [12], 'R': []}}
RECALL_FRAMES = 262
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')
GOAL_W, GOAL_H, GOAL_D = 270.0, 135.0, 80.0


# ------------------------------------------------------------------ textures
def _rgba(i, rgb=(1, 1, 1)):
    i = np.clip(i, 0, 1)
    return Image.fromarray((np.dstack([np.full_like(i, rgb[0]), np.full_like(i, rgb[1]), np.full_like(i, rgb[2]), i]) * 255).astype(np.uint8), 'RGBA')


def chalk_dash(s=128):
    """A short chalk line scuffed on the turf (ground decal)."""
    rng = np.random.default_rng(4)
    im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im)
    for k in range(7):
        y = s / 2 + rng.uniform(-6, 6); x0 = s * 0.18 + rng.uniform(-6, 6); x1 = s * 0.82 + rng.uniform(-6, 6)
        d.line([(x0, y), (x1, y + rng.uniform(-3, 3))], fill=int(rng.uniform(120, 255)), width=int(rng.uniform(2, 5)))
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
    a *= (0.6 + 0.4 * np.random.default_rng(5).random(a.shape))
    return _rgba(a)


def grass_fleck(s=32):
    im = Image.new('L', (s, s), 0); ImageDraw.Draw(im).polygon([(s * 0.45, s * 0.05), (s * 0.6, s * 0.1), (s * 0.55, s * 0.95), (s * 0.42, s * 0.9)], fill=255)
    return _rgba(np.asarray(im).astype(float) / 255)


def footprint(s=128):
    """Stylised boot print with studs, glowing edge (additive ground decal)."""
    S = 4; im = Image.new('L', (s * S, s * S), 0); d = ImageDraw.Draw(im)
    c = s * S / 2
    d.ellipse([c - 18 * S, 8 * S, c + 18 * S, 70 * S], fill=255)                  # forefoot
    d.ellipse([c - 14 * S, 74 * S, c + 14 * S, 118 * S], fill=255)                # heel
    for x, y in ((-9, 22), (9, 22), (-11, 42), (11, 42), (0, 58), (-7, 90), (7, 90), (0, 106)):
        d.ellipse([c + (x - 3) * S, (y - 3) * S, c + (x + 3) * S, (y + 3) * S], fill=60)
    m = np.asarray(im.resize((s, s), Image.LANCZOS)).astype(float) / 255
    from scipy.ndimage import binary_erosion
    edge = (m > 0.3) & ~binary_erosion(m > 0.3, iterations=2)
    return _rgba(np.clip(m * 0.45 + edge * 0.9, 0, 1))


def whistle_wave(s=256):
    """Sound waves: three concentric arcs opening to one side (billboard)."""
    S = 2; im = Image.new('L', (s * S, s * S), 0); d = ImageDraw.Draw(im)
    c = s * S / 2
    for k, r in enumerate((0.18, 0.30, 0.42)):
        R = r * s * S
        d.arc([c - R, c - R, c + R, c + R], -50, 50, fill=255 - 40 * k, width=int(9 * S))
        d.arc([c - R, c - R, c + R, c + R], 130, 230, fill=255 - 40 * k, width=int(9 * S))
    a = np.asarray(im.resize((s, s), Image.LANCZOS)).astype(float) / 255
    g = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float) / 255
    return _rgba(np.clip(a + g * 0.6, 0, 1))


def whistle_icon(s=128):
    """A referee whistle silhouette (white, for a pop above his head)."""
    S = 4; im = Image.new('L', (s * S, s * S), 0); d = ImageDraw.Draw(im)
    d.ellipse([20 * S, 52 * S, 76 * S, 108 * S], fill=255)
    d.rounded_rectangle([44 * S, 52 * S, 118 * S, 80 * S], radius=10 * S, fill=255)
    d.ellipse([36 * S, 68 * S, 60 * S, 92 * S], fill=0)
    d.ellipse([10 * S, 20 * S, 34 * S, 44 * S], outline=255, width=5 * S)
    d.line([(30 * S, 40 * S), (40 * S, 56 * S)], fill=255, width=5 * S)
    a = np.asarray(im.resize((s, s), Image.LANCZOS)).astype(float) / 255
    return _rgba(a)


def confetti(s=64):
    im = Image.new('L', (s, s), 0); ImageDraw.Draw(im).rectangle([s * 0.2, s * 0.35, s * 0.8, s * 0.65], fill=255)
    return _rgba(np.asarray(im).astype(float) / 255)


EGO_W, EGO_H = 512, 128
EGO_PIPS = 8


def _pip_x(k):
    """Centre (texture px) of pip k (1..8)."""
    return 150 + (k - 1) * 44


def _diamond(d, cx, cy, r, fill=None, outline=None, width=1):
    d.polygon([(cx, cy - r), (cx + r * 0.62, cy), (cx, cy + r), (cx - r * 0.62, cy)], fill=fill, outline=outline, width=width)


def ego_frame():
    """The Ego meter: dark capsule with a violet rim, 'EGO' on the left and 8 empty diamond slots (alpha blend)."""
    from PIL import ImageFont
    S = 2; W, H = EGO_W * S, EGO_H * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([6 * S, 30 * S, W - 6 * S, H - 30 * S], radius=30 * S, fill=(14, 8, 26, 215), outline=(150, 95, 230, 255), width=4 * S)
    try:
        f = ImageFont.truetype(FONT, 46 * S)
    except OSError:
        f = ImageFont.load_default()
    d.text((26 * S, 36 * S), 'EGO', font=f, fill=(225, 210, 255, 255))
    for k in range(1, EGO_PIPS + 1):
        _diamond(d, _pip_x(k) * S, H / 2, 24 * S, fill=(40, 26, 66, 255), outline=(110, 80, 170, 255), width=3 * S)
    return im.resize((EGO_W, EGO_H), Image.LANCZOS)


def ego_pip(k):
    """Lit pip k only (additive): green for the first stacks, violet towards the full bar."""
    f = (k - 1) / (EGO_PIPS - 1)
    col = np.array([0.18, 0.95, 0.42]) * (1 - f) + np.array([0.62, 0.28, 1.0]) * f
    S = 2; W, H = EGO_W * S, EGO_H * S
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    _diamond(d, _pip_x(k) * S, H / 2, 19 * S, fill=255)
    a = np.asarray(m.resize((EGO_W, EGO_H), Image.LANCZOS)).astype(float) / 255
    g = np.asarray(m.resize((EGO_W, EGO_H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(7))).astype(float) / 255
    i = np.clip(a * 1.1 + g * 0.8, 0, 1)
    rgb = np.clip(col * (0.8 + 0.2 * a[..., None]), 0, 1)
    return Image.fromarray((np.dstack([rgb * np.ones_like(i)[..., None], i]) * 255).astype(np.uint8), 'RGBA')


def ego_flare():
    """Full bar: a violet-green glow around the whole capsule (additive)."""
    S = 2; W, H = EGO_W * S, EGO_H * S
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).rounded_rectangle([20 * S, 40 * S, W - 20 * S, H - 40 * S], radius=26 * S, fill=255)
    g = np.asarray(m.resize((EGO_W, EGO_H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))).astype(float) / 255
    return _rgba(np.clip(g * 1.3, 0, 1))


def textures():
    tx = {'g_chalk': chalk_dash(), 'g_grass': grass_fleck(), 'g_footprint': footprint(), 'g_whistle_wave': whistle_wave(),
          'g_whistle': whistle_icon(), 'g_confetti': confetti(), 'g_ego_frame': ego_frame(), 'g_ego_flare': ego_flare()}
    for k in range(1, EGO_PIPS + 1):
        tx[f'g_ego_pip{k}'] = ego_pip(k)
    return tx


# ------------------------------------------------------------------ meshes (League world: +z behind him)
def meshes():
    W, H, D, r = GOAL_W / 2, GOAL_H, GOAL_D, 5.0
    z0 = 30.0                                                          # goal line just behind him: he stands in the mouth
    frame = combine([box((-W, H / 2, z0), (2 * r, H, 2 * r)), box((W, H / 2, z0), (2 * r, H, 2 * r)),
                     box((0, H, z0), (2 * W + 2 * r, 2 * r, 2 * r)),
                     box((-W, H * 0.75, z0 + D * 0.5), (r * 1.2, r * 1.2, D)), box((W, H * 0.75, z0 + D * 0.5), (r * 1.2, r * 1.2, D)),
                     box((0, r * 0.6, z0 + D), (2 * W, r * 1.2, r * 1.2))])
    net = combine([quad((-W, 0, z0 + D), (W, 0, z0 + D), (W, H * 0.92, z0 + D), (-W, H * 0.92, z0 + D), ((0, 1), (2, 1), (2, 0), (0, 0))),
                   quad((-W, H, z0), (W, H, z0), (W, H * 0.92, z0 + D), (-W, H * 0.92, z0 + D), ((0, 0), (2, 0), (2, 0.6), (0, 0.6))),
                   quad((-W, 0, z0), (-W, 0, z0 + D), (-W, H * 0.92, z0 + D), (-W, H, z0), ((0, 1), (0.6, 1), (0.6, 0), (0, 0))),
                   quad((W, 0, z0), (W, 0, z0 + D), (W, H * 0.92, z0 + D), (W, H, z0), ((0, 1), (0.6, 1), (0.6, 0), (0, 0)))])
    spot = cone((0, 900, 0), (0, 0, 0), 25.0, 110.0, seg=24)
    return {'mvfx_g_goal_frame.scb': frame, 'mvfx_g_goal_net.scb': net, 'mvfx_g_spot.scb': spot}


# ------------------------------------------------------------------ systems
def sys_recall(T, M):
    ems = []
    life = RECALL_FRAMES / FPS
    BUILD = 0.15; NET = 7.75
    nt = lambda t: t / life
    ems.append(V.emitter('MVG_GoalFrame', T('holo_body'), blend=4, life=life, mesh=M('g_goal_frame'), scale=(1, 1, 1), backface=True,
                         pass_=9200, color_curve=([0, nt(BUILD + 0.6), nt(NET), nt(NET + 0.1), 1],
                                                  [HI + (0,), (0.85, 1, 0.9, 0.95), (0.85, 1, 0.9, 0.95), WH + (1,), WH + (0,)]),
                         extra=holo(T('holo_erode'), [0, nt(BUILD), nt(BUILD + 0.7), 1], [1, 1, 0, 0], rim=(0.5, 1.0, 0.7)), **WORLD))
    ems.append(V.emitter('MVG_GoalNet', T('goal_net'), blend=4, life=life, mesh=M('g_goal_net'), scale=(1, 1, 1), backface=True,
                         uniform=False, pass_=9199,
                         scale_curve=([0, nt(NET), nt(NET + 0.08), nt(NET + 0.2), 1], [(1, 1, 1), (1, 1, 1), (1.03, 1.02, 1.35), (1, 1, 1.08), (1, 1, 1)]),
                         color_curve=([0, nt(BUILD + 0.9), nt(NET), nt(NET + 0.08), 1],
                                      [HI + (0,), FLOW + (0.65,), FLOW + (0.65,), WH + (1,), WH + (0,)]),
                         extra=holo(T('holo_erode'), [0, nt(BUILD + 0.3), nt(BUILD + 1.0), 1], [1, 1, 0, 0])[0:1], **WORLD))
    ems.append(V.emitter('MVG_GoalLine', T('shock_ring'), blend=4, delay=BUILD, life=0.5, ground=True, rotation=(-90, -90, 0),
                         scale=(50, 50, 1), scale_curve=([0, 1], [(1,) * 3, (5.0,) * 3]),
                         color_curve=([0, 0.1, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=-2700, **WORLD))
    # keepie-uppie: one bounce every 0.8 s on his foot (in front of him: follows him, not world-fixed)
    ems.append(V.emitter('MVG_Juggle', T('ball_sprite'), blend=1, single=False, rate=1.25, emitter_life=NET - 0.9, delay=0.6, life=0.78,
                         pos=(0, 22, 38), scale=(13, 13, 13), velocity=(0, 440, 0), accel=(0, -1130, 0),
                         spin=V.vvec3((420, 0, 0), rand=[(-1, 1), None, None]), color_curve=fade(WH, 0.02, 0.97, 1.0), pass_=9210))
    ems.append(V.emitter('MVG_JuggleTap', T('light_dot'), blend=4, single=False, rate=1.25, emitter_life=NET - 0.9, delay=0.6, life=0.18,
                         pos=(0, 22, 38), scale=(16, 16, 16), color_curve=([0, 0.2, 1], [WH + (0.9,), HI + (0.6,), FLOW + (0,)]), pass_=9211))
    # the goal: net bulges, flash, confetti
    ems.append(V.emitter('MVG_GoalFlash', T('flash_star'), blend=4, delay=NET, life=0.4, pos=(0, 90, 0), scale=(130, 130, 1),
                         scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (1.6,) * 3]),
                         color_curve=([0, 0.2, 1], [WH + (1,), HI + (0.9,), FLOW + (0,)]), pass_=9220))
    for j, c in enumerate((WH, HI, VIO, (0.25, 0.45, 1.0))):
        ems.append(V.emitter(f'MVG_Confetti{j}', T('g_confetti'), blend=1, single=False, rate=420, emitter_life=0.05, delay=NET + 0.02,
                             life=1.2, bind=0.0, pos=(0, 170, 0), spawn_radius=120, scale=V.vvec3((6, 6, 6), rand=[(0.6, 1.3), None, None]),
                             velocity=V.vvec3((240, 330, 240), rand=[(-1, 1), (0.2, 1), (-1, 1)]), accel=(0, -480, 0), drag=(1.3, 1.3, 1.3),
                             rotation=V.vvec3((180, 0, 0), rand=[(-1, 1), None, None]), spin=V.vvec3((540, 0, 0), rand=[(-1, 1), None, None]),
                             color_curve=([0, 0.75, 1], [c + (1,), c + (1,), c + (0,)]), pass_=9221 + j, linger=1.2))
    return ems


def sys_step(T, M):
    """Clarity: a chalk mark only (no grass shreds / dust), short-lived, and only on every second step (STEP_EVERY)."""
    return [
        V.emitter('MVG_Chalk', T('g_chalk'), blend=1, life=0.5, ground=True, rotation=V.vvec3((-90, -90, 0), rand=[None, (0.6, 1.4), None]),
                  scale=(15, 15, 1), color_curve=([0, 0.05, 0.5, 1], [CHALK + (0,), CHALK + (0.85,), CHALK + (0.55,), CHALK + (0,)]),
                  pass_=-2600, **WORLD),
    ]


def sys_qsteps(T, M):
    return [V.emitter('MVG_QPrint', T('g_footprint'), blend=4, single=False, rate=3.2, emitter_life=-1, life=0.6, ground=True,
                      rotation=(-90, -90, 0), scale=(13, 13, 1), pass_=-2590,
                      color_curve=([0, 0.08, 0.5, 1], [WH + (0,), WH + (0.95,), LAV + (0.7,), VIO + (0,)]), **WORLD)]


def sys_qaura(T, M, big=False):
    s = 1.4 if big else 1.0
    return [
        V.emitter('MVG_QWisp', T('light_streak'), blend=4, single=False, rate=10 * s, emitter_life=-1, life=0.55, spawn_radius=10 * s,
                  scale=V.vvec3((5 * s, 5 * s, 5 * s), rand=[(0.6, 1.3), None, None]), velocity=V.vvec3((0, 150, 0), rand=[None, (0.6, 1.4), None]),
                  drag=(1.0, 1.0, 1.0), direction_oriented=True, dir_scale=0.01,
                  color_curve=([0, 0.2, 0.6, 1], [WH + (0,), WH + (0.95,), LAV + (0.8,), VIO + (0,)]), pass_=9050),
        V.emitter('MVG_QSpark', T('light_dot'), blend=4, single=False, rate=6 * s, emitter_life=-1, life=0.7, spawn_radius=14 * s,
                  scale=V.vvec3((2.2, 2.2, 2.2), rand=[(0.6, 1.4), None, None]), velocity=V.vvec3((30, 110, 30), rand=[(-1, 1), (0.5, 1.3), (-1, 1)]),
                  drag=(0.8, 0.8, 0.8), color_curve=([0, 0.15, 1], [WH + (1,), LAV + (0.9,), VIO + (0,)]), pass_=9051),
    ]


def sys_respawn(T, M):
    ems = []
    ems.append(V.emitter('MVG_Circle', T('center_circle'), blend=4, life=2.2, ground=True, rotation=(-90, -90, 0), scale=(150, 150, 1),
                         pass_=-2700, color_curve=([0, 0.05, 0.75, 1], [WH + (0,), WH + (1,), HI + (0.8,), FLOW + (0,)]),
                         extra=[F('alphaErosionDefinition', L.STRUCT, holo(T('holo_erode'), [0, 0.25, 1], [1, 0, 0])[0].value)], **WORLD))
    ems.append(V.emitter('MVG_Spot', T('light_beam'), blend=4, life=2.0, mesh=M('g_spot'), scale=(1, 1, 1), backface=True, uniform=False,
                         scale_curve=([0, 0.08, 1], [(0.2, 1, 0.2), (1, 1, 1), (1.05, 1, 1.05)]),
                         color_curve=([0, 0.06, 0.6, 1], [WH + (0,), (0.9, 1, 0.92, 0.7), (0.9, 1, 0.92, 0.6), WH + (0,)]), pass_=9230, **WORLD))
    ems.append(V.emitter('MVG_SpotPool', T('light_dot'), blend=4, life=2.0, ground=True, rotation=(-90, -90, 0), scale=(110, 110, 1),
                         color_curve=fade(WH, 0.05, 0.6, 0.6), pass_=-2690, **WORLD))
    ems.append(V.emitter('MVG_Kickoff', T('ball_sprite'), blend=1, delay=0.15, life=1.0, pos=(0, 14, 30), scale=(13, 13, 13),
                         spin=(300, 0, 0), color_curve=fade(WH, 0.05, 0.8, 1.0), pass_=9231))
    ems.append(V.emitter('MVG_KickoffRing', T('shock_ring'), blend=4, delay=0.15, life=0.5, ground=True, rotation=(-90, -90, 0),
                         scale=(30, 30, 1), scale_curve=([0, 1], [(1,) * 3, (6,) * 3]),
                         color_curve=([0, 0.1, 1], [WH + (0,), HI + (1,), FLOW + (0,)]), pass_=-2680, **WORLD))
    return ems


def sys_awake_aura(T, M, big=False):
    """R buff, awakened form: violet sparks and green-violet wisps rise from hair and shoulders."""
    k = 1.5 if big else 1.0
    return [
        V.emitter('MVG_AwakeWisp', T('light_streak'), blend=4, single=False, rate=11 * k, emitter_life=-1, life=0.6, spawn_radius=12 * k,
                  scale=V.vvec3((5.5 * k, 5.5 * k, 5.5 * k), rand=[(0.6, 1.3), None, None]), velocity=V.vvec3((0, 170, 0), rand=[None, (0.6, 1.4), None]),
                  drag=(1.0, 1.0, 1.0), direction_oriented=True, dir_scale=0.01,
                  color_curve=([0, 0.2, 0.6, 1], [VIO + (0,), LAV + (0.95,), VIO + (0.8,), HI + (0,)]), pass_=9060),
        V.emitter('MVG_AwakeSpark', T('light_dot'), blend=4, single=False, rate=7 * k, emitter_life=-1, life=0.8, spawn_radius=16 * k,
                  scale=V.vvec3((2.4, 2.4, 2.4), rand=[(0.6, 1.4), None, None]), velocity=V.vvec3((30, 120, 30), rand=[(-1, 1), (0.5, 1.3), (-1, 1)]),
                  drag=(0.8, 0.8, 0.8), color_curve=([0, 0.15, 1], [WH + (1,), LAV + (0.9,), VIO + (0,)]), pass_=9061),
    ]


DRIBBLE_T = 0.5            # seconds between two foot contacts of run_base (15 frames)


def sys_dribble(T, M, side):
    """One touch of the dribble: the ball leaves the kicking foot faster than he runs and slows down (drag), so it
    runs ahead and comes back to the other foot by the next contact (at ~345 move speed). World space, so it does
    not jump when he turns; it fades at both ends so consecutive touches blend."""
    x0 = -7.0 if side == 'L' else 7.0
    V0, D = 560.0, 2.2
    return [
        V.emitter('MVG_DribbleBall', T('ball_sprite'), blend=1, life=DRIBBLE_T + 0.04, bind=0.0, pos=(x0, 10, 22), scale=(9.5, 9.5, 9.5),
                  velocity=(-2 * x0 / DRIBBLE_T, 0, V0), drag=(0.0, 0.0, D), spin=(-520 if side == 'L' else 520, 0, 0),
                  color_curve=([0, 0.08, 0.88, 1], [WH + (0,), WH + (1,), WH + (1,), WH + (0,)]), pass_=9105),
        V.emitter('MVG_DribbleTap', T('light_dot'), blend=4, life=0.16, bind=0.0, pos=(x0, 8, 20), scale=(11, 11, 11),
                  color_curve=([0, 0.2, 1], [WH + (0.55,), HI + (0.3,), FLOW + (0,)]), pass_=9106),
    ]


EGO_Y = 238.0               # above his head, below the health bar


def _ego_sprite(name, tex, blend, pass_, color=WH + (1.0,), scale=1.0, extra_curve=None, life=-1, single=True):
    kw = dict(blend=blend, life=life, emitter_life=-1 if life == -1 else None, bind=1.0, pos=(0, EGO_Y, 0), uniform=False,
              scale=(36 * scale, 9 * scale, 1), pass_=pass_, local_orientation=False, single=single)
    if extra_curve:
        kw['color_curve'] = extra_curve
    else:
        kw['color'] = color
    return V.emitter(name, tex, **kw)


def sys_ego_frame(T, M):
    return [_ego_sprite('MVG_EgoFrame', T('g_ego_frame'), 1, 9700)]


def sys_ego_pip(T, M, k):
    return [_ego_sprite(f'MVG_EgoPip{k}', T(f'g_ego_pip{k}'), 4, 9701),
            _ego_sprite(f'MVG_EgoPipPop{k}', T(f'g_ego_pip{k}'), 4, 9702, life=0.3, scale=1.0,
                        extra_curve=([0, 0.2, 1], [WH + (1,), WH + (0.8,), WH + (0,)]))]


def sys_ego_full(T, M):
    return [_ego_sprite('MVG_EgoFlare', T('g_ego_flare'), 4, 9699, color=(0.55, 0.30, 1.0, 0.85)),
            _ego_sprite('MVG_EgoFlarePulse', T('g_ego_flare'), 4, 9698, life=0.7, single=False, scale=1.15,
                        extra_curve=([0, 0.3, 1], [HI + (0,), VIO + (0.8,), VIO + (0,)])),
            V.emitter('MVG_EgoSparks', T('light_dot'), blend=4, single=False, rate=14, emitter_life=-1, life=0.5, bind=1.0,
                      pos=(0, EGO_Y, 0), spawn_radius=30, scale=V.vvec3((2.0, 2.0, 2.0), rand=[(0.6, 1.4), None, None]),
                      velocity=V.vvec3((40, 25, 40), rand=[(-1, 1), (0.5, 1.5), (-1, 1)]), local_orientation=False,
                      color_curve=([0, 0.2, 1], [WH + (1,), LAV + (0.9,), VIO + (0,)]), pass_=9703)]


GREY = (0.75, 0.78, 0.8)


def sys_death(T, M):
    """On the head bone: whistle waves, the whistle icon, the eye glow fading out."""
    ems = []
    for j in range(3):
        ems.append(V.emitter(f'MVG_Whistle{j}', T('g_whistle_wave'), blend=4, delay=0.08 * j, life=0.55, pos=(0, 20, 0), scale=(40, 40, 1),
                             scale_curve=([0, 1], [(0.6,) * 3, (2.6,) * 3]), color_curve=([0, 0.15, 1], [WH + (0,), WH + (0.9,), GREY + (0,)]),
                             pass_=9240 + j))
    ems.append(V.emitter('MVG_WhistleIcon', T('g_whistle'), blend=1, life=1.0, pos=(0, 48, 0), scale=(16, 16, 16), velocity=(0, 40, 0),
                         scale_curve=([0, 0.12, 0.2, 1], [(0.3,) * 3, (1.25,) * 3, (1.0,) * 3, (1.0,) * 3]),
                         color_curve=fade(WH, 0.05, 0.75, 1.0), pass_=9243))
    ems.append(V.emitter('MVG_EyeFade', T('light_dot'), blend=4, life=0.8, scale=(22, 22, 22),
                         color_curve=([0, 0.1, 1], [HI + (0.9,), FLOW + (0.6,), DEEP + (0,)]), pass_=9245))
    return ems


def sys_death_ground(T, M):
    """On the ground: a grey shockwave and the ball rolling away."""
    ems = []
    ems.append(V.emitter('MVG_DeathRing', T('shock_ring'), blend=4, life=0.7, ground=True, rotation=(-90, -90, 0), scale=(50, 50, 1),
                         scale_curve=([0, 1], [(1,) * 3, (7,) * 3]), color_curve=([0, 0.1, 1], [GREY + (0,), GREY + (0.8,), GREY + (0,)]),
                         pass_=-2700, **WORLD))
    ems.append(V.emitter('MVG_RollBall', T('ball_sprite'), blend=1, delay=0.2, life=2.2, bind=0.0, pos=(0, 13, 20), scale=(13, 13, 13),
                         velocity=(0, 0, 230), drag=(0, 0, 1.1), spin=(-380, 0, 0), color_curve=fade(WH, 0.03, 0.8, 1.0), pass_=9244))
    return ems


SYSTEMS = {   # key -> (builder, kwargs)
    'MV_G_Recall': (sys_recall, {}), 'MV_G_Step': (sys_step, {}), 'MV_G_QPrint': (sys_qsteps, {}),
    'MV_G_QAura': (sys_qaura, {}), 'MV_G_QAuraBig': (sys_qaura, {'big': True}),
    'MV_G_Respawn': (sys_respawn, {}), 'MV_G_Death': (sys_death, {}), 'MV_G_DeathGround': (sys_death_ground, {}),
    'MV_G_AwakeAura': (sys_awake_aura, {}), 'MV_G_AwakeAuraBig': (sys_awake_aura, {'big': True}),
    'MV_G_DribbleL': (sys_dribble, {'side': 'L'}), 'MV_G_DribbleR': (sys_dribble, {'side': 'R'}),
    'MV_G_EgoFrame': (sys_ego_frame, {}), 'MV_G_EgoFull': (sys_ego_full, {}),
    **{f'MV_G_EgoPip{k}': (sys_ego_pip, {'k': k}) for k in range(1, 9)},
}


def _particle_event(key, start, bones, end=None):
    f = [F('mStartFrame', L.F32, float(start))]
    if end is not None:
        f.append(F('mEndFrame', L.F32, float(end)))
    f += [F('mEffectKey', L.HASH, L.fnv1a(key)),
          F('mParticleEventDataPairList', L.LIST, L.List(L.EMBED, [L.Struct('ParticleEventDataPair', [F('mBoneName', L.HASH, L.fnv1a(b))], L.EMBED)
                                                                   for b in bones]))]
    return L.Struct('ParticleEventData', f, L.STRUCT)


# ------------------------------------------------------------------ Ego stages (grows over the game)
# Stage 1 is his normal look. With every rank of his R (levels 6, 11, 16) a layer is added - Riot's
# SpellRankIntDriver (slot 3 = R) in a FloatComparisonMaterialDriver, as Jax skin 14 uses it; operator 2 like
# Samira's 'combo >= 6' (if the engine reads it as '==' only the newest layer shows - still a clean stage).
#   stage 2 (R rank 1): the jersey trims and seams glow faintly green, a soft green line under the Ego meter
#   stage 3 (R rank 2): the seams glow brighter, his boots glow green, single embers rise from his shoulders
#   stage 4 (R rank 3): violet glowing hair tips, a violet sheen on the seams, small flat violet flames on the meter
EGO_STAGES = (2, 3, 4)


def _ego_glow(b, name, submesh, tex, col, alpha):
    """Additive glow layer over his own animated mesh (Riot's attached-mesh edge glow of Yunara's Q beads as the
    template: single endless particle, locked to the animated mesh) with a texture that is black except the glow."""
    em = V.clone_emitter(b, PART + 'Yunara_Base_Q_Buff_OnBeads', 'ADD_EdgeGlow', name)
    mm = em.get('primitive').get('mMesh')
    mm.set('mSubmeshesToDraw', L.LIST, V.submesh_list([submesh])); mm.set('mLockMeshToAttachment', L.BOOL, True)
    em.remove('texDiv')
    em.set('texture', L.STRING, tex)
    em.set('birthColor', L.EMBED, V.vcolor(tuple(col) + (alpha,)))
    em.set('birthScale0', L.EMBED, V.vvec3((1.003, 1.0, 1.0)))
    em.set('pass', L.S16, 7)
    return em


def sys_ego(T, M, stage, b=None, ego=None):
    ems = []
    ego = ego or {}
    if stage == 2:
        if 'egoseams' in ego:
            ems.append(_ego_glow(b, 'MVG_Ego2Seams', 'Body', ego['egoseams'], (0.55, 1.0, 0.65), 0.35))
        ems.append(_ego_sprite('MVG_Ego2Line', T('g_ego_flare'), 4, 9696, color=FLOW + (0.35,), scale=1.05))
    elif stage == 3:
        if 'egoseams' in ego:
            ems.append(_ego_glow(b, 'MVG_Ego3Seams', 'Body', ego['egoseams'], (0.8, 1.0, 0.85), 0.3))
        ems.append(V.emitter('MVG_Ego3Embers', T('light_dot'), blend=4, single=False, rate=2.5, emitter_life=-1, life=1.0, bind=1.0,
                             pos=(0, 135, 0), spawn_radius=22, scale=V.vvec3((1.8, 1.8, 1.8), rand=[(0.6, 1.4), None, None]),
                             velocity=V.vvec3((0, 70, 0), rand=[None, (0.6, 1.4), None]), local_orientation=False,
                             color_curve=([0, 0.2, 1], [HI + (0,), HI + (0.8,), FLOW + (0,)]), pass_=9690))
    elif stage == 4:
        if 'egoseams' in ego:
            ems.append(_ego_glow(b, 'MVG_Ego4Seams', 'Body', ego['egoseams'], (0.75, 0.55, 1.0), 0.25))
        if 'egohair' in ego:
            ems.append(_ego_glow(b, 'MVG_Ego4Hair', 'Pants', ego['egohair'], (0.8, 0.55, 1.0), 0.45))
        ems.append(V.emitter('MVG_Ego4Flames', T('smoke_puff'), blend=4, single=False, rate=7, emitter_life=-1, life=0.4, bind=1.0,
                             pos=(0, EGO_Y + 1, 0), spawn_radius=30, scale=V.vvec3((6, 6, 6), rand=[(0.6, 1.4), None, None]),
                             scale_curve=([0, 1], [(1.0,) * 3, (0.3,) * 3]), velocity=V.vvec3((0, 22, 0), rand=[None, (0.5, 1.4), None]),
                             local_orientation=False, color_curve=([0, 0.25, 1], [LAV + (0,), VIO + (0.7,), VIO + (0,)]), pass_=9697))
    return ems


def sys_ego_boot(T, M):
    return [V.emitter('MVG_Ego3Boot', T('light_dot'), blend=4, life=-1, emitter_life=-1, bind=1.0, pos=(0, 4, 0), scale=(16, 16, 16),
                      color=HI + (0.45,), local_orientation=False, pass_=9691)]


def install(b, g, skin_path, resolver_path, mv, ego=None):
    """b: skin bin, g: animation graph bin, ego: {'egoseams' | 'egohair': texture path} (the Ego stage glow layers).
    Returns a summary."""
    T = lambda n: mv + 'mvfx_' + n + '.tex'
    M = lambda n: mv + 'mvfx_' + n + '.scb'
    for key, (fn, kw) in SYSTEMS.items():
        path = PART + key
        st = L.Struct('VfxSystemDefinitionData', [
            F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, fn(T, M, **kw))),
            F('particleName', L.STRING, key), F('particlePath', L.STRING, path),
            F('objectPath', L.HASH, L.fnv1a(path))], L.STRUCT)
        b.entries.append(L.Entry(path, st))
        V.add_resource(b, resolver_path, key, path)
    ego_systems = {f'MV_G_Ego{k}': sys_ego(T, M, k, b, ego) for k in EGO_STAGES}
    ego_systems['MV_G_Ego3Boot'] = sys_ego_boot(T, M)
    for key, ems in ego_systems.items():
        path = PART + key
        st = L.Struct('VfxSystemDefinitionData', [
            F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, ems)),
            F('particleName', L.STRING, key), F('particlePath', L.STRING, path),
            F('objectPath', L.HASH, L.fnv1a(path))], L.STRUCT)
        b.entries.append(L.Entry(path, st))
        V.add_resource(b, resolver_path, key, path)
    # Q buff: afterimage footprints + flow aura (head, shoulders, feet), same driver as Yunara's own Q effects
    q = L.fnv1a('Characters/Yunara/Spells/YunaraQAbility/YunaraQ')
    vfx = [('MV_G_QPrint', 'L_Buffbone_Glb_Foot_Loc'), ('MV_G_QPrint', 'R_Buffbone_Glb_Foot_Loc'),
           ('MV_G_QAuraBig', 'C_Buffbone_Glb_Head_Loc'), ('MV_G_QAura', 'L_Shoulder'), ('MV_G_QAura', 'R_Shoulder')]
    cond = L.Struct('PersistentEffectConditionData', [
        F('OwnerCondition', L.STRUCT, L.Struct('HasBuffDynamicMaterialBoolDriver', [F('Spell', L.HASH, q)], L.STRUCT)),
        F('PersistentVfxs', L.LIST2, L.List(L.EMBED, [L.Struct('PersistentVfxData', [F('boneName', L.STRING, bone), F('effectKey', L.HASH, L.fnv1a(k))], L.EMBED)
                                                      for k, bone in vfx], L.LIST2))], L.STRUCT)
    conds = b.entry(skin_path).struct.field('PersistentEffectConditions').value.items
    conds.append(cond)

    def pvfx(items):
        return F('PersistentVfxs', L.LIST2, L.List(L.EMBED, [L.Struct('PersistentVfxData', [F('boneName', L.STRING, bone),
                 F('effectKey', L.HASH, L.fnv1a(k))], L.EMBED) for k, bone in items], L.LIST2))
    # R buff: awakened aura (the glowing hair/seams/armband are the 'Awake' submesh, see build_mod)
    r_spell = L.fnv1a('Characters/Yunara/Spells/YunaraRAbility/YunaraR')
    conds.append(L.Struct('PersistentEffectConditionData', [
        F('OwnerCondition', L.STRUCT, L.Struct('HasBuffDynamicMaterialBoolDriver', [F('Spell', L.HASH, r_spell)], L.STRUCT)),
        pvfx([('MV_G_AwakeAuraBig', 'C_Buffbone_Glb_Head_Loc'), ('MV_G_AwakeAura', 'L_Shoulder'), ('MV_G_AwakeAura', 'R_Shoulder')])], L.STRUCT))
    # Ego meter: frame while alive, pip k while bead k (Yunara's 8 Q stacks, Resource_Max 8) is shown - the same
    # SubmeshVisibility + not-dead drivers Riot's own bead glows use; the flare when all 8 are up
    def not_dead():
        return L.Struct('NotMaterialDriver', [F('mDriver', L.STRUCT, L.Struct('OneTrueMaterialDriver', [
            F('mDrivers', L.LIST, L.List(L.STRUCT, [L.Struct('IsDeadDynamicMaterialBoolDriver', [], L.STRUCT)]))], L.STRUCT))], L.STRUCT)

    def bead_alive(k):
        return L.Struct('AllTrueMaterialDriver', [F('mDrivers', L.LIST, L.List(L.STRUCT, [
            L.Struct('SubmeshVisibilityBoolDriver', [F('Submeshes', L.LIST, L.List(L.HASH, [L.fnv1a(f'Bead_{k}')]))], L.STRUCT),
            not_dead()]))], L.STRUCT)
    conds.append(L.Struct('PersistentEffectConditionData', [F('OwnerCondition', L.STRUCT, not_dead()),
                                                            pvfx([('MV_G_EgoFrame', 'C_Buffbone_Glb_Layout_Loc')])], L.STRUCT))
    for k in range(1, 9):
        conds.append(L.Struct('PersistentEffectConditionData', [F('OwnerCondition', L.STRUCT, bead_alive(k)),
                                                                pvfx([(f'MV_G_EgoPip{k}', 'C_Buffbone_Glb_Layout_Loc')])], L.STRUCT))
    conds.append(L.Struct('PersistentEffectConditionData', [F('OwnerCondition', L.STRUCT, bead_alive(8)),
                                                            pvfx([('MV_G_EgoFull', 'C_Buffbone_Glb_Layout_Loc')])], L.STRUCT))

    # Ego stages: R rank >= stage - 1, while alive
    def r_rank_at_least(n):
        return L.Struct('FloatComparisonMaterialDriver', [
            F('mValueA', L.STRUCT, L.Struct('SpellRankIntDriver', [F('SpellSlot', L.U32, 3)], L.STRUCT)),
            F('mValueB', L.STRUCT, L.Struct('FloatLiteralMaterialDriver', [F('mValue', L.F32, float(n))], L.STRUCT)),
            F('mOperator', L.U32, 2)], L.STRUCT)
    for k in EGO_STAGES:
        items = [(f'MV_G_Ego{k}', 'C_Buffbone_Glb_Layout_Loc')]
        if k == 3:
            items += [('MV_G_Ego3Boot', 'L_Buffbone_Glb_Foot_Loc'), ('MV_G_Ego3Boot', 'R_Buffbone_Glb_Foot_Loc')]
        conds.append(L.Struct('PersistentEffectConditionData', [
            F('OwnerCondition', L.STRUCT, L.Struct('AllTrueMaterialDriver', [F('mDrivers', L.LIST, L.List(L.STRUCT, [
                r_rank_at_least(k - 1), not_dead()]))], L.STRUCT)),
            pvfx(items)], L.STRUCT))
    # animation events
    cm = g.entries[0].struct.field('mClipDataMap').value
    by = {k: c for k, c in cm.items}
    n = 0

    def add(clip, name, ev):
        nonlocal n
        c = by.get(L.fnv1a(clip))
        if c is None:
            print('   ! clip not in graph:', clip); return
        f = c.field('mEventDataMap')
        if f is None:
            c.fields.append(F('mEventDataMap', L.MAP, L.Map(L.HASH, L.STRUCT, [])))
            f = c.field('mEventDataMap')
        f.value.items.append((L.fnv1a(name), ev)); n += 1
    add('recall', 'MV_G_Recall', _particle_event('MV_G_Recall', 1, ['C_Buffbone_Glb_Layout_Loc'], end=RECALL_FRAMES - 1))
    for clip, sides in STEPS.items():                # clarity: chalk marks on every second step of each foot only
        for side, frames in sides.items():
            for k, fr in enumerate(frames):
                if k % 2 == 0:
                    add(clip, f'MV_G_Step_{side}{k}', _particle_event('MV_G_Step', fr, [f'{side}_Buffbone_Glb_Foot_Loc']))
    for clip in ('run_base', 'run_slow'):            # dribble: the ball is touched at every foot contact
        for side, frames in STEPS[clip].items():
            for k, fr in enumerate(frames):
                add(clip, f'MV_G_Dribble_{side}{k}', _particle_event(f'MV_G_Dribble{side}', fr, ['C_Buffbone_Glb_Layout_Loc']))
    add('respawn', 'MV_G_Respawn', _particle_event('MV_G_Respawn', 0, ['C_Buffbone_Glb_Layout_Loc']))
    add('death', 'MV_G_Death', _particle_event('MV_G_Death', 2, ['C_Buffbone_Glb_Head_Loc']))
    add('death', 'MV_G_DeathGround', _particle_event('MV_G_DeathGround', 2, ['C_Buffbone_Glb_Layout_Loc']))
    return f'{len(SYSTEMS)} systems, {n} clip events, Q aura on head + shoulders, R awakened aura, Ego meter (9 conditions), Ego stages 2-4 on the R rank'
