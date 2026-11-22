"""Quick software renderer for checking meshes (League space, y up, character faces +z)."""
import numpy as np
from PIL import Image


def render(parts, out, size=(700, 900), yaw=0.0, pitch=8.0, center=(0, 105, 0), scale=4.0, bg=(0.08, 0.08, 0.1)):
    """parts: list of (verts(N,3), faces(M,3), per-vertex colors (N,3) or rgb tuple)."""
    W, H = size
    img = np.zeros((H, W, 3)); img[:] = bg
    zb = np.full((H, W), -1e9)
    a, b = np.radians(yaw), np.radians(pitch)
    Ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    R = Rx @ Ry
    L = np.array([-0.45, 0.65, 0.6]); L /= np.linalg.norm(L)
    for verts, faces, col in parts:
        v = (np.asarray(verts, float) - center) @ R.T
        sx = v[:, 0] * scale + W / 2
        sy = H / 2 - v[:, 1] * scale
        fn = np.cross(v[faces[:, 1]] - v[faces[:, 0]], v[faces[:, 2]] - v[faces[:, 0]])
        fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-9
        vc = np.asarray(col, float)
        for fi, (i0, i1, i2) in enumerate(faces):
            if fn[fi, 2] <= 0:
                continue
            xs = np.array([sx[i0], sx[i1], sx[i2]]); ys = np.array([sy[i0], sy[i1], sy[i2]])
            x0, x1 = max(0, int(xs.min())), min(W - 1, int(xs.max()) + 1)
            y0, y1 = max(0, int(ys.min())), min(H - 1, int(ys.max()) + 1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            dd = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(dd) < 1e-9:
                continue
            w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / dd
            w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / dd
            w2 = 1 - w0 - w1
            ins = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            z = w0 * v[i0, 2] + w1 * v[i1, 2] + w2 * v[i2, 2]
            zr = zb[y0:y1 + 1, x0:x1 + 1]
            vis = ins & (z > zr)
            if not vis.any():
                continue
            if vc.ndim == 2:
                c = (vc[i0] + vc[i1] + vc[i2]) / 3
            else:
                c = vc
            lam = 0.35 + 0.65 * max(0.0, fn[fi] @ L)
            img[y0:y1 + 1, x0:x1 + 1][vis] = np.clip(c * lam, 0, 1)
            zr[vis] = z[vis]
    Image.fromarray((img * 255).astype(np.uint8)).save(out)
