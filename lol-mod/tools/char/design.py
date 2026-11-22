"""Original anime football striker ("Flow Striker") built around Yunara's bind pose.

All coordinates are League model space: y up, the character faces +z, its left side is -x.
Design: athletic teen, dark-green side-swept spiky hair, amber eyes, dark-green jersey with a
white diagonal sash, black shorts, white socks with green bands, black boots.
"""
import json

import numpy as np

from sdf import capsule, ellipsoid, frame, mesh_from_sdf, round_box, round_cone, smax, smin


class Rig:
    def __init__(self, path):
        d = json.load(open(path))
        self.j = {j['name']: np.array(j['pos'], np.float64) for j in d['joints']}

    def __getitem__(self, k):
        return self.j[k]


def side(name, s):
    return name.replace('X_', s + '_')


def body_sdf(rig):
    J = rig

    def f(P):
        P = P.astype(np.float64)
        # --- torso: broad shoulders, flat male chest, narrow waist and hips
        d = ellipsoid(P, (0, 118.5, 0.0), (14.4, 10.5, 10.2))                       # pelvis
        d = smin(d, ellipsoid(P, (0, 132.0, 0.8), (13.6, 11.5, 9.0)), 6.0)          # abdomen / waist
        d = smin(d, ellipsoid(P, (0, 150.0, 1.0), (15.0, 13.5, 9.6)), 6.0)          # rib cage
        for sx in (-1, 1):
            d = smin(d, ellipsoid(P, (sx * 7.0, 156.0, 6.8), (7.6, 4.2, 2.4)), 3.0)  # pectorals (flat, high)
            d = smin(d, ellipsoid(P, (sx * 11.5, 147.0, -2.5), (5.0, 10.5, 6.5)), 4.0)  # lats (V taper)
        d = smin(d, capsule(P, (-14.5, 162.5, -1.0), (14.5, 162.5, -1.0), 7.8), 5.0)  # shoulder girdle
        d = smin(d, ellipsoid(P, (0, 148.0, -4.5), (13.0, 13.0, 6.5)), 5.0)         # upper back
        d = smin(d, round_cone(P, (0, 164.0, -1.5), (0, 181.0, 0.0), 6.6, 5.6), 3.5)  # neck
        # loose jersey: hangs straight from the chest over the waist (no pinched waist)
        shirt = round_box(P, (0, 141.0, 1.0), (15.4, 19.5, 10.6), 9.0)
        d = smin(d, shirt, 1.0)
        # jersey collar ring at the neck base
        for k in range(14):
            a0 = k / 14 * 2 * np.pi; a1 = (k + 1) / 14 * 2 * np.pi
            c0 = (np.cos(a0) * 7.6, 168.0, np.sin(a0) * 6.9 - 1.4)
            c1 = (np.cos(a1) * 7.6, 168.0, np.sin(a1) * 6.9 - 1.4)
            d = np.minimum(d, capsule(P, c0, c1, 1.45))
        for s, sx in (('L', -1), ('R', 1)):
            sh, el, ha = J[s + '_Shoulder'], J[s + '_Elbow'], J[s + '_Hand']
            mid, th1, th3 = J[s + '_Middle1'], J[s + '_Thumb1'], J[s + '_Thumb3']
            d = smin(d, capsule(P, (0, 169.5, -3.0), (sx * 12.5, 165.0, -3.5), 5.0), 4.0)  # trapezius
            d = smin(d, ellipsoid(P, sh + (sx * 1.6, -0.5, 0.0), (7.6, 7.8, 7.4)), 3.5)    # deltoid
            d = smin(d, round_cone(P, sh, el, 6.2, 5.0), 3.0)                               # upper arm
            d = smin(d, round_cone(P, el, ha, 5.0, 3.6), 2.5)                               # forearm
            R = frame(mid - ha, th1 - ha)
            d = smin(d, ellipsoid(P, ha + R[:, 0] * 4.8, (5.8, 4.1, 2.3), R), 1.8)          # palm
            d = smin(d, ellipsoid(P, ha + R[:, 0] * 10.0 - R[:, 1] * 0.4, (4.4, 3.8, 1.9), R), 1.6)  # fingers
            d = smin(d, round_cone(P, th1, th3 + (th3 - th1) * 0.35, 1.8, 1.3), 1.2)       # thumb
            sl_end = sh + (el - sh) * 0.50                                                  # short sleeve
            d = smin(d, round_cone(P, sh + (sx * 0.5, 0.5, 0), sl_end, 7.6, 6.6), 0.6)
            hip, kn, ft = J[s + '_Hip'], J[s + '_KneeLower'], J[s + '_Foot']
            d = smin(d, ellipsoid(P, (sx * 6.2, 116.5, -5.6), (7.0, 7.4, 5.6)), 4.0)        # glutes
            d = smin(d, round_cone(P, hip + (-sx * 0.8, 1.0, 0), kn, 7.9, 5.8), 4.0)         # thigh
            d = smin(d, ellipsoid(P, kn + (0, 0, 0.8), (5.5, 5.0, 5.3)), 2.0)               # knee
            d = smin(d, round_cone(P, kn, ft + (0, 2.0, 0), 5.5, 3.7), 2.5)                 # shin
            d = smin(d, ellipsoid(P, (kn[0], 52.0, kn[2] - 2.0), (5.2, 9.5, 5.4)), 3.0)     # calf
            sh_end = hip + (kn - hip) * 0.42                                                # shorts leg
            d = smin(d, round_cone(P, hip + (-sx * 0.6, 1.5, 0), sh_end, 8.9, 8.3), 0.7)
            bx = ft[0]                                                                      # boot
            boot = round_box(P, (bx, 5.2, 2.0), (4.7, 5.4, 12.5), 2.6)
            boot = smin(boot, ellipsoid(P, (bx, 8.6, 7.0), (4.6, 4.0, 6.5)), 2.0)
            boot = smin(boot, capsule(P, (bx, 9.0, -6.0), (bx, 17.0, -5.0), 4.5), 2.5)
            d = smin(d, boot, 1.5)
        return d.astype(np.float32)
    return f


def head_sdf():
    def f(P):
        P = P.astype(np.float64)
        d = ellipsoid(P, (0, 197.0, -0.6), (12.2, 13.2, 13.4))                      # cranium
        d = smin(d, round_cone(P, (0, 193.5, 3.2), (0, 181.8, 6.4), 9.6, 2.3), 5.5)  # anime V jaw
        for sx in (-1, 1):
            d = smin(d, ellipsoid(P, (sx * 6.4, 189.0, 3.6), (5.2, 5.4, 5.6)), 3.0)  # cheeks
            d = smin(d, ellipsoid(P, (sx * 12.2, 192.5, -0.2), (1.7, 3.3, 2.3)), 1.0)  # ears
        d = smin(d, ellipsoid(P, (0, 189.0, 12.1), (0.9, 1.7, 1.1)), 0.9)           # small nose
        d = smin(d, round_cone(P, (0, 176.5, -1.5), (0, 186.0, -0.5), 5.1, 5.6), 2.5)  # neck top
        return d.astype(np.float32)
    return f


def _smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def hairline_cut(P):
    """>0 where hair grows: high at the forehead, down to the ears at the sides, nape at the back."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    line = 183.0 + (203.0 - 183.0) * _smooth(-6.0, 10.0, z)
    line -= 8.0 * np.exp(-((z - 1.0) / 6.0) ** 2) * _smooth(6.0, 11.0, np.abs(x))
    return y - line


def hair_cap_sdf():
    def f(P):
        P = P.astype(np.float64)
        cap = ellipsoid(P, (0, 197.8, -1.0), (13.6, 14.4, 14.6))
        return smax(cap, -hairline_cut(P), 1.2).astype(np.float32)
    return f


def build_meshes(rig):
    body = mesh_from_sdf(body_sdf(rig), (-62, -1, -24), (62, 186, 24), 0.75)
    head = mesh_from_sdf(head_sdf(), (-16, 172, -16), (16, 213, 17), 0.32)
    cap = mesh_from_sdf(hair_cap_sdf(), (-16, 180, -18), (16, 214, 17), 0.35)
    return body, head, cap


# --------------------------------------------------------------------- hair locks
def _lock(root, direction, bend, length, width, thick, segs=9, twist_up=None):
    """A tapered, curved anime hair lock with a lens-shaped cross section."""
    d0 = np.asarray(direction, float); d0 /= np.linalg.norm(d0)
    b = np.asarray(bend, float)
    pts, tans = [], []
    for i in range(segs + 1):
        t = i / segs
        p = root + d0 * length * t + b * length * t * t
        tg = d0 * length + 2 * b * length * t
        pts.append(p); tans.append(tg / np.linalg.norm(tg))
    up = np.asarray(twist_up if twist_up is not None else (0, 1, 0), float)
    verts, faces = [], []
    ring = 6
    for i, (p, tg) in enumerate(zip(pts, tans)):
        t = i / segs
        w = width * (1 - t) ** 0.85 + 0.05
        h = thick * (1 - t) ** 0.9 + 0.04
        side_ = np.cross(tg, up); side_ /= (np.linalg.norm(side_) + 1e-9)
        nrm = np.cross(side_, tg)
        for k in range(ring):
            a = k / ring * 2 * np.pi
            verts.append(p + side_ * np.cos(a) * w + nrm * np.sin(a) * h * (1.0 + 0.6 * np.cos(a) ** 2))
    for i in range(segs):
        for k in range(ring):
            a = i * ring + k; b_ = i * ring + (k + 1) % ring
            c = a + ring; d = b_ + ring
            faces += [(a, c, b_), (b_, c, d)]
    tip = len(verts); verts.append(pts[-1] + tans[-1] * 0.6)
    for k in range(ring):
        faces.append((segs * ring + k, tip, segs * ring + (k + 1) % ring))
    return np.array(verts, np.float32), np.array(faces, np.int32)


def _shell_lock(C, R, start, end, off0, off1, width, thick, flick=0.0, segs=12, curl=None):
    """Hair lock that follows the head shell from start (theta, phi) to end (theta, phi).
    off0/off1: height above the shell at root/tip; flick: outward kick of the last third."""
    pts = []
    for i in range(segs + 1):
        t = i / segs
        th = start[0] + (end[0] - start[0]) * t
        ph = start[1] + (end[1] - start[1]) * t
        n = np.array([np.sin(th) * np.sin(ph), np.cos(th), np.sin(th) * np.cos(ph)])
        off = off0 + (off1 - off0) * t + flick * max(0.0, (t - 0.55) / 0.45) ** 2
        p = C + n * R + n * off
        if curl is not None:
            p = p + np.asarray(curl) * t ** 2
        pts.append(p)
    pts = np.array(pts)
    verts, faces = [], []
    ring = 6
    for i in range(segs + 1):
        t = i / segs
        tg = pts[min(i + 1, segs)] - pts[max(i - 1, 0)]
        tg /= np.linalg.norm(tg) + 1e-9
        g = (pts[i] - C) / (R * R); g /= np.linalg.norm(g)
        side_ = np.cross(tg, g); side_ /= np.linalg.norm(side_) + 1e-9
        nrm = np.cross(side_, tg)
        w = width * (1 - t) ** 0.75 * (0.75 + 0.25 * np.sin(np.pi * min(1, t * 1.6))) + 0.06
        h = thick * (1 - t) ** 0.8 + 0.05
        for k in range(ring):
            a = k / ring * 2 * np.pi
            verts.append(pts[i] + side_ * np.cos(a) * w + nrm * np.sin(a) * h)
    for i in range(segs):
        for k in range(ring):
            a = i * ring + k; b_ = i * ring + (k + 1) % ring
            faces += [(a, a + ring, b_), (b_, a + ring, b_ + ring)]
    return np.array(verts, np.float32), np.array(faces, np.int32)


def hair_locks(seed=11):
    """Side-swept spiky anime hair that hugs the skull and flicks out at the tips."""
    rng = np.random.default_rng(seed)
    C = np.array([0.0, 197.8, -1.0])
    R = np.array([13.6, 14.4, 14.6])
    locks = []
    J = lambda a=0.06: rng.uniform(-a, a)
    # back & sides: from the crown down the back of the head, layered, tips flick out
    for layer, (th0, th1, off1, flick, n_) in enumerate(((0.15, 1.55, 2.0, 2.4, 12), (0.35, 1.80, 1.6, 3.0, 14),
                                                          (0.70, 2.05, 1.2, 3.4, 14))):
        for k in range(n_):
            ph = np.pi + (k - (n_ - 1) / 2) * (2 * np.pi * 0.70 / n_) + J()
            ph_end = ph + np.sign(np.sin(ph)) * 0.15 + J(0.1)
            locks.append(_shell_lock(C, R, (th0 + J(), ph), (th1 + J(0.1), ph_end), 0.3, off1, 4.6 - layer * 0.4, 1.6,
                                     flick=flick + J(0.8)))
    # top: broad locks swept back from the crown (no thin spikes)
    for k in range(11):
        ph = np.pi + (k - 5) * 0.36 + J()
        locks.append(_shell_lock(C, R, (0.02, ph), (0.95 + J(0.1), ph + J(0.1)), 0.2, 2.4, 6.0, 2.0, flick=2.2 + J(0.6)))
    for ph in (np.pi - 0.25, np.pi + 0.25, np.pi):
        locks.append(_shell_lock(C, R, (0.0, ph), (0.55, ph), 0.2, 2.2, 6.5, 2.0, flick=0.8))
    for ph in (-0.45, 0.0, 0.45):                       # crown fill towards the fringe
        locks.append(_shell_lock(C, R, (0.0, ph + np.pi), (0.62, ph), 0.2, 1.8, 6.2, 2.0, flick=0.5))
    # bangs: from the front hairline over the forehead, swept to the character's left (-x)
    for k, (ph0, ph1, th1, w) in enumerate(((0.75, 0.45, 1.22, 4.4), (0.45, 0.05, 1.28, 4.8), (0.15, -0.30, 1.32, 5.0),
                                            (-0.15, -0.62, 1.34, 5.0), (-0.45, -0.92, 1.40, 4.8), (-0.75, -1.20, 1.55, 4.4))):
        locks.append(_shell_lock(C, R, (0.55, ph0), (th1, ph1), 1.3, 1.0, w, 1.6, flick=1.2))
    # temples in front of the ears
    for sx in (-1, 1):
        locks.append(_shell_lock(C, R, (0.75, sx * 1.15), (1.62, sx * 1.30), 1.2, 0.9, 4.0, 1.4, flick=1.6))
        locks.append(_shell_lock(C, R, (0.90, sx * 1.45), (1.75, sx * 1.65), 1.2, 0.9, 3.8, 1.4, flick=2.0))
    V, F, off = [], [], 0
    for v, f in locks:
        V.append(v); F.append(f + off); off += len(v)
    return np.vstack(V), np.vstack(F)
