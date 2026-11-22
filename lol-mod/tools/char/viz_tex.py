"""Textured preview renderer (unlit: the texture already contains the cel shading)."""
import numpy as np
from PIL import Image


def render(verts, tris, corner_uv, tex, out, size=(600, 900), yaw=0.0, pitch=10.0, center=(0, 105, 0), scale=4.0,
           bg=(0.09, 0.10, 0.12), outline=True):
    W, H = size
    img = np.zeros((H, W, 3)); img[:] = bg
    zb = np.full((H, W), -1e9)
    a, b = np.radians(yaw), np.radians(pitch)
    Ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    v = (np.asarray(verts, float) - center) @ (Rx @ Ry).T
    sx = v[:, 0] * scale + W / 2; sy = H / 2 - v[:, 1] * scale
    th, tw = tex.shape[:2]
    fn = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])
    for fi, (i0, i1, i2) in enumerate(tris):
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
        uv = w0[..., None] * corner_uv[fi, 0] + w1[..., None] * corner_uv[fi, 1] + w2[..., None] * corner_uv[fi, 2]
        u = np.clip(uv[..., 0] * (tw - 1), 0, tw - 1).astype(int)
        vv = np.clip((1 - uv[..., 1]) * (th - 1), 0, th - 1).astype(int)
        img[y0:y1 + 1, x0:x1 + 1][vis] = tex[vv, u, :3][vis]
        zr[vis] = z[vis]
    if outline:                                   # screen-space ink line like an anime render
        m = zb > -1e8
        edge = np.zeros_like(m)
        dz = np.zeros_like(zb)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            sh = np.roll(np.roll(m, dy, 0), dx, 1)
            edge |= m & ~sh
            zz = np.roll(np.roll(zb, dy, 0), dx, 1)
            dz = np.maximum(dz, np.where(m & sh, np.abs(zb - zz), 0))
        edge |= dz > 6.0
        img[edge] = img[edge] * 0.25
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
