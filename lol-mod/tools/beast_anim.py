"""Animated Ego beast for the 'beast' ult: Meshy's rigged + animated monster (tools/char/beast_extract.py) turned into
a League animated mesh particle (.skn + .skl + .anm, like Riot's VfxPrimitiveMesh with mMeshSkeletonName /
mAnimationName - Aurora's dance spirits, Ambessa's R swipe, ...).

League space: Blender (x, y, z) -> (-x, z, y) * scale, so the beast faces -z (the camera) in a world-oriented
particle, +y up. An extra root joint carries the choreography on top of the Meshy clips (rise out of the pool,
lunge into the striker, shrink), so the whole performance is one clip that plays once from particle birth.
"""
import math
import os

import numpy as np

import lolrig as R
import lolskn

FPS = 30.0
HEIGHT = 430.0                     # standing height in League units (the striker is ~200)
BEHIND = 160.0                     # starts this far behind him (+z)
C = np.array([[-1.0, 0, 0], [0, 0, 1.0], [0, 1.0, 0]])
ROOT = 'MV_BeastRoot'


class Beast:
    def __init__(self, npz):
        d = np.load(npz)
        self.names = [str(n) for n in d['names']]
        self.parents = [int(p) for p in d['parents']]
        P = d['pos']
        self.scale = HEIGHT / float(np.ptp(P[:, 2]))
        self.rest = np.array([self.conv(m) for m in d['rest']])
        self.pos = (P @ C.T) * self.scale
        self.pos[:, 1] -= self.pos[:, 1].min()
        self.lift = -(P[:, 2].min() * self.scale)          # feet on y = 0
        self.rest[:, 1, 3] += self.lift
        self.nrm = d['nrm'] @ C.T
        self.uv = d['uv'].astype(np.float64); self.tris = d['tris'].astype(np.int64)
        self.infl = d['infl'].astype(np.int64); self.w = d['w'].astype(np.float64)
        self.clips = {}
        for k in d.files:
            if k.startswith('clip_'):
                g = np.array([[self.conv(m) for m in fr] for fr in d[k]])
                g[:, :, 1, 3] += self.lift
                self.clips[k[5:]] = g                      # (frames @ 24 fps, joints, 4, 4) world

    def conv(self, M):
        out = np.eye(4)
        out[:3, :3] = C @ M[:3, :3] @ C.T
        out[:3, 3] = (C @ M[:3, 3]) * self.scale
        return out

    # ---------------------------------------------------------------- clip sampling (local TRS per joint)
    def local_trs(self, G):
        out = []
        for i, p in enumerate(self.parents):
            L = G[i] if p < 0 else np.linalg.inv(G[p]) @ G[i]
            out.append(R.mat_to_trs(L))
        return out

    def sample(self, clip, t, src_fps=24.0):
        g = self.clips[clip]
        if clip in LOOPED:
            x = (t * src_fps) % (len(g) - 1)
        else:
            x = min(max(t * src_fps, 0), len(g) - 1)
        a = int(math.floor(x)); b = min(a + 1, len(g) - 1); f = x - a
        A, B = self.local_trs(g[a]), self.local_trs(g[b])
        out = [blend(ta, tb, f) for ta, tb in zip(A, B)]
        if clip in LOOPED:                              # Meshy's walk carries its hips ~12 higher than the other clips
            t0, s0, q0 = out[0]; out[0] = (t0 + np.array([0, -12.0, 0]), s0, q0)
        return out


def slerp(q0, q1, f):
    q0, q1 = np.asarray(q0, float), np.asarray(q1, float)
    d = float(np.dot(q0, q1))
    if d < 0:
        q1, d = -q1, -d
    if d > 0.9995:
        q = q0 + f * (q1 - q0)
    else:
        th = math.acos(d); s = math.sin(th)
        q = (math.sin((1 - f) * th) * q0 + math.sin(f * th) * q1) / s
    return q / np.linalg.norm(q)


def blend(a, b, f):
    return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, slerp(a[2], b[2], f))


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- choreography
# The beast lives for the whole ult (the R buff lasts 15 s). Segments follow each other with 0.15 s cross-fades:
# (clip, start s in the clip, length s in the clip, speed, label for synced effects, x it walks to or None)
# Walks are Meshy's in-place walk cycle; the root carries it sideways behind him (prowling like a caged animal),
# turned towards where it goes and back to face the camera afterwards. On top of every clip runs a procedural layer
# (breathing, weight shifts, head looking around, arm sway) so it is never frozen.
WALK_SPEED = 264.0                 # League units per second of Meshy's walk cycle at speed 1
PROWL_X = 120.0
SEQUENCE = [   # the big actions happen right behind him (x 0), the calm watching out at his sides
    ('arise', 0.75, 1.08, 1.8, 'rise', None),       # claws its way up out of the pool, from all fours to standing
    ('scream', 0.55, 1.45, 1.65, 'roar', None),     # rears up, crouches wide and roars
    ('alert', 0.0, 1.4, 1.15, None, None),          # crouched, menacing, looks around
    ('walk', 0.0, None, None, 'prowl', -PROWL_X),   # prowls out to his left side ...
    ('look', 0.6, 1.5, 1.25, None, None),           # ... breathes heavily, watches the field
    ('walk', 0.3, None, None, 'prowl', 0.0),        # prowls back behind him
    ('pound', 1.38, 1.37, 1.4, 'pound', None),      # beats its chest
    ('stomp2', 0.0, 1.4, 1.4, 'stomp', None),       # stamps the ground twice
    ('walk', 0.6, None, None, 'prowl', PROWL_X),    # prowls out to his right side ...
    ('alert', 2.0, 1.4, 1.15, None, None),          # ... crouched, menacing
    ('walk', 0.1, None, None, 'prowl', 0.0),        # back behind him
    ('swipe', 0.0, 1.0, 1.0, 'swipe', None),        # rips the air with an uppercut claw
    ('shout', 2.3, 1.9, 1.45, 'shout', None),       # spreads its arms and bellows
    ('look', 3.0, 1.0, 1.0, None, None),
    ('stomp', 0.0, 1.4, 1.4, 'stomp', None),        # angry ground stomp
    ('idle', 0.0, None, 1.0, None, None),           # crouches, ready ... (length fills up to LENGTH)
    ('slam', 0.55, 1.55, 2.0, 'dive', None),        # ... and hurls itself head first into the striker
]
LOOPED = {'walk'}
FADE = 0.15
TURN = 0.3                         # seconds to turn towards / away from a walk
WALK_YAW = 72.0                    # walking sideways, still a little towards the camera
RISE = 0.45                        # seconds to climb out of the ground
DIVE = 0.55                        # last seconds: lunge into the striker and shrink away
LENGTH = 14.95                     # the R buff (15 s) ends right after


PROWL = 0.45                       # walk cycle speed while prowling (~119 units / s)


def _segments():
    """Resolve walk segments (their length follows from the distance) and the filler idle (fills up to LENGTH)."""
    x, out = 0.0, []
    for clip, s0, ln, sp, label, to in SEQUENCE:
        if to is not None:
            sp = PROWL
            d = abs(to - x) / (WALK_SPEED * sp)
            ln = d * sp
            out.append((clip, s0, ln, sp, label, x, to)); x = to
        else:
            out.append((clip, s0, ln, sp, label, x, x))
    fixed = sum(ln / sp for clip, s0, ln, sp, *_ in out if ln is not None) - FADE * (len(out) - 1)
    out = [(c, s0, (LENGTH - fixed) * sp if ln is None else ln, sp, lb, x0, x1) for c, s0, ln, sp, lb, x0, x1 in out]
    return out


def timeline():
    """[(start, end, clip, clip start, speed, label, x from, x to)], total."""
    segs = _segments()
    t, out = 0.0, []
    for clip, s0, ln, sp, label, x0, x1 in segs:
        d = ln / sp
        out.append((t, t + d, clip, s0, sp, label, x0, x1)); t += d - FADE
    total = t + FADE
    if abs(total - LENGTH) > 0.06:
        raise ValueError(f'choreography is {total:.2f} s, expected {LENGTH} s')
    return out, total


def event_times(label, at=0.5):
    """Output times of the segments with this label (at = fraction into the segment)."""
    segs, _ = timeline()
    return [a + (b - a) * at for a, b, _, _, _, lb, _, _ in segs if lb == label]


def _path(t, segs):
    """Root x and yaw (deg) at time t: walks move sideways and face their direction, with smooth turns."""
    x, yaw = 0.0, 0.0
    for a, b, clip, _, _, lb, x0, x1 in segs:
        if lb != 'prowl':
            continue
        if t >= b:
            x = x1
        elif t > a:
            x = x0 + (x1 - x0) * (t - a) / (b - a)
        face = WALK_YAW if x1 < x0 else -WALK_YAW       # +yaw turns the camera-facing beast towards -x
        w = smooth((t - (a - TURN * 0.5)) / TURN) * (1 - smooth((t - (b - TURN * 0.5)) / TURN))
        yaw += face * w
    return x, yaw


def root_motion(t, total, segs):
    """Choreography of the extra root joint: (translation, uniform scale, yaw deg). It stays BEHIND him (+z)."""
    rise = smooth(t / RISE)
    x, yaw = _path(t, segs)
    y = -HEIGHT * 0.95 * (1 - rise)
    z = BEHIND
    s = 1.0
    d0 = total - DIVE
    if t > d0:
        f = smooth((t - d0) / DIVE)
        z = BEHIND * (1 - f); x *= (1 - f)
        y += 60 * math.sin(math.pi * f)
        s = 1.0 - 0.94 * f ** 1.6
    return np.array([x, y, z]), s, yaw


def _axis_angle(axis, deg):
    a = np.asarray(axis, float); a /= np.linalg.norm(a) + 1e-12
    th = math.radians(deg); c, s_ = math.cos(th), math.sin(th)
    x, y, z = a
    return np.array([[c + x * x * (1 - c), x * y * (1 - c) - z * s_, x * z * (1 - c) + y * s_],
                     [y * x * (1 - c) + z * s_, c + y * y * (1 - c), y * z * (1 - c) - x * s_],
                     [z * x * (1 - c) - y * s_, z * y * (1 - c) + x * s_, c + z * z * (1 - c)]])


def _wobble(t, seed, period):
    """Smooth pseudo-noise in [-1, 1] (sum of incommensurate sines)."""
    return (math.sin(2 * math.pi * t / period + seed) * 0.6 + math.sin(2 * math.pi * t / (period * 0.61) + seed * 2.3) * 0.3
            + math.sin(2 * math.pi * t / (period * 0.37) + seed * 4.1) * 0.1)


# bone -> list of (world axis key, degrees, period s, seed, calm only): x = its side axis, y = up, z = facing axis
LIFE = {
    'Hips': [('z', 2.2, 3.1, 0.3, False)],
    'Spine02': [('x', 2.5, 2.6, 0.0, False)],
    'Spine01': [('x', 2.0, 2.6, 0.4, False), ('z', 1.5, 3.7, 1.1, False)],
    'Spine': [('x', 2.0, 2.6, 0.8, False)],
    'neck': [('y', 9.0, 3.4, 2.0, True), ('x', 4.0, 2.9, 0.5, True)],
    'Head': [('y', 12.0, 3.4, 2.4, True), ('x', 5.0, 2.2, 1.7, True), ('z', 4.0, 4.3, 3.0, True)],
    'LeftShoulder': [('x', 3.0, 2.6, 0.2, False)],
    'RightShoulder': [('x', 3.0, 2.6, 0.9, False)],
    'LeftArm': [('z', 6.0, 3.0, 1.3, True)],
    'RightArm': [('z', 6.0, 3.3, 2.9, True)],
    'LeftForeArm': [('x', 7.0, 2.4, 0.6, True)],
    'RightForeArm': [('x', 7.0, 2.7, 3.6, True)],
}


def add_life(beast, frames, segs):
    """Procedural secondary motion on top of the composed clip (in place): breathing, weight shifts, a head that keeps
    looking around, arms that sway. 'calm only' parts fade to 30 % during the big actions."""
    names = [ROOT] + beast.names
    parents = [-1] + [p + 1 if p >= 0 else 0 for p in beast.parents]
    idx = {n: i for i, n in enumerate(names)}
    for k, fr in enumerate(frames):
        t = k / FPS
        lab = next((lb for a, b, _, _, _, lb, _, _ in segs if a <= t < b), None)
        calm = 1.0 if lab in (None, 'prowl') else 0.3
        q0 = fr[0][2]
        yaw_m = R.quat_to_mat(q0)                       # root yaw: the beast's own side/facing axes turn with it
        axes = {'x': yaw_m @ np.array([1.0, 0, 0]), 'y': np.array([0, 1.0, 0]), 'z': yaw_m @ np.array([0, 0, 1.0])}
        G = []
        new = []
        for i, (tt, ss, qq) in enumerate(fr):
            L = R.trs_to_mat(tt, ss, qq)
            p = parents[i]
            if names[i] in LIFE and p >= 0:
                Rp = G[p][:3, :3] / np.linalg.norm(G[p][:3, :3], axis=0)
                Rd = np.eye(3)
                for ax, deg, per, seed, calm_only in LIFE[names[i]]:
                    amp = deg * (calm if calm_only else 1.0)
                    Rd = _axis_angle(Rp.T @ axes[ax], amp * _wobble(t, seed, per)) @ Rd
                L[:3, :3] = Rd @ L[:3, :3]
            if names[i] == 'Hips':                      # breathing bob
                L[1, 3] += 2.5 * math.sin(2 * math.pi * t / 2.6)
            G.append(L if p < 0 else G[p] @ L)
            new.append(R.mat_to_trs(L))
        frames[k] = new
    return frames


def compose(beast):
    segs, total = timeline()
    n = int(round(total * FPS)) + 1
    frames = []
    for k in range(n):
        t = min(k / FPS, total)
        pose = None
        for a, b, clip, s0, sp, _, _, _ in segs:
            if a - 1e-6 <= t <= b + 1e-6:
                p = beast.sample(clip, s0 + (t - a) * sp)
                if pose is None:
                    pose = p
                else:                                  # inside the cross-fade with the previous segment
                    f = smooth((t - a) / FADE)
                    pose = [blend(x, y, f) for x, y in zip(pose, p)]
        if pose is None:
            a, b, clip, s0, sp, _, _, _ = segs[-1]
            pose = beast.sample(clip, s0 + (b - a) * sp)
        tr, s, yaw = root_motion(t, total, segs)
        q = R.quat_from_mat(_axis_angle((0, 1, 0), yaw))
        frames.append([(tr, np.array([s, s, s]), q)] + pose)
    return add_life(beast, frames, segs), total


# ---------------------------------------------------------------- League files
def files(beast, frames, base):
    """base: game path without extension. Returns {path: bytes} for .skn .skl .anm."""
    names = [ROOT] + beast.names
    parents = [-1] + [p + 1 if p >= 0 else 0 for p in beast.parents]
    local_bind = [np.eye(4)]
    for i, p in enumerate(beast.parents):
        local_bind.append(beast.rest[i] if p < 0 else np.linalg.inv(beast.rest[p]) @ beast.rest[i])
    used = sorted(set(int(j) for j in np.unique(beast.infl[beast.w > 0])))
    influences = [j + 1 for j in used]
    remap = {j: k for k, j in enumerate(used)}
    s = lolskn.Skn()
    s.vtype = 0; s.flags = 0
    dt = lolskn._dtype(0)
    v = np.zeros(len(beast.pos), dt)
    v['pos'] = beast.pos; v['nrm'] = beast.nrm
    v['uv'] = np.stack([beast.uv[:, 0], 1 - beast.uv[:, 1]], 1)
    v['infl'] = np.vectorize(lambda j: remap.get(int(j), 0))(beast.infl)
    v['w'] = beast.w
    s.verts = v
    s.indices = beast.tris.reshape(-1).astype(np.uint16)       # same winding as the champion body (glTF order)
    s.submeshes = [dict(name='beast', vstart=0, vcount=len(v), istart=0, icount=len(s.indices))]
    import tempfile
    tmp = tempfile.mktemp(suffix='.skn'); lolskn.write(s, tmp); skn = open(tmp, 'rb').read(); os.remove(tmp)
    skl = R.write_skl(names, parents, local_bind, influences)
    anm = R.write_anm_v4(names, frames, FPS)
    return {base + '.skn': skn, base + '.skl': skl, base + '.anm': anm}


def globals_from_frames(parents, frames):
    """Per frame global matrices from local TRS (for the preview)."""
    out = []
    for fr in frames:
        G = []
        for i, p in enumerate(parents):
            M = R.trs_to_mat(*fr[i])
            G.append(M if p < 0 else G[p] @ M)
        out.append(np.array(G))
    return np.array(out)


def preview_data(beast, frames):
    """Skinning matrices per frame (G_anim * inverse bind) for vfxsim, in the skeleton's joint order."""
    parents = [-1] + [p + 1 if p >= 0 else 0 for p in beast.parents]
    G = globals_from_frames(parents, frames)
    bind = np.concatenate([np.eye(4)[None], beast.rest])
    return G @ np.linalg.inv(bind)[None]
