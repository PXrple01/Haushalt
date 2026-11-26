"""Shared bits of the preview videos: frame sizes, fonts, word wrap and the striker raster with a depth buffer."""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')

FPS = 30
W, H = 1280, 720
VW, VH = 900, 640
FONT = os.path.join(ROOT, 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def font(n, sans=False):
    return ImageFont.truetype(SANS if sans else FONT, n)


def wrap(dr, text, f, width):
    out, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if dr.textlength(t, font=f) > width and cur:
            out.append(cur); cur = w
        else:
            cur = t
    return out + ([cur] if cur else [])


def char_layer(cam, P, T, cuv, tex, w, h):
    """Perspective raster of the striker with a depth buffer (same camera as the effects)."""
    img = np.zeros((h, w, 3)); yy = np.linspace(0, 1, h)[:, None]
    img[:] = (np.array([0.16, 0.22, 0.17]) * (1 - yy) + np.array([0.25, 0.32, 0.23]) * yy)[:, None, :][:, 0, :][:, None, :]   # turf-like
    scr, z = cam.project(P)
    zb = np.full((h, w), 1e9); th, tw = tex.shape[:2]
    for fi, (i0, i1, i2) in enumerate(T):
        xs = scr[[i0, i1, i2], 0]; ys = scr[[i0, i1, i2], 1]
        x0, x1 = max(0, int(xs.min())), min(w - 1, int(xs.max()) + 1)
        y0, y1 = max(0, int(ys.min())), min(h - 1, int(ys.max()) + 1)
        if x1 < x0 or y1 < y0:
            continue
        dd = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if dd >= -1e-9:           # back face (front faces have a negative signed area on this y-down screen)
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / dd
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / dd
        w2 = 1 - w0 - w1
        ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        zz = w0 * z[i0] + w1 * z[i1] + w2 * z[i2]
        zr = zb[y0:y1 + 1, x0:x1 + 1]; vis = ins & (zz < zr)
        if not vis.any():
            continue
        uv = w0[..., None] * cuv[fi, 0] + w1[..., None] * cuv[fi, 1] + w2[..., None] * cuv[fi, 2]
        u = np.clip(uv[..., 0] * (tw - 1), 0, tw - 1).astype(int); v = np.clip((1 - uv[..., 1]) * (th - 1), 0, th - 1).astype(int)
        img[y0:y1 + 1, x0:x1 + 1][vis] = tex[v, u][vis]; zr[vis] = zz[vis]
    # grid on the ground
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)); dr = ImageDraw.Draw(im, 'RGBA')
    for k in range(-8, 9):
        for a, b in (((k * 100, 0, -800), (k * 100, 0, 800)), ((-800, 0, k * 100), (800, 0, k * 100))):
            p, zz = cam.project(np.array([a, b], float))
            if (zz > 1).all():
                dr.line([tuple(p[0]), tuple(p[1])], fill=(90, 140, 110, 60))
    out = np.asarray(im).astype(float) / 255
    out[zb < 1e8] = img[zb < 1e8]
    return out, zb
