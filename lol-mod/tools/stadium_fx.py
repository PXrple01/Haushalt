"""METAVISION 'virtual stadium' for the ult cast (all hologram green, like the Flow effects).

Timeline (seconds after R, matching the chains/eye sequence in build_mod.step_ult_cast):
  0.30  the chains burst: a refraction shockwave; four floodlight towers grow out of the ground
  0.70  the floodlights switch on: light cones onto the striker, phone flashes twinkle all around
  0.55  five hologram defenders build up from the feet, scanner rings slide over them,
  1.12  lock-on markers snap onto their heads, 1.72 they shatter into shards
  1.95  a hologram goal builds up in front, 2.20 a football is volleyed into it,
  2.38  the net bulges, flash + refraction + confetti; everything dissolves until ~3.2
Meshes: defender + floodlight tower made with Meshy (assets_src/vfx/*.npz, see tools/char/vfx_mesh.py),
goal frame / net / light cones / ball built here."""
import os

import numpy as np

import lolbin as L
import make_assets
import vfxlib as V

F = L.Field
FLOW = (0.10, 0.65, 0.30); DEEP = (0.02, 0.36, 0.16); HI = (0.62, 0.98, 0.72); RIM = (0.45, 1.0, 0.62)
TOWER_R, TOWER_ANGLES = 560.0, (45.0, 135.0, 225.0, 315.0)
DEF_R, DEF_ANGLES = 270.0, tuple(90.0 + 72.0 * k for k in range(5))
GOAL_Z, GOAL_W, GOAL_H, GOAL_D = 440.0, 300.0, 160.0, 90.0


# ------------------------------------------------------------------ geometry helpers
def ring_pos(r, deg):
    a = np.radians(deg)
    return np.array([r * np.cos(a), 0.0, r * np.sin(a)])


def face_center(P, at):
    """Rotate a mesh whose front is +z about y so it faces the origin, then move it to `at`."""
    f = -at / max(np.linalg.norm(at), 1e-6)
    th = np.arctan2(f[0], f[2]); c, s = np.cos(th), np.sin(th)
    Q = P.copy()
    Q[:, 0], Q[:, 2] = c * P[:, 0] + s * P[:, 2], -s * P[:, 0] + c * P[:, 2]
    return Q + at


def combine(parts):
    pos, uv, tris, n = [], [], [], 0
    for P, U, T in parts:
        pos.append(P); uv.append(U); tris.append(T + n); n += len(P)
    return np.concatenate(pos).astype(np.float32), np.concatenate(uv).astype(np.float32), np.concatenate(tris).astype(np.int64)


def box(c, size):
    """Axis-aligned box (12 tris) with planar uvs."""
    c = np.asarray(c, float); h = np.asarray(size, float) / 2
    corners = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], float) * h + c
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    P, U, T = [], [], []
    for f in faces:
        b = len(P)
        P += [corners[i] for i in f]; U += [(0, 0), (1, 0), (1, 1), (0, 1)]
        T += [(b, b + 1, b + 2), (b, b + 2, b + 3)]
    return np.array(P), np.array(U, float), np.array(T)


def quad(p0, p1, p2, p3, uv=((0, 0), (1, 0), (1, 1), (0, 1))):
    return np.array([p0, p1, p2, p3], float), np.array(uv, float), np.array([(0, 1, 2), (0, 2, 3)])


def cone(a, b, ra, rb, seg=20):
    """Open cone from a (radius ra, v=0) to b (radius rb, v=1)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = (b - a) / np.linalg.norm(b - a)
    t = np.cross(d, [0, 1, 0]); t = t / np.linalg.norm(t) if np.linalg.norm(t) > 1e-6 else np.array([1, 0, 0])
    w = np.cross(d, t)
    P, U = [], []
    for k in range(seg + 1):
        ang = 2 * np.pi * k / seg; ring = np.cos(ang) * t + np.sin(ang) * w
        P += [a + ring * ra, b + ring * rb]; U += [(k / seg, 0.0), (k / seg, 1.0)]
    T = []
    for k in range(seg):
        i = 2 * k
        T += [(i, i + 2, i + 1), (i + 1, i + 2, i + 3)]
    return np.array(P), np.array(U), np.array(T)


def load_vfx_mesh(root, name):
    d = np.load(os.path.join(root, 'assets_src', 'vfx', name + '.npz'))
    return d['pos'].astype(float), d['uv'].astype(float), d['tris'].astype(np.int64)


def lamp_points():
    """Centre of each floodlight's lamp panel (tower local: panel around y 385, overhanging +z)."""
    out = []
    for a in TOWER_ANGLES:
        p = face_center(np.array([[0.0, 385.0, 70.0]]), ring_pos(TOWER_R, a))[0]
        out.append(p)
    return out


def meshes(root):
    """game path suffix -> (pos, uv, tris) for every mesh of the stadium."""
    tw = load_vfx_mesh(root, 'floodlight')
    towers = combine([(face_center(tw[0], ring_pos(TOWER_R, a)), tw[1], tw[2]) for a in TOWER_ANGLES])
    df = load_vfx_mesh(root, 'defender')
    defenders = combine([(face_center(df[0], ring_pos(DEF_R, a)), df[1], df[2]) for a in DEF_ANGLES])
    beams = combine([cone(lp, np.array([lp[0], 0, lp[2]]) * 0.12, 16.0, 95.0) for lp in lamp_points()])
    W, H, D = GOAL_W / 2, GOAL_H, GOAL_D
    r = 5.0
    frame = combine([box((-W, H / 2, 0), (2 * r, H, 2 * r)), box((W, H / 2, 0), (2 * r, H, 2 * r)),
                     box((0, H, 0), (2 * W + 2 * r, 2 * r, 2 * r)),
                     box((-W, H * 0.75, D * 0.5), (r * 1.2, r * 1.2, D)), box((W, H * 0.75, D * 0.5), (r * 1.2, r * 1.2, D)),
                     box((0, r * 0.6, D), (2 * W, r * 1.2, r * 1.2)), box((-W, r * 0.6, D * 0.5), (r * 1.2, r * 1.2, D)),
                     box((W, r * 0.6, D * 0.5), (r * 1.2, r * 1.2, D))])
    net = combine([quad((-W, 0, D), (W, 0, D), (W, H * 0.92, D), (-W, H * 0.92, D), ((0, 1), (2, 1), (2, 0), (0, 0))),
                   quad((-W, H, 0), (W, H, 0), (W, H * 0.92, D), (-W, H * 0.92, D), ((0, 0), (2, 0), (2, 0.6), (0, 0.6))),
                   quad((-W, 0, 0), (-W, 0, D), (-W, H * 0.92, D), (-W, H, 0), ((0, 1), (0.6, 1), (0.6, 0), (0, 0))),
                   quad((W, 0, 0), (W, 0, D), (W, H * 0.92, D), (W, H, 0), ((0, 1), (0.6, 1), (0.6, 0), (0, 0)))])
    bp, bn, bu, bt = make_assets.uv_sphere(13.5, seg=24, rings=16)
    ball = (np.asarray(bp, float), np.asarray(bu, float), np.asarray(bt, np.int64).reshape(-1, 3))
    return {'mvfx_stadium_towers.scb': towers, 'mvfx_stadium_defenders.scb': defenders,
            'mvfx_stadium_beams.scb': beams, 'mvfx_goal_frame.scb': frame, 'mvfx_goal_net.scb': net,
            'mvfx_shot_ball.scb': ball}


TEXTURES = ['holo_body', 'holo_erode', 'light_beam', 'holo_shard', 'scan_ring', 'goal_net']


# ------------------------------------------------------------------ emitter helpers
def holo(erode_tex, drive_t, drive_v, rim=RIM):
    """Hologram look: Riot's alpha erosion (build-up / dissolve) + fresnel rim (as on Yunara's EdgeGlow)."""
    ero = L.Struct('VfxAlphaErosionDefinitionData', [
        F('erosionDriveCurve', L.EMBED, V.vfloat(drive_v[0], drive_t, drive_v)),
        F('erosionFeatherIn', L.F32, 0.03), F('erosionFeatherOut', L.F32, 0.03),
        F('erosionMapName', L.STRING, erode_tex),
        F('erosionMapChannelMixer', L.EMBED, V.vcolor((1.0, 0.0, 0.0, 0.0))),
        F('erosionMapAddressMode', L.U8, 0)], L.STRUCT)
    refl = L.Struct('VfxReflectionDefinitionData', [F('fresnelColor', L.VEC4, tuple(rim) + (0.0,))], L.STRUCT)
    return [F('alphaErosionDefinition', L.STRUCT, ero), F('reflectionDefinition', L.STRUCT, refl)]


def flat_quad():
    """World-aligned horizontal quad (not camera facing, not glued to the terrain)."""
    return [F('primitive', L.STRUCT, L.Struct('VfxPrimitiveArbitraryQuad', [], L.STRUCT)),
            F('disableBackfaceCull', L.BOOL, True)]


def fade(c, t_in=0.08, t_out=0.85, a=1.0):
    return ([0.0, t_in, t_out, 1.0], [tuple(c) + (0.0,), tuple(c) + (a,), tuple(c) + (a,), tuple(c) + (0.0,)])


def emitters(MV, distort_template):
    T = lambda n: MV + 'mvfx_' + n + '.tex'
    M = lambda n: MV + 'mvfx_' + n + '.scb'
    ERODE = T('holo_erode')
    ems = []
    # ---- 0.30 refraction shockwave of the chain burst
    if distort_template is not None:
        ems.append(distortion(distort_template, 'MV_BurstDistort', 0.30, (0, 110, 0), 3.2, 0.5))
    # ---- floodlight towers grow out of the ground, light up, cast cones
    T0, TL = 0.30, 2.85
    rise = ([0.0, 0.11, 0.15, 1.0], [(1, 0.02, 1), (1, 1.05, 1), (1, 1, 1), (1, 1, 1)])
    ems.append(V.emitter('MV_StadiumTowers', T('holo_body'), blend=4, delay=T0, life=TL, bind=0.0, mesh=M('stadium_towers'),
                         scale=(1, 1, 1), uniform=False, scale_curve=rise, backface=True, pass_=9200,
                         color_curve=fade(tuple(x * 0.9 for x in FLOW), 0.05, 0.9, 0.85),
                         extra=holo(ERODE, [0.0, 0.10, 0.88, 1.0], [0.9, 0.0, 0.0, 1.0])))
    for k, lp in enumerate(lamp_points()):
        ems.append(V.emitter(f'MV_LampOn{k}', T('flash_star'), blend=4, delay=0.68 + 0.035 * k, life=0.45, bind=0.0,
                             pos=tuple(lp), scale=(130, 130, 1), scale_curve=([0, 0.2, 1], [(0.3,) * 3, (1.3,) * 3, (0.9,) * 3]),
                             color_curve=([0, 0.15, 1], [(1, 1, 1, 1), HI + (0.9,), FLOW + (0.0,)]), pass_=9210 + k))
        ems.append(V.emitter(f'MV_LampGlow{k}', T('light_dot'), blend=4, delay=0.72 + 0.035 * k, life=2.0, bind=0.0,
                             pos=tuple(lp), scale=(85, 85, 1),
                             color_curve=([0, 0.06, 0.5, 0.52, 0.56, 0.9, 1], [HI + (0,), HI + (0.9,), HI + (0.9,), HI + (0.45,),
                                                                             HI + (0.9,), HI + (0.9,), HI + (0,)]), pass_=9215 + k))
    # beams switch on with a short stadium-light flicker, then stay
    flick = ([0.0, 0.02, 0.04, 0.06, 0.09, 0.12, 0.82, 1.0],
             [HI + (0.0,), HI + (0.5,), HI + (0.1,), HI + (0.6,), HI + (0.25,), HI + (0.55,), HI + (0.55,), HI + (0.0,)])
    ems.append(V.emitter('MV_StadiumBeams', T('light_beam'), blend=4, delay=0.74, life=2.0, bind=0.0, mesh=M('stadium_beams'),
                         scale=(1, 1, 1), backface=True, pass_=9220, color_curve=flick))
    # the light pool where the four beams meet
    ems.append(V.emitter('MV_SpotlightPool', T('light_dot'), blend=4, delay=0.80, life=1.95, bind=0.0, ground=True,
                         rotation=(-90, -90, 0), scale=(150, 150, 1), pass_=-2880,
                         scale_curve=([0, 0.1, 1], [(0.6,) * 3, (1.0,) * 3, (1.05,) * 3]),
                         color_curve=([0, 0.08, 0.85, 1], [HI + (0,), HI + (0.7,), HI + (0.6,), HI + (0,)])))
    # phone flashes in the stands (8 sections between the towers)
    for k in range(8):
        p = ring_pos(TOWER_R * 1.08, 22.5 + 45 * k)
        ems.append(V.emitter(f'MV_CrowdFlash{k}', T('flash_star'), blend=4, single=False, rate=11, emitter_life=1.8,
                             delay=0.80, life=0.13, bind=0.0, pos=(p[0], 40, p[2]),
                             scale=V.vvec3((16, 16, 1), rand=[(0.6, 1.4), None, None]),
                             velocity=V.vvec3((0, 1, 0), rand=[None, (0, 1), None]),
                             extra=[F('SpawnShape', L.STRUCT, L.Struct('VfxShapeBox', [F('Size', L.VEC3, (150.0, 120.0, 150.0))], L.STRUCT))],
                             color_curve=([0, 0.3, 1], [(1, 1, 1, 1), HI + (0.8,), FLOW + (0,)]), pass_=9230 + k))
    # ---- hologram defenders: build-up, scanner rings, lock-on, shatter
    D0, DL = 0.55, 1.30
    ems.append(V.emitter('MV_Defenders', T('holo_body'), blend=4, delay=D0, life=DL, bind=0.0, mesh=M('stadium_defenders'),
                         scale=(1, 1, 1), pass_=9240, backface=True, color_curve=fade(FLOW, 0.04, 0.9, 0.9),
                         extra=holo(ERODE, [0.0, 0.28, 0.88, 1.0], [1.0, 0.0, 0.0, 1.0])))
    for k, a in enumerate(DEF_ANGLES):
        p = ring_pos(DEF_R, a)
        ems.append(V.emitter(f'MV_DefScan{k}', T('scan_ring'), blend=4, single=False, rate=2.4, emitter_life=0.85,
                             delay=D0 + 0.03, life=0.55, bind=0.0, pos=(p[0], 4, p[2]), rotation=(-90, -90, 0),
                             scale=(62, 62, 1), velocity=(0, 360, 0), pass_=9250 + k, extra=flat_quad(),
                             color_curve=([0, 0.1, 0.8, 1], [HI + (0,), HI + (1,), FLOW + (0.8,), FLOW + (0,)])))
        ems.append(V.emitter(f'MV_DefLock{k}', T('reticle'), blend=4, delay=1.12 + 0.04 * k, life=0.62 - 0.04 * k, bind=0.0,
                             pos=(p[0], 228, p[2]), scale=(44, 44, 1), spin=(140, 0, 0),
                             scale_curve=([0, 0.2, 1], [(2.3,) * 3, (1.0,) * 3, (0.92,) * 3]),
                             color_curve=([0, 0.12, 0.3, 0.42, 0.85, 1], [(1, 1, 1, 0), (1, 1, 1, 1), HI + (1,), (1, 1, 1, 1),
                                                                         HI + (1,), FLOW + (0,)]), pass_=9260 + k))
        ems.append(V.emitter(f'MV_DefFlash{k}', T('flash_star'), blend=4, delay=1.70, life=0.3, bind=0.0,
                             pos=(p[0], 110, p[2]), scale=(85, 85, 1), scale_curve=([0, 0.25, 1], [(0.4,) * 3, (1.3,) * 3, (1.6,) * 3]),
                             color_curve=([0, 0.2, 1], [(1, 1, 1, 1), HI + (0.8,), FLOW + (0,)]), pass_=9270 + k))
        ems.append(V.emitter(f'MV_DefShards{k}', T('holo_shard'), blend=4, single=False, rate=900, emitter_life=0.03,
                             delay=1.72, life=0.75, bind=0.0, pos=(p[0], 100, p[2]), spawn_radius=40,
                             scale=V.vvec3((9, 9, 9), rand=[(0.5, 1.5), None, None]),
                             velocity=V.vvec3((420, 520, 420), rand=[(-1, 1), (0.2, 1.0), (-1, 1)]),
                             accel=(0, -1300, 0), drag=(1.2, 1.2, 1.2), spin=V.vvec3((720, 0, 0), rand=[(-1, 1), None, None]),
                             color_curve=([0, 0.15, 0.7, 1], [(1, 1, 1, 1), HI + (1,), FLOW + (0.8,), DEEP + (0,)]), pass_=9280 + k))
    # ---- hologram goal, volley, net bulge
    G0, GL = 1.95, 1.25
    IMPACT = 2.38
    rel = (IMPACT - G0) / GL
    bulge = ([0.0, rel - 0.01, rel + 0.04, rel + 0.16, 1.0], [(1, 1, 1), (1, 1, 1), (1, 1, 1.45), (1, 1, 1), (1, 1, 1)])
    ems.append(V.emitter('MV_GoalFrame', T('holo_body'), blend=4, delay=G0, life=GL, bind=0.0, mesh=M('goal_frame'),
                         pos=(0, 0, GOAL_Z), scale=(1, 1, 1), pass_=9300, backface=True,
                         color_curve=fade(tuple(min(1, x * 1.3) for x in FLOW), 0.04, 0.9, 1.0),
                         extra=holo(ERODE, [0.0, 0.18, 0.86, 1.0], [1.0, 0.0, 0.0, 1.0])))
    ems.append(V.emitter('MV_GoalNet', T('goal_net'), blend=4, delay=G0, life=GL, bind=0.0, mesh=M('goal_net'),
                         pos=(0, 0, GOAL_Z), scale=(1, 1, 1), uniform=False, scale_curve=bulge, backface=True, pass_=9301,
                         color_curve=([0, 0.15, rel, rel + 0.05, 0.25 + rel, 0.88, 1],
                                      [FLOW + (0,), FLOW + (0.75,), FLOW + (0.75,), HI + (1,), FLOW + (0.75,), FLOW + (0.6,), FLOW + (0,)]),
                         extra=holo(ERODE, [0.0, 0.2, 0.86, 1.0], [1.0, 0.0, 0.0, 1.0])))
    SHOT = 2.20; start = np.array([22.0, 55.0, 45.0]); end = np.array([0.0, 95.0, GOAL_Z + GOAL_D * 0.7])
    vel = (end - start) / (IMPACT - SHOT)
    ems.append(V.emitter('MV_ShotKick', T('flash_star'), blend=4, delay=SHOT, life=0.22, bind=0.0, pos=tuple(start),
                         scale=(60, 60, 1), color_curve=([0, 0.3, 1], [(1, 1, 1, 1), HI + (0.8,), FLOW + (0,)]), pass_=9310))
    ems.append(V.emitter('MV_ShotBall', T('ball_albedo'), blend=1, delay=SHOT, life=IMPACT - SHOT, bind=0.0, pos=tuple(start),
                         mesh=M('shot_ball'), scale=(1.1, 1.1, 1.1), velocity=tuple(vel), spin=(-2400, 0, 0), pass_=9311,
                         backface=True,
                         color_curve=([0, 0.9, 1], [(1, 1, 1, 1), (1, 1, 1, 1), (1, 1, 1, 0)])))
    ems.append(V.emitter('MV_ShotStreak', T('light_streak'), blend=4, delay=SHOT, life=IMPACT - SHOT, bind=0.0, pos=tuple(start),
                         scale=(16, 16, 16), velocity=tuple(vel), direction_oriented=True, dir_scale=0.0009, pass_=9312,
                         color_curve=([0, 1], [HI + (1,), FLOW + (0.6,)])))
    ems.append(V.emitter('MV_ShotSparks', T('light_dot'), blend=4, single=False, rate=420, emitter_life=IMPACT - SHOT,
                         delay=SHOT, life=0.35, bind=0.0, pos=tuple(start), velocity=tuple(vel * 0.92), drag=(5, 5, 5),
                         scale=(5, 5, 5), direction_oriented=True, dir_scale=0.004, pass_=9313,
                         color_curve=([0, 1], [HI + (1,), DEEP + (0,)])))
    hit = (0.0, 95.0, GOAL_Z + GOAL_D * 0.75)
    ems.append(V.emitter('MV_GoalFlash', T('flash_star'), blend=4, delay=IMPACT, life=0.4, bind=0.0, pos=hit,
                         scale=(150, 150, 1), scale_curve=([0, 0.2, 1], [(0.4,) * 3, (1.4,) * 3, (1.8,) * 3]),
                         color_curve=([0, 0.2, 1], [(1, 1, 1, 1), HI + (0.9,), FLOW + (0,)]), pass_=9320))
    ems.append(V.emitter('MV_GoalRing', T('shock_ring'), blend=4, delay=IMPACT, life=0.5, bind=0.0, pos=hit,
                         scale=(45, 45, 1), scale_curve=([0, 1], [(1,) * 3, (6.5,) * 3]),
                         color_curve=([0, 0.15, 1], [HI + (0,), FLOW + (1,), DEEP + (0,)]), pass_=9321))
    ems.append(V.emitter('MV_GoalConfetti', T('holo_shard'), blend=4, single=False, rate=1400, emitter_life=0.04,
                         delay=IMPACT, life=1.1, bind=0.0, pos=hit, spawn_radius=30,
                         scale=V.vvec3((7, 7, 7), rand=[(0.5, 1.4), None, None]),
                         velocity=V.vvec3((700, 900, 500), rand=[(-1, 1), (0.1, 1.0), (-1, 0.6)]),
                         accel=(0, -1100, 0), drag=(1.6, 1.6, 1.6), spin=V.vvec3((900, 0, 0), rand=[(-1, 1), None, None]),
                         color_curve=([0, 0.1, 0.75, 1], [(1, 1, 1, 1), HI + (1,), FLOW + (0.8,), DEEP + (0,)]), pass_=9322))
    ems.append(V.emitter('MV_GoalLightLines', T('light_dot'), blend=4, single=False, rate=900, emitter_life=0.04,
                         delay=IMPACT, life=0.45, bind=0.0, pos=hit, scale=(6, 6, 6),
                         velocity=V.vvec3((1300, 1000, 1300), rand=[(-1, 1), (-0.3, 1), (-1, 1)]), drag=(3, 3, 3),
                         direction_oriented=True, dir_scale=0.005, pass_=9323,
                         color_curve=([0, 0.5, 1], [HI + (1,), FLOW + (0.9,), DEEP + (0,)])))
    if distort_template is not None:
        ems.append(distortion(distort_template, 'MV_GoalDistort', IMPACT, hit, 2.4, 0.45))
    return ems


def distortion(template, name, delay, pos, scale_mult, life):
    """Riot's own refraction emitter (Yunara's crit hit), re-timed and re-sized."""
    import copy
    em = copy.deepcopy(template)
    em.set('emitterName', L.STRING, name)
    em.set('timeBeforeFirstEmission', L.F32, float(delay))
    em.set('EmitterPosition', L.EMBED, V.vvec3(pos))
    em.set('bindWeight', L.EMBED, V.vfloat(0.0))
    em.set('particleLifetime', L.EMBED, V.vfloat(life))
    bs = em.field('birthScale0')
    if bs is not None:
        cv = bs.value.field('constantValue')
        if cv is not None:
            cv.value = tuple(float(x) * scale_mult for x in cv.value)
    return em
