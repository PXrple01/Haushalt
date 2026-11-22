"""Signed-distance modelling helpers (numpy) + marching cubes."""
import numpy as np
from skimage import measure


def _n(v):
    v = np.asarray(v, np.float64)
    return v / (np.linalg.norm(v) + 1e-12)


def capsule(P, a, b, r):
    a = np.asarray(a, np.float32); b = np.asarray(b, np.float32)
    pa = P - a; ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[:, None] * ba, axis=1) - r


def round_cone(P, a, b, r1, r2):
    """Exact SDF of a cone with rounded ends between a(r1) and b(r2) (Inigo Quilez)."""
    a = np.asarray(a, np.float64); b = np.asarray(b, np.float64)
    ba = b - a
    l2 = ba @ ba
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - y[:, None] * ba
    x2 = (xv * xv).sum(1)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    out = np.empty(len(P))
    c1 = np.sign(z) * a2 * z2 > k
    c2 = np.sign(y) * a2 * y2 < k
    out[c1] = np.sqrt(x2[c1] + z2[c1]) * il2 - r2
    m = c2 & ~c1
    out[m] = np.sqrt(x2[m] + y2[m]) * il2 - r1
    o = ~(c1 | c2)
    out[o] = (np.sqrt(x2[o] * a2 * il2) + y[o] * rr) * il2 - r1
    return out.astype(np.float32)


def ellipsoid(P, c, radii, R=None):
    q = P - np.asarray(c, np.float32)
    if R is not None:
        q = q @ np.asarray(R, np.float32)          # world -> local (columns = local axes)
    r = np.asarray(radii, np.float32)
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def round_box(P, c, half, rad, R=None):
    q = P - np.asarray(c, np.float32)
    if R is not None:
        q = q @ np.asarray(R, np.float32)
    d = np.abs(q) - (np.asarray(half, np.float32) - rad)
    return np.linalg.norm(np.maximum(d, 0), axis=1) + np.minimum(d.max(1), 0) - rad


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def frame(x_axis, y_hint):
    x = _n(x_axis)
    y = np.asarray(y_hint, np.float64) - x * (np.asarray(y_hint) @ x)
    y = _n(y)
    z = np.cross(x, y)
    return np.stack([x, y, z], 1)                  # columns = local axes


def mesh_from_sdf(fn, lo, hi, step):
    lo = np.asarray(lo, np.float32); hi = np.asarray(hi, np.float32)
    nx, ny, nz = (np.ceil((hi - lo) / step).astype(int) + 1)
    xs = lo[0] + np.arange(nx) * step
    ys = lo[1] + np.arange(ny) * step
    zs = lo[2] + np.arange(nz) * step
    G = np.stack(np.meshgrid(xs, ys, zs, indexing='ij'), -1).reshape(-1, 3).astype(np.float32)
    vol = np.empty(len(G), np.float32)
    for i in range(0, len(G), 1_500_000):
        vol[i:i + 1_500_000] = fn(G[i:i + 1_500_000])
    vol = vol.reshape(nx, ny, nz)
    verts, faces, normals, _ = measure.marching_cubes(vol, level=0.0, spacing=(step, step, step))
    verts += lo
    return verts.astype(np.float32), faces.astype(np.int32)
