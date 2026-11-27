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
# The beast lives for the whole ult (the R buff lasts 15 s) as a floating shadow body: its legs dissolve into smoke
# (alpha baked into the texture, see ult_beast.beast_colour), so nothing touches the ground and nothing can slide.
# Segments follow each other with 0.15 s cross-fades:
# (clip, start s in the clip, length s in the clip, speed, label for synced effects, x it drifts to or None)
# Drifts glide sideways behind him (eased, leaning into the motion and turning a little towards where it goes). On
# top of every clip runs a procedural layer (hover bob, breathing, head looking around, sway), the arms are simulated
# as heavy (they lag, swing through and settle) and every hit makes the whole body sink with its weight.
DRIFT_SPEED = 140.0                # average units / s of a sideways drift (eased in and out)
DRIFT_X = 120.0
SEQUENCE = [   # the big actions happen right behind him (x 0), the calm watching out at his sides
    ('arise', 0.75, 1.08, 1.8, 'rise', None),       # claws its way up out of the pool, from all fours to upright
    ('scream', 0.55, 1.45, 1.65, 'roar', None),     # rears up, crouches wide and roars
    ('alert', 0.0, 1.4, 1.15, None, None),          # crouched, menacing, looks around
    ('idle', 0.0, None, None, 'drift', -DRIFT_X),   # glides out to his left side ...
    ('look', 0.6, 1.5, 1.25, None, None),           # ... breathes heavily, watches the field
    ('idle', 0.3, None, None, 'drift', 0.0),        # glides back behind him
    ('pound', 1.38, 1.37, 1.4, 'pound', None),      # beats its chest
    ('stomp2', 0.0, 1.4, 1.4, 'stomp', None),       # slams the ground twice (shock waves under it)
    ('idle', 0.6, None, None, 'drift', DRIFT_X),    # glides out to his right side ...
    ('alert', 2.0, 1.4, 1.15, None, None),          # ... crouched, menacing
    ('idle', 0.1, None, None, 'drift', 0.0),        # back behind him
    ('swipe', 0.0, 1.0, 1.0, 'swipe', None),        # rips the air with an uppercut claw
    ('shout', 2.3, 1.9, 1.45, 'shout', None),       # spreads its arms and bellows
    ('look', 3.0, 1.0, 1.0, None, None),
    ('stomp', 0.0, 1.4, 1.4, 'stomp', None),        # angry slam
    ('alert', 0.4, None, 1.0, None, None),          # crouches, ready ... (length fills up to LENGTH)
    ('slam', 0.55, 1.55, 2.0, 'dive', None),        # ... and hurls itself head first into the striker
]
LOOPED = set()
FADE = 0.15
TURN = 0.35                        # seconds to turn towards / away from a drift
DRIFT_YAW = 30.0                   # turns a little towards where it glides
BANK = 9.0                         # degrees it leans into a drift at full speed
RISE = 0.45                        # seconds to climb out of the ground
DIVE = 0.55                        # last seconds: lunge into the striker and shrink away
LENGTH = 14.95                     # the R buff (15 s) ends right after
HOVER = -50.0                      # root height while floating (Meshy's feet sit ~125 above the root)
BOB = 9.0                          # hover bob amplitude


def _segments(seq=None, length=LENGTH):
    """Resolve drift segments (their length follows from the distance) and the filler (fills up to length)."""
    x, out = 0.0, []
    for clip, s0, ln, sp, label, to in (seq or SEQUENCE):
        if to is not None:
            sp = 1.0
            ln = abs(to - x) / DRIFT_SPEED
            out.append((clip, s0, ln, sp, label, x, to)); x = to
        else:
            out.append((clip, s0, ln, sp, label, x, x))
    fixed = sum(ln / sp for clip, s0, ln, sp, *_ in out if ln is not None) - FADE * (len(out) - 1)
    out = [(c, s0, (length - fixed) * sp if ln is None else ln, sp, lb, x0, x1) for c, s0, ln, sp, lb, x0, x1 in out]
    return out


def timeline(seq=None, length=LENGTH):
    """[(start, end, clip, clip start, speed, label, x from, x to)], total."""
    segs = _segments(seq, length)
    t, out = 0.0, []
    for clip, s0, ln, sp, label, x0, x1 in segs:
        d = ln / sp
        out.append((t, t + d, clip, s0, sp, label, x0, x1)); t += d - FADE
    total = t + FADE
    if abs(total - length) > 0.06:
        raise ValueError(f'choreography is {total:.2f} s, expected {length} s')
    return out, total


def event_times(label, at=0.5, seq=None, length=LENGTH):
    """Output times of the segments with this label (at = fraction into the segment)."""
    segs, _ = timeline(seq, length)
    return [a + (b - a) * at for a, b, _, _, _, lb, _, _ in segs if lb == label]


def impacts():
    """[(time, strength)] of every hit: the body sinks with its weight and a shock wave runs over the ground."""
    out = [(event_times('roar', 0.45)[0], 0.7)]
    out += [(a + d, 0.35) for a in event_times('pound', 0.0) for d in (0.18, 0.45, 0.72)]
    out += [(a + d, 1.0) for a in event_times('stomp', 0.0) for d in (0.27, 0.69)]
    out += [(event_times('swipe', 0.0)[0] + 0.55, 0.6), (event_times('shout', 0.0)[0] + 0.51, 0.9)]
    return sorted(out)


def _path(t, segs):
    """Root x, yaw (deg) and x velocity at time t: drifts glide sideways (eased) and turn a little their way."""
    x, yaw, vel = 0.0, 0.0, 0.0
    for a, b, clip, _, _, lb, x0, x1 in segs:
        if lb != 'drift':
            continue
        if t >= b:
            x = x1
        elif t > a:
            u = (t - a) / (b - a)
            x = x0 + (x1 - x0) * smooth(u)
            vel = (x1 - x0) * 6 * u * (1 - u) / (b - a)
        face = DRIFT_YAW if x1 < x0 else -DRIFT_YAW      # +yaw turns the camera-facing beast towards -x
        w = smooth((t - (a - TURN * 0.5)) / TURN) * (1 - smooth((t - (b - TURN * 0.5)) / TURN))
        yaw += face * w
    return x, yaw, vel


def _dip(d):
    """Weight of a hit d seconds after it: a little rise before, a heavy sink, a soft rebound."""
    return 7 * math.exp(-((d + 0.13) / 0.08) ** 2) - 20 * math.exp(-((d - 0.03) / 0.07) ** 2) + 5 * math.exp(-((d - 0.24) / 0.1) ** 2)


def root_motion(t, total, segs, hits=None, ending='dive', behind=BEHIND):
    """Choreography of the extra root joint: (translation, uniform scale, rotation matrix). It stays BEHIND him (+z)
    and floats: hover bob, sway, a bank into every drift, a sink on every hit."""
    rise = smooth(t / RISE)
    x, yaw, vel = _path(t, segs)
    y = -HEIGHT * 0.95 * (1 - rise) + HOVER * rise
    y += rise * BOB * math.sin(2 * math.pi * t / 2.4)
    x += rise * 7 * math.sin(2 * math.pi * t / 4.1 + 0.7)
    for ti, k in (hits if hits is not None else impacts()):
        if -0.4 < t - ti < 0.6:
            y += k * _dip(t - ti)
    z = behind
    s = 1.0
    roll = -BANK * vel / (DRIFT_SPEED * 1.5) + 2.5 * math.sin(2 * math.pi * t / 3.3)
    pitch = 6.0 * abs(vel) / (DRIFT_SPEED * 1.5)
    d0 = total - DIVE
    if t > d0 and ending == 'dive':
        f = smooth((t - d0) / DIVE)
        z = behind * (1 - f); x *= (1 - f)
        y += 60 * math.sin(math.pi * f)
        s = 1.0 - 0.94 * f ** 1.6
    elif t > d0 and ending == 'sink':                  # sinks back into its pool
        f = smooth((t - d0) / DIVE)
        y -= HEIGHT * 0.9 * f ** 1.4
    Rm = _axis_angle((0, 1, 0), yaw) @ _axis_angle((0, 0, 1), roll) @ _axis_angle((1, 0, 0), -pitch)
    return np.array([x, y, z]), s, Rm


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
        calm = 1.0 if lab in (None, 'drift') else 0.3
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
            if names[i] == 'Hips':                      # breathing
                L[1, 3] += 2.5 * math.sin(2 * math.pi * t / 2.6)
            G.append(L if p < 0 else G[p] @ L)
            new.append(R.mat_to_trs(L))
        frames[k] = new
    return frames


# arm chain (joint, child whose position it aims at, spring frequency Hz, damping ratio, max lag deg)
HEAVY = [('LeftArm', 'LeftForeArm', 1.9, 0.38, 32.0), ('LeftForeArm', 'LeftHand', 2.3, 0.33, 38.0),
         ('RightArm', 'RightForeArm', 1.9, 0.38, 32.0), ('RightForeArm', 'RightHand', 2.3, 0.33, 38.0)]
GRAVITY = 650.0                    # pulls the simulated tips down a little: the arms hang heavy


def _globals(parents, fr):
    G = []
    for i, p in enumerate(parents):
        M = R.trs_to_mat(*fr[i])
        G.append(M if p < 0 else G[p] @ M)
    return G


def heavy_arms(beast, frames, substeps=4):
    """Heavy arms: every arm bone aims at a simulated tip (a damped spring towards where the animation puts it, plus
    a little gravity) instead of the exact animated position, so the arms lag behind fast moves, swing through and
    settle, and hang with weight. Works on world positions, so the drifts, the rise and the hits drive it too."""
    names = [ROOT] + beast.names
    parents = [-1] + [p + 1 if p >= 0 else 0 for p in beast.parents]
    idx = {n: i for i, n in enumerate(names)}
    state = {}
    dt = 1.0 / FPS / substeps
    for k, fr in enumerate(frames):
        fr = list(fr)
        for jn, cn, hz, zeta, maxdeg in HEAVY:
            j, c = idx[jn], idx[cn]
            G = _globals(parents, fr)
            pj, tip = G[j][:3, 3], G[c][:3, 3]
            if jn not in state:
                state[jn] = [tip.copy(), np.zeros(3), tip.copy()]
            x, v, prev = state[jn]
            w0 = 2 * math.pi * hz
            for sstep in range(substeps):
                target = prev + (tip - prev) * (sstep + 1) / substeps
                a = w0 * w0 * (target - x) - 2 * zeta * w0 * v + np.array([0, -GRAVITY, 0])
                v = v + a * dt; x = x + v * dt
            ln = np.linalg.norm(tip - pj)
            dvec = x - pj
            x = pj + dvec / (np.linalg.norm(dvec) + 1e-9) * ln
            state[jn] = [x, v, tip.copy()]
            u = (tip - pj) / (ln + 1e-9); wv = (x - pj) / (ln + 1e-9)
            ang = math.degrees(math.acos(min(1.0, max(-1.0, float(u @ wv)))))
            ax = np.cross(u, wv)
            if ang < 0.05 or np.linalg.norm(ax) < 1e-9:
                continue
            Rw = _axis_angle(ax, min(ang, maxdeg))
            Gj = G[j].copy()
            Gj[:3, :3] = Rw @ Gj[:3, :3]
            Lj = np.linalg.inv(G[parents[j]]) @ Gj
            fr[j] = R.mat_to_trs(Lj)
        frames[k] = fr
    return frames


# the penta: the beast's true form appears for a moment behind him, rears up, roars with spread arms and sinks back
PENTA_SEQUENCE = [
    ('arise', 0.75, 1.08, 1.8, 'rise', None),
    ('scream', 0.55, 1.45, 1.65, 'roar', None),
    ('shout', 2.3, 1.9, 1.45, 'shout', None),
    ('alert', 0.4, None, 1.0, None, None),
]
PENTA_LENGTH = 3.6
PENTA_BEHIND = 380.0               # further back and bigger than the ult beast, so both can be there at once
PENTA_SCALE = 1.75


def penta_impacts():
    seq, ln = PENTA_SEQUENCE, PENTA_LENGTH
    return [(event_times('roar', 0.45, seq, ln)[0], 0.7), (event_times('shout', 0.0, seq, ln)[0] + 0.51, 1.0)]


def compose(beast, seq=None, length=LENGTH, hits=None, ending='dive', behind=BEHIND, scale=1.0):
    seq = seq or SEQUENCE
    segs, total = timeline(seq, length)
    hits = impacts() if hits is None else hits
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
        tr, s, Rm = root_motion(t, total, segs, hits, ending, behind)
        s *= scale
        q = R.quat_from_mat(Rm)
        frames.append([(tr, np.array([s, s, s]), q)] + pose)
    return heavy_arms(beast, add_life(beast, frames, segs)), total


# ---------------------------------------------------------------- League files
def compose_penta(beast):
    return compose(beast, PENTA_SEQUENCE, PENTA_LENGTH, penta_impacts(), 'sink', PENTA_BEHIND, PENTA_SCALE)


def files(beast, frames, base, extra_anims=None):
    """base: game path without extension. Returns {path: bytes} for .skn .skl .anm (+ extra {suffix: frames} clips
    on the same skeleton)."""
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
    out = {base + '.skn': skn, base + '.skl': skl, base + '.anm': anm}
    for suffix, fr in (extra_anims or {}).items():
        out[base + suffix + '.anm'] = R.write_anm_v4(names, fr, FPS)
    return out


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
