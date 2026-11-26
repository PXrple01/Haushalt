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
        x = min(max(t * src_fps, 0), len(g) - 1)
        a = int(math.floor(x)); b = min(a + 1, len(g) - 1); f = x - a
        A, B = self.local_trs(g[a]), self.local_trs(g[b])
        return [blend(ta, tb, f) for ta, tb in zip(A, B)]


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
# (clip, start s in the clip, length s in the clip, speed, label for synced effects)
SEQUENCE = [
    ('arise', 0.75, 1.08, 1.8, 'rise'),       # claws its way up out of the pool, from all fours to standing
    ('scream', 0.55, 1.45, 1.65, 'roar'),     # rears up, crouches wide and roars
    ('alert', 0.0, 2.4, 1.0, None),           # crouched, menacing, looks around
    ('pound', 1.38, 1.37, 1.4, 'pound'),      # beats its chest
    ('look', 0.0, 2.0, 1.0, None),            # breathes heavily, looks over the field
    ('stomp2', 0.0, 1.4, 1.4, 'stomp'),       # stamps the ground twice
    ('swipe', 0.0, 1.0, 1.0, 'swipe'),        # rips the air with an uppercut claw
    ('alert', 2.0, 2.0, 1.0, None),
    ('shout', 2.3, 1.9, 1.45, 'shout'),       # spreads its arms and bellows
    ('look', 4.0, 2.0, 1.0, None),
    ('stomp', 0.0, 1.4, 1.4, 'stomp'),        # angry ground stomp
    ('idle', 0.0, 0.81, 1.0, None),           # crouches, ready ...
    ('slam', 0.55, 1.55, 2.0, 'dive'),        # ... and hurls itself head first into the striker
]
FADE = 0.15
RISE = 0.45                        # seconds to climb out of the ground
DIVE = 0.55                        # last seconds: lunge into the striker and shrink away
LENGTH = 14.95                     # the R buff (15 s) ends right after


def timeline():
    """[(start, end, clip, clip start, speed, label)], total. The idle segments stretch so the clip ends at LENGTH."""
    raw = sum(ln / sp for _, _, ln, sp, _ in SEQUENCE) - FADE * (len(SEQUENCE) - 1)
    t, out = 0.0, []
    for clip, s0, ln, sp, label in SEQUENCE:
        d = ln / sp
        out.append((t, t + d, clip, s0, sp, label)); t += d - FADE
    total = t + FADE
    if abs(total - LENGTH) > 0.05:
        raise ValueError(f'choreography is {total:.2f} s, expected {LENGTH} s (raw {raw:.2f})')
    return out, total


def event_times(label, at=0.5):
    """Output times of the segments with this label (at = fraction into the segment)."""
    segs, _ = timeline()
    return [a + (b - a) * at for a, b, _, _, _, lb in segs if lb == label]


def root_motion(t, total):
    """Choreography of the extra root joint: (translation, uniform scale). The beast stays BEHIND him (+z, world)."""
    rise = smooth(t / RISE)
    y = -HEIGHT * 0.95 * (1 - rise)
    z = BEHIND
    s = 1.0
    d0 = total - DIVE
    if t > d0:
        f = smooth((t - d0) / DIVE)
        z = BEHIND * (1 - f)
        y += 60 * math.sin(math.pi * f)
        s = 1.0 - 0.94 * f ** 1.6
    return np.array([0.0, y, z]), s


def compose(beast):
    segs, total = timeline()
    n = int(round(total * FPS)) + 1
    frames = []
    for k in range(n):
        t = min(k / FPS, total)
        pose = None
        for a, b, clip, s0, sp, _ in segs:
            if a - 1e-6 <= t <= b + 1e-6:
                p = beast.sample(clip, s0 + (t - a) * sp)
                if pose is None:
                    pose = p
                else:                                  # inside the cross-fade with the previous segment
                    f = smooth((t - a) / FADE)
                    pose = [blend(x, y, f) for x, y in zip(pose, p)]
        if pose is None:
            a, b, clip, s0, sp, _ = segs[-1]
            pose = beast.sample(clip, s0 + (b - a) * sp)
        tr, s = root_motion(t, total)
        frames.append([(tr, np.array([s, s, s]), np.array([0, 0, 0, 1.0]))] + pose)
    return frames, total


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
