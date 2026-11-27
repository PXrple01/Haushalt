"""Multikill moments: quadra and penta.

How the game tells a skin about a multikill (found in Riot's data, not guessed):
  - Yunara's contextual actions (CAC, Characters/Yunara/CAC/Yunara) already have a KillChampion rule
    'Pentakill' with ContextualConditionMultikillSize 5 that plays her penta voice line (Samira, Ahri, Vi ... too).
  - A ContextualRule can also play an animation: mAnimationAction = ContextualActionPlayAnimation
    {mHashedAnimationName} (Xayah skin 38 / Rakan skin 36 start their duo recall and dance that way).
  - An animation clip with an all-zero bone mask on its own track moves nothing and does not interrupt walking or
    attacking, but its ParticleEventData still fire (Master Yi's Wuju trails are clips like that: own track
    without priority, zero mask, a real .anm, one particle event).
So: our own copy of her CAC (the skin points at it) gets a quadra rule (size 4) and her penta rule gets an
animation action; both play an invisible carrier clip on our effect track, whose particle event spawns the effect.

Never both: the quadra effect only becomes visible QUADRA_DELAY seconds after the quadra kill. If the penta comes
within that time, MV_Penta replaces MV_Quadra on the same track; the quadra particle belongs to the replaced clip
and is killed with it (ParticleEventData kill-on-end, Riot's default) before anything of it was emitted.
  quadra: a floodlight cone falls on him from high above and his Ego meter blazes up violet
  penta:  the Ego beast's true form rears up far behind him and roars, a golden trophy of light rises above him,
          stadium camera flashes everywhere, and on the owner's screen chains shoot into the corners and burst
"""
import math

import numpy as np
from PIL import Image

import lolbin as L
import vfxlib as V
import beast_anim as BA
import general_fx as G
import screen_chains as SC
import ult_beast as UB
from vfxshapes import combine, holo, fade

F = L.Field
PART = 'Characters/Yunara/Skins/Skin0/Particles/'
FLOW = (0.10, 0.65, 0.30); HI = (0.62, 0.98, 0.72); WH = (1.0, 1.0, 1.0)
VIO = (0.55, 0.30, 0.95); LAV = (0.80, 0.70, 1.0); GOLD = (1.0, 0.80, 0.35); GOLD_HI = (1.0, 0.95, 0.75)
WORLD = dict(local_orientation=False)
QUADRA_DELAY = 3.5                     # long enough that a penta right after the quadra cancels it
PENTA_DELAY = 0.5
CARRIER_ANM_CLIP = 'recall'            # the carrier clips play this clip's .anm (8.7 s) with zero bone weights
TRACK = 'MV_FxTrack'
MASK = 'MV_NoBones'
CAC_SRC = 'Characters/Yunara/CAC/Yunara'
CAC_OURS = 'Characters/Yunara/CAC/Yunara_MVFX'
QUADRA = ('MV_Quadra', 'MV_MK_Quadra')     # (carrier clip, effect key)
PENTA = ('MV_Penta', 'MV_MK_Penta')
PENTA_SCREEN = 'MV_MK_PentaScreen'
SCREEN_BURST = 1.5                     # the penta screen chains snap tight, then burst at this time


# ------------------------------------------------------------------ textures + the trophy mesh
def gold(s=256):
    """Polished gold: vertical bands of light and shade with a bright streak (wraps around the trophy)."""
    u = np.linspace(0, 1, s)[None, :].repeat(s, 0); v = np.linspace(0, 1, s)[:, None].repeat(s, 1)
    band = 0.55 + 0.25 * np.cos(u * 2 * math.pi * 3) + 0.2 * np.exp(-((u - 0.18) / 0.03) ** 2) + 0.15 * np.exp(-((u - 0.68) / 0.05) ** 2)
    band = band * (0.85 + 0.15 * np.cos(v * math.pi * 6))
    rgb = np.dstack([np.clip(band * 1.05, 0, 1), np.clip(band * 0.80, 0, 1), np.clip(band * 0.32, 0, 1)])
    return Image.fromarray((np.dstack([rgb, np.ones((s, s))]) * 255).astype(np.uint8), 'RGBA')


def gold_glow(s=256):
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    glow = np.exp(-(r / 0.45) ** 2) + 0.35 * np.exp(-(r / 0.9) ** 2) * (0.6 + 0.4 * np.cos(a * 12) ** 8)
    v = np.clip(glow, 0, 1)
    rgb = np.dstack([v, v * 0.85, v * 0.5])
    return Image.fromarray((np.dstack([rgb, v]) * 255).astype(np.uint8), 'RGBA')


def textures():
    return {'mk_gold': gold(), 'mk_gold_glow': gold_glow()}


def _lathe(profile, seg=28):
    """Surface of revolution around +y from (radius, height) points; u around, v along the profile."""
    P, U, T = [], [], []
    n = len(profile)
    for k in range(seg + 1):
        a = 2 * math.pi * k / seg
        for j, (r, y) in enumerate(profile):
            P.append((r * math.cos(a), y, r * math.sin(a))); U.append((k / seg, j / (n - 1)))
    for k in range(seg):
        for j in range(n - 1):
            i = k * n + j
            T += [(i, i + n, i + 1), (i + 1, i + n, i + n + 1)]
    return np.array(P, float), np.array(U, float), np.array(T)


def _handle(side, seg=12, ring=8, R=22.0, r=4.5, cy=112.0, cx=46.0):
    """C-shaped handle: half a torus on the side of the cup."""
    P, U, T = [], [], []
    for i in range(seg + 1):
        th = -math.pi / 2 + math.pi * i / seg
        c = np.array([side * (cx + R * math.cos(th) * 0.8), cy + R * math.sin(th), 0.0])
        d = np.array([side * math.cos(th), math.sin(th), 0.0])
        for j in range(ring + 1):
            ph = 2 * math.pi * j / ring
            P.append(c + r * (math.cos(ph) * d + math.sin(ph) * np.array([0, 0, 1.0]))); U.append((i / seg, j / ring))
    for i in range(seg):
        for j in range(ring):
            a = i * (ring + 1) + j; b = a + ring + 1
            T += [(a, b, a + 1), (a + 1, b, b + 1)]
    return np.array(P, float), np.array(U, float), np.array(T)


def meshes():
    prof = [(0.0, 0.0), (34, 0), (34, 9), (27, 12), (22, 20), (9, 28), (6, 52), (11, 60), (14, 64), (8, 70), (10, 74),
            (28, 86), (40, 104), (45, 126), (46, 146), (48, 150), (43, 150)]
    cup = _lathe(prof)
    trophy = combine([cup, _handle(1), _handle(-1)])
    return {'mvfx_mk_trophy.scb': trophy}


# ------------------------------------------------------------------ systems
def sys_quadra(T, M):
    d = QUADRA_DELAY
    ems = [
        V.emitter('MVK_QSpot', T('light_beam'), blend=4, delay=d, life=3.0, mesh=M('g_spot'), scale=(1, 1, 1), backface=True,
                  uniform=False, scale_curve=([0, 0.07, 1], [(0.15, 1, 0.15), (1, 1, 1), (1.05, 1, 1.05)]),
                  color_curve=([0, 0.05, 0.7, 1], [LAV + (0,), (0.92, 0.88, 1.0, 0.8), (0.85, 0.8, 1.0, 0.65), VIO + (0,)]),
                  pass_=9240, **WORLD),
        V.emitter('MVK_QSpotPool', T('light_dot'), blend=4, delay=d, life=3.0, ground=True, rotation=(-90, -90, 0), scale=(120, 120, 1),
                  color_curve=fade(LAV, 0.05, 0.7, 0.7), pass_=-2660, **WORLD),
        V.emitter('MVK_QDust', T('light_dot'), blend=4, single=False, rate=40, emitter_life=2.6, delay=d + 0.1, life=1.2, bind=0.0,
                  pos=(0, 60, 0), spawn_radius=70, scale=V.vvec3((1.6, 1.6, 1.6), rand=[(0.6, 1.4), None, None]),
                  velocity=V.vvec3((0, 40, 0), rand=[None, (0.3, 1.5), None]),
                  color_curve=([0, 0.3, 1], [WH + (0,), LAV + (0.9,), VIO + (0,)]), pass_=9241),
        # the Ego meter above his head blazes up violet
        V.emitter('MVK_QEgoBlaze', T('g_ego_flare'), blend=4, delay=d + 0.15, life=2.6, bind=1.0, pos=(0, G.EGO_Y, 0), uniform=False,
                  scale=(36 * 1.3, 9 * 1.2, 1), scale_curve=([0, 0.08, 0.2, 1], [(0.6, 0.6, 1), (1.25, 1.15, 1), (1.1, 1.0, 1), (1.05, 1.0, 1)]),
                  color_curve=([0, 0.06, 0.2, 0.85, 1], [VIO + (0,), WH + (1,), VIO + (0.95,), VIO + (0.85,), VIO + (0,)]),
                  pass_=9710, **WORLD),
        V.emitter('MVK_QEgoFlames', T('smoke_puff'), blend=4, single=False, rate=22, emitter_life=2.4, delay=d + 0.15, life=0.45,
                  bind=1.0, pos=(0, G.EGO_Y + 2, 0), spawn_radius=36, scale=V.vvec3((8, 8, 8), rand=[(0.6, 1.4), None, None]),
                  scale_curve=([0, 1], [(1.0,) * 3, (0.3,) * 3]), velocity=V.vvec3((0, 30, 0), rand=[None, (0.6, 1.5), None]),
                  color_curve=([0, 0.2, 1], [LAV + (0,), VIO + (0.9,), VIO + (0,)]), pass_=9711),
        V.emitter('MVK_QEgoSparks', T('light_dot'), blend=4, single=False, rate=30, emitter_life=2.4, delay=d + 0.15, life=0.6,
                  bind=1.0, pos=(0, G.EGO_Y, 0), spawn_radius=40, scale=V.vvec3((2.2, 2.2, 2.2), rand=[(0.6, 1.4), None, None]),
                  velocity=V.vvec3((60, 35, 60), rand=[(-1, 1), (0.5, 1.5), (-1, 1)]),
                  color_curve=([0, 0.2, 1], [WH + (1,), LAV + (0.9,), VIO + (0,)]), pass_=9712),
    ]
    return ems


def sys_penta(T, M):
    d = PENTA_DELAY
    anim = L.Struct('VfxPrimitiveMesh', [F('mMesh', L.EMBED, L.Struct('VfxMeshDefinitionData', [
        F('mMeshName', L.STRING, UB.BEAST_BASE + '.skn'), F('mMeshSkeletonName', L.STRING, UB.BEAST_BASE + '.skl'),
        F('mAnimationName', L.STRING, UB.BEAST_BASE + '_penta.anm')], L.EMBED))], L.STRUCT)
    bl = BA.PENTA_LENGTH
    nt = lambda t: min(max(t / bl, 0.0), 1.0)
    roar, shout = [t for t, _ in BA.penta_impacts()]
    up = BA.PENTA_BEHIND * UB.SCREEN_UP                               # its ground / head as heights above him
    head = up + 330 * BA.PENTA_SCALE
    drive = ([0, nt(0.35), nt(bl - 0.5), 1], [1.0, 0.0, 0.0, 0.9])
    ems = [
        V.emitter('MVK_PBeast', T('beast_skin2'), blend=1, delay=d, life=bl, bind=1.0, primitive=anim, scale=(1, 1, 1),
                  backface=True, pass_=9450, color_curve=([0, 0.01, 0.8, 1], [WH + (0,), (0.9, 0.85, 1.0, 0.75), (0.9, 0.85, 1.0, 0.75), VIO + (0,)]),
                  extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.6, 0.35, 1.0)), **WORLD),
        V.emitter('MVK_PBeastGlow', T('beast_glow'), blend=4, delay=d, life=bl, bind=1.0, primitive=anim, scale=(1.01, 1.01, 1.01),
                  backface=True, pass_=9451,
                  color_curve=([0, nt(roar - 0.1), nt(roar), nt(roar + 0.4), nt(shout), nt(shout + 0.5), 1],
                               [HI + (0.3,), HI + (0.6,), WH + (1,), HI + (0.6,), WH + (1,), HI + (0.6,), VIO + (0,)]),
                  extra=holo(T('holo_erode'), drive[0], drive[1], rim=(0.1, 0.5, 0.25)), **WORLD),
        V.emitter('MVK_PPool', T('shadow_ring'), blend=1, delay=d, life=bl + 0.3, bind=1.0, ground=True, rotation=(-90, -90, 0),
                  scale=(520, 520, 1), scale_curve=([0, 0.1, 1], [(0.2,) * 3, (1.0,) * 3, (1.0,) * 3]),
                  color_curve=fade(WH, 0.05, 0.85, 0.85), pass_=-2650, **WORLD),
    ]
    for j in range(3):
        for k, (t, col) in enumerate(((roar, HI), (shout, VIO))):
            ems.append(V.emitter(f'MVK_PRoar{k}_{j}', T('shock_ring'), blend=4, delay=d + t + 0.08 * j, life=0.55, bind=1.0,
                                 pos=(0, head, 0), scale=(70, 70, 1), scale_curve=([0, 1], [(1,) * 3, (6,) * 3]),
                                 color_curve=([0, 0.15, 1], [col + (0,), col + (0.9,), FLOW + (0,)]), pass_=9455 + 3 * k + j, linger=0.3))
    ems.append(V.emitter('MVK_PShock', T('shock_ring'), blend=4, delay=d + shout, life=0.7, bind=1.0, ground=True, rotation=(-90, -90, 0),
                         scale=(80, 80, 1), scale_curve=([0, 1], [(1,) * 3, (9,) * 3]),
                         color_curve=([0, 0.1, 1], [VIO + (0,), WH + (1,), VIO + (0,)]), pass_=-2645, linger=0.3, **WORLD))
    # the golden trophy of light rises above him, turning, in a gold glow with rays
    td = d + 0.9
    ems += [
        V.emitter('MVK_PTrophyGlow', T('mk_gold_glow'), blend=4, delay=td, life=3.4, bind=1.0, pos=(0, 640, 0), scale=(210, 210, 1),
                  scale_curve=([0, 0.1, 0.5, 1], [(0.2,) * 3, (1.2,) * 3, (1.0,) * 3, (1.1,) * 3]),
                  color_curve=([0, 0.08, 0.3, 0.8, 1], [GOLD + (0,), GOLD_HI + (1,), GOLD + (0.5,), GOLD + (0.45,), GOLD + (0,)]), pass_=9460),
        V.emitter('MVK_PTrophy', T('mk_gold'), blend=1, delay=td, life=3.4, bind=1.0, mesh=M('mk_trophy'), scale=(1.5, 1.5, 1.5),
                  backface=True, pos=(0, 470, 0), velocity=(0, 140, 0), drag=(2.2, 2.2, 2.2),
                  spin=(0, 110, 0), scale_curve=([0, 0.12, 1], [(0.1,) * 3, (1.0,) * 3, (1.0,) * 3]),
                  color_curve=([0, 0.06, 0.85, 1], [GOLD_HI + (0,), WH + (1,), WH + (1,), WH + (0,)]), pass_=9461, **WORLD),
        V.emitter('MVK_PTrophyShine', T('mk_gold'), blend=4, delay=td, life=3.4, bind=1.0, mesh=M('mk_trophy'), scale=(1.53, 1.53, 1.53),
                  backface=True, pos=(0, 470, 0), velocity=(0, 140, 0), drag=(2.2, 2.2, 2.2),
                  spin=(0, 110, 0), scale_curve=([0, 0.12, 1], [(0.1,) * 3, (1.0,) * 3, (1.0,) * 3]),
                  color_curve=([0, 0.06, 0.2, 1], [GOLD_HI + (0,), GOLD_HI + (0.8,), GOLD + (0.08,), GOLD + (0,)]),
                  pass_=9462, **WORLD),
        V.emitter('MVK_PTrophySparks', T('light_dot'), blend=4, single=False, rate=40, emitter_life=3.0, delay=td + 0.2, life=0.9,
                  bind=1.0, pos=(0, 650, 0), spawn_radius=90, scale=V.vvec3((2.4, 2.4, 2.4), rand=[(0.6, 1.4), None, None]),
                  velocity=V.vvec3((50, 60, 50), rand=[(-1, 1), (-0.5, 1.5), (-1, 1)]), drag=(0.8, 0.8, 0.8),
                  color_curve=([0, 0.2, 1], [WH + (1,), GOLD_HI + (0.9,), GOLD + (0,)]), pass_=9463),
    ]
    # stadium camera flashes all around
    for k, (rad, y, rate) in enumerate(((520, 220, 16), (760, 320, 12), (380, 160, 8))):
        ems.append(V.emitter(f'MVK_PFlash{k}', T('flash_star'), blend=4, single=False, rate=rate, emitter_life=3.6, delay=d + 0.6,
                             life=0.14, bind=0.0, pos=(0, y, 0), spawn_radius=rad,
                             scale=V.vvec3((16, 16, 16), rand=[(0.5, 1.4), None, None]),
                             rotation=V.vvec3((45, 0, 0), rand=[(-1, 1), None, None]),
                             color_curve=([0, 0.15, 1], [WH + (1,), WH + (0.9,), GOLD_HI + (0,)]), pass_=9470 + k))
    return ems


def sys_penta_screen(T):
    """Owner's screen: the corner chains shoot in, snap tight and burst (screen_chains' timeline, compressed)."""
    return SC.emitters(T, burst=SCREEN_BURST, glints=False, name='MVK_S', fade_held=False)


SYSTEMS = {QUADRA[1]: sys_quadra, PENTA[1]: sys_penta}


def _event(key):
    return L.Struct('ParticleEventData', [
        F('mEffectKey', L.HASH, L.fnv1a(key)),
        F('mParticleEventDataPairList', L.LIST, L.List(L.EMBED, [L.Struct('ParticleEventDataPair', [
            F('mBoneName', L.HASH, L.fnv1a('C_Buffbone_Glb_Layout_Loc'))], L.EMBED)])),
        F('mIsLoop', L.BOOL, False)], L.STRUCT)


def install(b, g, cac_bin, skin_path, resolver_path, mv):
    """b: skin bin, g: animation graph bin, cac_bin: the bin holding Yunara's CAC. Returns a summary."""
    import copy
    T = lambda n: mv + 'mvfx_' + n + '.tex'
    M = lambda n: mv + 'mvfx_' + n + '.scb'
    added = []
    for key, fn in SYSTEMS.items():
        path = PART + key
        st = L.Struct('VfxSystemDefinitionData', [
            F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, fn(T, M))),
            F('particleName', L.STRING, key), F('particlePath', L.STRING, path), F('objectPath', L.HASH, L.fnv1a(path))], L.STRUCT)
        b.entries.append(L.Entry(path, st)); V.add_resource(b, resolver_path, key, path); added.append(st)
    path = PART + PENTA_SCREEN
    st = L.Struct('VfxSystemDefinitionData', [
        F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, sys_penta_screen(T))),
        F('particleName', L.STRING, PENTA_SCREEN), F('particlePath', L.STRING, path), F('objectPath', L.HASH, L.fnv1a(path))], L.STRUCT)
    b.entries.append(L.Entry(path, st)); V.add_resource(b, resolver_path, PENTA_SCREEN, path); added.append(st)
    # penta screen chains: owner only, camera-bound, while the penta carrier clip plays (Samira's driver type)
    b.entry(skin_path).struct.field('PersistentEffectConditions').value.items.append(L.Struct('PersistentEffectConditionData', [
        F('OwnerCondition', L.STRUCT, L.Struct('IsAnimationPlayingDynamicMaterialBoolDriver', [
            F('mAnimationNames', L.LIST, L.List(L.HASH, [L.fnv1a(PENTA[0])]))], L.STRUCT)),
        F('PersistentVfxs', L.LIST2, L.List(L.EMBED, [L.Struct('PersistentVfxData', [
            F('effectKey', L.HASH, L.fnv1a(PENTA_SCREEN)), F('ShowToOwnerOnly', L.BOOL, True),
            F('AttachToCamera', L.BOOL, True)], L.EMBED)], L.LIST2))], L.STRUCT))
    # animation graph: effect track, zero-weight mask, two invisible carrier clips
    gs = g.entries[0].struct
    masks = gs.field('mMaskDataMap').value
    mask = copy.deepcopy(masks.items[0][1])                           # same struct / list types as hers
    mask.get('mWeightList').items = [0.0] * len(mask.get('mWeightList').items)
    masks.items.append((L.fnv1a(MASK), mask))
    tracks = gs.field('mTrackDataMap').value
    track = copy.deepcopy(tracks.items[0][1]); track.fields = []      # like Yi's effect track: no priority
    tracks.items.append((L.fnv1a(TRACK), track))
    cm = gs.field('mClipDataMap').value
    src_clip = dict(cm.items)[L.fnv1a(CARRIER_ANM_CLIP)]
    track_type = next(c.field('mTrackDataName').type for _, c in cm.items if c.field('mTrackDataName') is not None)
    for clip, key in (QUADRA, PENTA):
        res = copy.deepcopy(src_clip.field('mAnimationResourceData'))
        cm.items.append((L.fnv1a(clip), L.Struct('AtomicClipData', [
            F('mTrackDataName', track_type, L.fnv1a(TRACK)), F('mMaskDataName', track_type, L.fnv1a(MASK)),
            F('mEventDataMap', L.MAP, L.Map(L.HASH, L.STRUCT, [(L.fnv1a('MV_K_' + clip), _event(key))])),
            res], src_clip.kind)))
    # contextual actions: our copy of hers, with the multikill rules playing the carrier clips
    src = cac_bin.entry(CAC_SRC)
    cac = copy.deepcopy(src.struct)
    cac.set('mObjectPath', L.STRING, CAC_OURS)
    sits = cac.get('mSituations')
    kill = dict(sits.items)[L.fnv1a('KillChampion')]
    rules = kill.get('mRules').items
    penta = next(r for r in rules if r.get('mRuleName') == 'Pentakill')
    general = next(r for r in rules if r.get('mRuleName') == 'General')

    def play(clip):
        return F('mAnimationAction', L.STRUCT, L.Struct('ContextualActionPlayAnimation', [
            F('mHashedAnimationName', L.HASH, L.fnv1a(clip))], L.STRUCT))
    quadra = copy.deepcopy(general)
    quadra.set('mRuleName', L.STRING, 'MV_Quadrakill')
    quadra.fields.insert(1, copy.deepcopy(penta.field('mConditions')))
    quadra.get('mConditions').items[0].set('mMultikillSize', L.U8, 4)
    quadra.field('mPriority').value.value = 150
    quadra.fields.append(play(QUADRA[0]))
    penta.fields.append(play(PENTA[0]))
    rules.insert(rules.index(penta) + 1, quadra)
    b.entries.append(L.Entry(CAC_OURS, cac))
    skin = b.entry(skin_path).struct
    skin.field('mContextualActionData').value = L.fnv1a(CAC_OURS)
    return added, f'quadra (after {QUADRA_DELAY} s, cancelled by a penta) + penta, carrier clips on {TRACK}, CAC rules'
