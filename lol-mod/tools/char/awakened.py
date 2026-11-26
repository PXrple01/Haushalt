"""Awakened ult form: a second texture of the striker's body atlas in which the hair tips, the jersey trims and seams
glow violet and a captain's armband sits on the left upper arm, plus the list of body triangles that change.
The build duplicates those triangles as the hidden submesh 'Awake' (pushed out a hair along the normal, own texture
via skinMeshProperties.materialOverride) and shows it while the R buff is on (PersistentEffectConditionData
SubmeshesToShow, like the Metavision eyes).

  python3 awakened.py [slot]   -> assets_src/char/<slot>_awake.png + <slot>_awake.npz (triangle ids)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import binary_dilation, gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
CHAR = os.path.join(HERE, '..', '..', 'assets_src', 'char')
GLOW = np.array([0.80, 0.52, 1.00]); CORE = np.array([0.97, 0.90, 1.00]); BAND = np.array([0.30, 0.10, 0.55])


def pos_map(P, uv, T, size):
    """Bind-pose position of every texel (uv in image convention: row = v * size). Returns pos, coverage."""
    H = W = size
    pos = np.zeros((H, W, 3), np.float32); cov = np.zeros((H, W), bool)
    px = uv[:, 0] * W - 0.5; py = uv[:, 1] * H - 0.5
    for t in T:
        xs, ys = px[t], py[t]
        x0, x1 = max(0, int(np.floor(xs.min()))), min(W - 1, int(np.ceil(xs.max())))
        y0, y1 = max(0, int(np.floor(ys.min()))), min(H - 1, int(np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        w2 = 1 - w0 - w1
        ins = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not ins.any():
            continue
        p = w0[..., None] * P[t[0]] + w1[..., None] * P[t[1]] + w2[..., None] * P[t[2]]
        sl = (slice(y0, y1 + 1), slice(x0, x1 + 1))
        pos[sl][ins] = p[ins]; cov[sl][ins] = True
    return pos, cov


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    slot = sys.argv[1] if len(sys.argv) > 1 else json.load(open(os.path.join(CHAR, 'model.json')))['model']
    d = np.load(os.path.join(CHAR, f'{slot}_rigged.npz'))
    lm = json.load(open(os.path.join(CHAR, f'{slot}_landmarks.json')))
    alb = Image.open(os.path.join(CHAR, f'{slot}_albedo.png')).convert('RGB')
    S = alb.width
    img = np.asarray(alb).astype(np.float32) / 255
    P = d['pos'].astype(np.float64); uv = d['uv'].astype(np.float64); T = d['tris'].astype(np.int64)
    pos, cov = pos_map(P, uv, T, S)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    mx = img.max(-1); mn = img.min(-1); sat = (mx - mn) / (mx + 1e-6)
    y = pos[..., 1]
    glow = np.zeros((S, S), np.float32)
    # ---- hair tips: dark blue/violet hair above the forehead, glowing towards the outer ends
    head = np.array(lm['Head']) + np.array([0, 8.0, 0])
    hair = cov & (b > g * 1.2) & (mx < 0.55) & (y > lm['Head'][1] - 4)
    rr = np.linalg.norm(pos - head, axis=-1)
    if hair.any():
        lo, hi = np.percentile(rr[hair], 55), np.percentile(rr[hair], 98)
        glow = np.maximum(glow, hair * smoothstep(lo, hi, rr) * 1.0)
    # ---- jersey trims (violet accents) and seams (blue | white borders) on the shirt
    shirt = cov & (y > lm['Root'][1] + 14) & (y < lm['Neck'][1] + 4)
    violet = shirt & (sat > 0.35) & (mx > 0.35) & (r > g * 1.15) & (b > g * 1.3)
    white = shirt & (mn > 0.70)
    blue = shirt & (b > 0.35) & (r < 0.35) & (b > r * 1.6)
    seam = (binary_dilation(white, iterations=3) & binary_dilation(blue, iterations=3)) & shirt
    glow = np.maximum(glow, violet * 0.85)
    glow = np.maximum(glow, seam * 0.95)
    out = img * (1 - glow[..., None]) + (GLOW * (1 - glow[..., None] * 0.25) + CORE * glow[..., None] * 0.25) * glow[..., None]
    # ---- captain's armband on the left upper arm (band + white 'C' on the outer side)
    sh, el = np.array(lm['L_Shoulder']), np.array(lm['L_Elbow'])
    ax = el - sh; ln = np.linalg.norm(ax); ax /= ln
    rel = pos - sh
    s = (rel @ ax) / ln
    radial = rel - (rel @ ax)[..., None] * ax
    out_dir = np.array([-1.0, 0, 0]) - (np.array([-1.0, 0, 0]) @ ax) * ax; out_dir /= np.linalg.norm(out_dir)
    up_dir = np.cross(ax, out_dir)
    phi = np.arctan2(radial @ up_dir, radial @ out_dir)          # 0 = outer side of the arm
    band = cov & (s > 0.30) & (s < 0.52) & (np.linalg.norm(radial, axis=-1) < 14)
    edge = band & ((s < 0.33) | (s > 0.49))
    out[band] = BAND
    out[edge] = GLOW
    # 'C': a ring arc in (phi, s) space centred on the outer side
    cs, cp = 0.41, 0.0
    du = (phi - cp) * 1.25; dv = (s - cs) / 0.09
    rc = np.hypot(du, dv); ang = np.arctan2(dv, du)
    letter = band & (np.abs(rc - 0.62) < 0.17) & (np.abs(ang) > 0.75)
    out[letter] = CORE
    changed = (glow > 0.05) | band
    awake = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
    awake.save(os.path.join(CHAR, f'{slot}_awake.png'))
    # triangles that touch a changed texel (corners + centroid, mask dilated by 3 texels)
    m = binary_dilation(changed, iterations=3)
    pts = np.concatenate([uv[T], uv[T].mean(1, keepdims=True)], 1)
    ix = np.clip((pts[..., 0] * S).astype(int), 0, S - 1); iy = np.clip((pts[..., 1] * S).astype(int), 0, S - 1)
    sel = m[iy, ix].any(1)
    np.savez_compressed(os.path.join(CHAR, f'{slot}_awake.npz'), tris=np.nonzero(sel)[0].astype(np.int32))
    print(f'awakened: hair {int(hair.sum())} texels, trims {int(violet.sum())}, seams {int(seam.sum())}, '
          f'armband {int(band.sum())}; {int(sel.sum())} of {len(T)} triangles in the overlay')


if __name__ == '__main__':
    main()
