"""Flow Striker v2 - refined original anime footballer (League model space: y up, faces +z, left = -x).

Changes vs v1: real fingers along the skeleton's finger chains, tapered jersey, sleeve and shorts
hems, clavicles, knee/calf/ankle shaping, shin guards, football boots with studs, a wristband,
and a fuller hair-do whose locks carry flow tangents (for strand texturing) and a tip parameter."""
import json

import numpy as np

from sdf import capsule, ellipsoid, frame, mesh_from_sdf, round_box, round_cone, smax, smin


class Rig:
    def __init__(self, path):
        d = json.load(open(path))
        self.j = {j['name']: np.array(j['pos'], np.float64) for j in d['joints']}

    def __getitem__(self, k):
        return self.j[k]


def zscaled(fn, sz):
    """Evaluate an SDF with the z axis squashed (approximate, fine for smooth shapes)."""
    def f(P):
        Q = P.copy(); Q[:, 2] = Q[:, 2] * sz
        return fn(Q) / max(sz, 1.0)
    return f


SOLE = 1.5   # boots stand on studs, the sole bottom sits 1.5 units above the ground


def body_sdf(J):
    def f(P):
        P = P.astype(np.float64)
        # torso core
        d = ellipsoid(P, (0, 118.5, 0.0), (14.2, 10.5, 10.0))                       # pelvis
        d = smin(d, ellipsoid(P, (0, 132.0, 0.8), (13.2, 11.5, 8.8)), 6.0)          # waist
        d = smin(d, ellipsoid(P, (0, 150.0, 1.0), (14.8, 13.5, 9.4)), 6.0)          # rib cage
        for sx in (-1, 1):
            d = smin(d, ellipsoid(P, (sx * 7.0, 156.0, 6.6), (7.6, 4.2, 2.4)), 3.0)  # pectorals
            d = smin(d, ellipsoid(P, (sx * 11.5, 147.0, -2.5), (5.0, 10.5, 6.2)), 4.0)  # lats
            d = smin(d, capsule(P, (sx * 2.0, 166.6, 3.2), (sx * 12.5, 166.0, -0.5), 1.6), 2.0)  # clavicle
        d = smin(d, capsule(P, (-14.5, 162.5, -1.0), (14.5, 162.5, -1.0), 7.6), 5.0)  # shoulder girdle
        d = smin(d, ellipsoid(P, (0, 148.0, -4.4), (12.8, 13.0, 6.3)), 5.0)         # upper back
        d = smin(d, round_cone(P, (0, 164.0, -1.5), (0, 181.0, 0.0), 6.4, 5.4), 3.5)  # neck
        # fitted jersey: tapered from chest to a slightly flared hem (z squashed -> oval section)
        jersey = zscaled(lambda Q: round_cone(Q, (0, 157.0, 1.4 * 1.45), (0, 123.0, 1.0 * 1.45), 14.9, 15.2), 1.45)(P)
        jersey = smax(jersey, -(P[:, 1] - 121.2), 0.6)                               # cut hem
        d = smin(d, jersey, 1.2)
        # crew collar rib
        for k in range(16):
            a0 = k / 16 * 2 * np.pi; a1 = (k + 1) / 16 * 2 * np.pi
            d = np.minimum(d, capsule(P, (np.cos(a0) * 7.5, 168.0, np.sin(a0) * 6.8 - 1.4),
                                      (np.cos(a1) * 7.5, 168.0, np.sin(a1) * 6.8 - 1.4), 1.35))
        for s, sx in (('L', -1), ('R', 1)):
            sh, el, ha = J[s + '_Shoulder'], J[s + '_Elbow'], J[s + '_Hand']
            d = smin(d, capsule(P, (0, 169.5, -3.0), (sx * 12.5, 165.0, -3.5), 4.8), 4.0)  # trapezius
            d = smin(d, ellipsoid(P, sh + (sx * 1.6, -0.5, 0.0), (7.4, 7.7, 7.2)), 3.5)    # deltoid
            d = smin(d, round_cone(P, sh, el, 6.0, 4.7), 3.0)                               # upper arm
            ua = el - sh
            d = smin(d, ellipsoid(P, sh + ua * 0.55 + (0, 0, 1.6), (3.6, 3.6, 3.0), frame(ua, (0, 0, 1))), 2.0)  # biceps
            d = smin(d, ellipsoid(P, el + (0, 0.4, -1.2), (2.8, 2.8, 2.6)), 1.5)           # elbow
            d = smin(d, round_cone(P, el, ha + (el - ha) * 0.04, 4.8, 3.1), 2.5)           # forearm
            fa = ha - el
            d = smin(d, ellipsoid(P, el + fa * 0.28, (4.2, 4.0, 3.8), frame(fa, (0, 0, 1))), 2.0)  # forearm muscle
            sl_end = sh + (el - sh) * 0.50
            sleeve = round_cone(P, sh + (sx * 0.5, 0.5, 0), sl_end, 7.5, 6.4)
            d = smin(d, sleeve, 0.5)                                                         # sleeve with hem
            hip, kn, ft, toe = J[s + '_Hip'], J[s + '_KneeLower'], J[s + '_Foot'], J[s + '_Toe']
            d = smin(d, ellipsoid(P, (sx * 6.2, 116.5, -5.4), (7.0, 7.4, 5.5)), 4.0)        # glutes
            d = smin(d, round_cone(P, hip + (-sx * 0.8, 1.0, 0), kn, 7.8, 5.7), 4.0)        # thigh
            d = smin(d, ellipsoid(P, (hip[0] + sx * 1.5, 96.0, 1.5), (5.2, 11.0, 5.0)), 4.0)  # quads
            d = smin(d, ellipsoid(P, kn + (0, 0.2, 1.4), (4.6, 4.8, 3.6)), 2.0)             # knee cap
            d = smin(d, round_cone(P, kn, ft + (0, 2.0, 0), 5.4, 3.5), 2.5)                 # shin
            d = smin(d, ellipsoid(P, (kn[0], 52.0, kn[2] - 2.2), (5.1, 9.8, 5.2)), 3.0)     # calf
            d = smin(d, ellipsoid(P, (kn[0], 47.0, kn[2] + 2.6), (4.2, 10.5, 2.4)), 1.8)    # shin guard
            sh_end = hip + (kn - hip) * 0.42
            shorts = round_cone(P, hip + (-sx * 0.6, 1.5, 0), sh_end, 8.8, 8.3)
            d = smin(d, shorts, 0.6)
            # football boot: slim last (heel, midfoot, tapered toe), ankle collar and a sole plate
            bx = ft[0]
            boot = ellipsoid(P, (bx, SOLE + 4.3, -6.2), (3.9, 4.5, 4.8))                      # heel
            boot = smin(boot, ellipsoid(P, (bx, SOLE + 3.7, 1.5), (4.1, 3.6, 6.8)), 2.5)      # midfoot
            boot = smin(boot, ellipsoid(P, (bx, SOLE + 2.5, 9.3), (3.6, 2.6, 5.0)), 2.5)      # toe box
            boot = smin(boot, capsule(P, (bx, SOLE + 6.5, -5.8), (bx, 16.8, -5.0), 4.0), 2.5)  # ankle collar
            sole = round_box(P, (bx, SOLE + 0.45, 1.4), (3.95, 0.55, 12.2), 0.5)
            boot = smin(boot, sole, 0.4)
            d = smin(d, boot, 1.4)
        return d.astype(np.float32)
    return f


def hand_sdf(J, s):
    ha, tw = J[s + '_Hand'], J[s + '_Hand_Twist']
    fingers = {'Thumb': (1.40, 1.22, 1.08, 0.92), 'Index': (1.06, 0.96, 0.86, 0.76),
               'Middle': (1.10, 1.00, 0.90, 0.80), 'Ring': (1.02, 0.93, 0.83, 0.73),
               'Pinky': (0.90, 0.82, 0.74, 0.66)}
    knuck = [J[f'{s}_{n}1'] for n in ('Index', 'Middle', 'Ring', 'Pinky')]
    kc = np.mean(knuck, 0)
    R = frame(kc - ha, J[f'{s}_Index1'] - J[f'{s}_Pinky1'])

    def f(P):
        P = P.astype(np.float64)
        d = round_cone(P, tw + (tw - ha) * 1.6, ha, 3.25, 3.0)                            # wrist
        d = smin(d, ellipsoid(P, ha + (kc - ha) * 0.55, (np.linalg.norm(kc - ha) * 0.62, 4.3, 1.75), R), 1.4)  # palm
        for n, r in fingers.items():
            p1, p2, p3 = J[f'{s}_{n}1'], J[f'{s}_{n}2'], J[f'{s}_{n}3']
            tip = p3 + (p3 - p2) * (0.95 if n != 'Thumb' else 1.0)
            base = p1 if n != 'Thumb' else p1 + (ha - p1) * 0.25
            fd = round_cone(P, base, p2, r[0], r[1])
            fd = smin(fd, round_cone(P, p2, p3, r[1], r[2]), 0.35)
            fd = smin(fd, round_cone(P, p3, tip, r[2], r[3]), 0.3)
            d = smin(d, fd, 0.9 if n == 'Thumb' else 0.55)
        return d.astype(np.float32)
    lo = np.minimum.reduce([ha, J[s + '_Index3'], J[s + '_Pinky3'], J[s + '_Thumb3'], tw]) - 6
    hi = np.maximum.reduce([ha, J[s + '_Index3'], J[s + '_Pinky3'], J[s + '_Thumb3'], tw]) + 6
    return f, lo, hi


def head_sdf():
    def f(P):
        P = P.astype(np.float64)
        d = ellipsoid(P, (0, 197.0, -0.6), (12.1, 13.2, 13.3))                      # cranium
        d = smin(d, round_cone(P, (0, 193.5, 3.4), (0, 181.6, 6.5), 9.5, 2.2), 5.5)  # anime V jaw
        for sx in (-1, 1):
            d = smin(d, ellipsoid(P, (sx * 6.0, 189.4, 3.9), (4.8, 5.0, 5.3)), 3.0)  # cheeks
            d = smin(d, ellipsoid(P, (sx * 12.0, 192.5, -0.3), (1.7, 3.3, 2.4)), 1.0)  # ears
            d = smax(d, -ellipsoid(P, (sx * 12.9, 192.6, 0.3), (0.9, 2.0, 1.2)), 0.5)  # ear hollow
        d = smin(d, ellipsoid(P, (0, 189.0, 12.1), (0.85, 1.7, 1.05)), 0.9)          # nose
        d = smin(d, round_cone(P, (0, 176.5, -1.5), (0, 186.0, -0.5), 5.0, 5.5), 2.5)  # neck top
        return d.astype(np.float32)
    return f


def _sm(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def hairline_cut(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    line = 183.0 + (203.0 - 183.0) * _sm(-6.0, 10.0, z)
    line -= 8.0 * np.exp(-((z - 1.0) / 6.0) ** 2) * _sm(6.0, 11.0, np.abs(x))
    return y - line


def hair_cap_sdf():
    def f(P):
        P = P.astype(np.float64)
        cap = ellipsoid(P, (0, 197.8, -1.0), (13.6, 14.4, 14.6))
        return smax(cap, -hairline_cut(P), 1.2).astype(np.float32)
    return f


# ------------------------------------------------------------------------ hair locks
HC = np.array([0.0, 197.8, -1.0]); HR = np.array([13.6, 14.4, 14.6])
CENTERLINES = []


def _shell_lock(start, end, off0, off1, width, thick, flick=0.0, segs=12, side_kick=0.0):
    pts = []
    for i in range(segs + 1):
        t = i / segs
        th = start[0] + (end[0] - start[0]) * t
        ph = start[1] + (end[1] - start[1]) * t
        n = np.array([np.sin(th) * np.sin(ph), np.cos(th), np.sin(th) * np.cos(ph)])
        off = off0 + (off1 - off0) * t + flick * max(0.0, (t - 0.55) / 0.45) ** 2
        p = HC + n * HR + n * off
        if side_kick:
            east = np.array([np.cos(ph), 0.0, -np.sin(ph)])
            p = p + east * side_kick * t ** 2
        pts.append(p)
    pts = np.array(pts)
    CENTERLINES.append(pts.copy())
    verts, faces, flows, ts = [], [], [], []
    ring = 6
    for i in range(segs + 1):
        t = i / segs
        tg = pts[min(i + 1, segs)] - pts[max(i - 1, 0)]
        tg /= np.linalg.norm(tg) + 1e-9
        g = (pts[i] - HC) / (HR * HR); g /= np.linalg.norm(g)
        side_ = np.cross(tg, g); side_ /= np.linalg.norm(side_) + 1e-9
        nrm = np.cross(side_, tg)
        w = width * (1 - t) ** 0.75 * (0.78 + 0.22 * np.sin(np.pi * min(1, t * 1.6))) + 0.06
        h = thick * (1 - t) ** 0.8 + 0.05
        for k in range(ring):
            a = k / ring * 2 * np.pi
            verts.append(pts[i] + side_ * np.cos(a) * w + nrm * np.sin(a) * h * (1.0 + 0.35 * np.cos(a) ** 2))
            flows.append(tg); ts.append(t)
    for i in range(segs):
        for k in range(ring):
            a = i * ring + k; b_ = i * ring + (k + 1) % ring
            faces += [(a, a + ring, b_), (b_, a + ring, b_ + ring)]
    return np.array(verts, np.float32), np.array(faces, np.int32), np.array(flows, np.float32), np.array(ts, np.float32)


def hair_locks(seed=11):
    CENTERLINES.clear()
    rng = np.random.default_rng(seed)
    J = lambda a=0.06: rng.uniform(-a, a)
    L = []
    # back & sides, three layers, flicking out at the tips
    for layer, (th0, th1, off1, flick, n_) in enumerate(((0.15, 1.55, 2.0, 2.4, 14), (0.35, 1.82, 1.6, 3.0, 16),
                                                          (0.72, 2.06, 1.2, 3.4, 16))):
        for k in range(n_):
            ph = np.pi + (k - (n_ - 1) / 2) * (2 * np.pi * 0.70 / n_) + J()
            ph_end = ph + np.sign(np.sin(ph)) * 0.15 + J(0.1)
            L.append(_shell_lock((th0 + J(), ph), (th1 + J(0.1), ph_end), 0.3, off1, 4.7 - layer * 0.4 + J(0.4), 1.65,
                                 flick=flick + J(0.8), side_kick=J(1.2)))
    # crown: broad locks swept back (kept low - no upright strands)
    for k in range(13):
        ph = np.pi + (k - 6) * 0.31 + J()
        L.append(_shell_lock((0.02, ph), (0.95 + J(0.1), ph + J(0.1)), 0.2, 2.3, 6.0 + J(0.5), 2.0, flick=2.0 + J(0.6)))
    for ph in (np.pi - 0.25, np.pi + 0.25, np.pi):
        L.append(_shell_lock((0.0, ph), (0.55, ph), 0.2, 2.1, 6.5, 2.0, flick=0.8))
    for ph in (-0.45, 0.0, 0.45):
        L.append(_shell_lock((0.0, ph + np.pi), (0.62, ph), 0.2, 1.8, 6.2, 2.0, flick=0.5))
    # fringe: swept to the character's left, two longer face-framing locks
    for (ph0, ph1, th1, w, kick) in ((0.78, 0.50, 1.20, 4.4, 0.0), (0.50, 0.12, 1.27, 4.8, 0.0), (0.22, -0.22, 1.31, 5.0, 0.0),
                                     (-0.06, -0.52, 1.33, 5.0, 0.0), (-0.34, -0.80, 1.38, 4.8, 0.4), (-0.62, -1.08, 1.50, 4.4, 0.6),
                                     (-0.88, -1.30, 1.66, 4.0, 0.8)):
        L.append(_shell_lock((0.55, ph0), (th1, ph1), 1.3, 1.0, w, 1.6, flick=1.3, side_kick=kick))
    for sx, length_th in ((1, 1.72), (-1, 1.80)):                 # face-framing locks by the temples
        L.append(_shell_lock((0.80, sx * 0.95), (length_th, sx * 1.12), 1.2, 0.8, 4.0, 1.5, flick=1.5))
    for sx in (-1, 1):                                            # over the ears
        L.append(_shell_lock((0.75, sx * 1.15), (1.62, sx * 1.30), 1.2, 0.9, 4.0, 1.4, flick=1.6))
        L.append(_shell_lock((0.90, sx * 1.45), (1.75, sx * 1.65), 1.2, 0.9, 3.8, 1.4, flick=2.0))
    V, F, FL, T, off = [], [], [], [], 0
    for v, f, fl, t in L:
        V.append(v); F.append(f + off); FL.append(fl); T.append(t); off += len(v)
    return np.vstack(V), np.vstack(F), np.vstack(FL), np.concatenate(T)


# ------------------------------------------------------------------------ small analytic parts
def cylinder(a, b, r, seg=10):
    a = np.asarray(a, float); b = np.asarray(b, float)
    ax = b - a; ax /= np.linalg.norm(ax)
    u = np.cross(ax, (1, 0, 0) if abs(ax[0]) < 0.9 else (0, 0, 1)); u /= np.linalg.norm(u)
    w = np.cross(ax, u)
    V, F = [], []
    for c in (a, b):
        for k in range(seg):
            t = k / seg * 2 * np.pi
            V.append(c + (u * np.cos(t) + w * np.sin(t)) * r)
    V.append(a); V.append(b)
    ia, ib = 2 * seg, 2 * seg + 1
    for k in range(seg):
        k2 = (k + 1) % seg
        F += [(k, k2, seg + k), (k2, seg + k2, seg + k), (ia, k2, k), (ib, seg + k, seg + k2)]
    return np.array(V, np.float32), np.array(F, np.int32)


def studs(J):
    V, F, off = [], [], 0
    for s in ('L', 'R'):
        bx = J[s + '_Foot'][0]
        for (dx, dz, r) in ((-2.3, 9.0, 0.85), (2.3, 9.0, 0.85), (-2.6, 3.5, 0.85), (2.6, 3.5, 0.85), (0.0, 12.6, 0.75),
                            (-2.2, -7.3, 0.95), (2.2, -7.3, 0.95)):
            v, f = cylinder((bx + dx, SOLE + 0.2, dz), (bx + dx * 0.95, 0.05, dz), r)
            V.append(v); F.append(f + off); off += len(v)
    return np.vstack(V), np.vstack(F)


def wristband(J, s='L'):
    tw, ha = J[s + '_Hand_Twist'], J[s + '_Hand']
    c = tw + (tw - ha) * 0.9
    ax = (tw - ha) / np.linalg.norm(tw - ha)
    u = np.cross(ax, (0, 0, 1)); u /= np.linalg.norm(u); w = np.cross(ax, u)
    V, F = [], []
    seg, ring, R, r, hw = 18, 6, 3.55, 0.55, 1.1
    for i in range(seg):
        t = i / seg * 2 * np.pi
        for k in range(ring):
            q = k / ring * 2 * np.pi
            radial = u * np.cos(t) + w * np.sin(t)
            V.append(c + radial * (R + r * np.cos(q)) + ax * hw * np.sin(q))
    for i in range(seg):
        for k in range(ring):
            a = i * ring + k; b = ((i + 1) % seg) * ring + k
            a2 = i * ring + (k + 1) % ring; b2 = ((i + 1) % seg) * ring + (k + 1) % ring
            F += [(a, b, a2), (a2, b, b2)]
    return np.array(V, np.float32), np.array(F, np.int32)


PART_IDS = {'body': 0, 'head': 1, 'cap': 2, 'locks': 3, 'hands': 4, 'studs': 5, 'band': 6}


def build_all(J):
    out = {}
    out['body'] = mesh_from_sdf(body_sdf(J), (-52, -1, -24), (52, 186, 24), 0.62)
    hv, hf = [], []; off = 0
    for s in ('L', 'R'):
        fn, lo, hi = hand_sdf(J, s)
        v, f = mesh_from_sdf(fn, lo, hi, 0.2)
        hv.append(v); hf.append(f + off); off += len(v)
    out['hands'] = (np.vstack(hv), np.vstack(hf))
    out['head'] = mesh_from_sdf(head_sdf(), (-16, 172, -16), (16, 213, 17), 0.30)
    out['cap'] = mesh_from_sdf(hair_cap_sdf(), (-16, 180, -18), (16, 214, 17), 0.35)
    lv, lf, lfl, lt = hair_locks()
    out['locks'] = (lv, lf)
    out['studs'] = studs(J)
    out['band'] = wristband(J)
    return out, lfl, lt
