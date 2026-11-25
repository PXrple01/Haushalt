"""Stage 4: final albedo for the Meshy model.
1. paint out unwanted marks of the AI texture (boxes in cleanup.json, e.g. brand-like logos)
2. anime cel shading from the bake (key light with cast shadows, AO, high-poly normals, rim light):
   3 tones per texel, cool shadows on cloth, warm shadows on skin, flat-lit face with hair shadows.

  python3 meshy_texture.py <meshy texture png> <bake.npz> <cleanup.json> <out.png> [preview.png]
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, gaussian_filter

KEY = np.array([-0.35, 0.80, 0.55]); KEY /= np.linalg.norm(KEY)
RIM = np.array([0.55, 0.35, -0.75]); RIM /= np.linalg.norm(RIM)


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def clean(img, boxes):
    a = np.asarray(img).astype(np.float32) / 255
    for b in boxes:
        x0, y0, x1, y1 = b['box']; m = b.get('margin', 24)
        X0, Y0, X1, Y1 = max(0, x0 - m), max(0, y0 - m), x1 + m, y1 + m
        reg = a[Y0:Y1, X0:X1]
        lum = reg.mean(-1); sat = reg.max(-1) - reg.min(-1)
        inside = np.zeros(lum.shape, bool); inside[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = True
        mark = inside & (lum > b.get('min_lum', 0.30)) & (sat < b.get('max_sat', 0.35))
        base = np.median(lum[inside & ~binary_dilation(mark, iterations=8)])
        halo = binary_dilation(mark, iterations=8) & (np.abs(lum - base) > 0.02)   # anti-aliased dark rim
        mask = binary_dilation(mark | halo, iterations=3)
        keep = (~mask).astype(np.float32)
        fill = np.stack([gaussian_filter(reg[..., c] * keep, 9) for c in range(3)], -1) / np.maximum(gaussian_filter(keep, 9), 1e-4)[..., None]
        reg[mask] = fill[mask]
        print(f'  cleaned {int(mask.sum())} texels in {b["box"]} ({b.get("why", "")})')
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def sleeve_crests(alb, d, decals):
    """Replace the AI sleeve patches with the project's own crest (texture2.crest_img), projected in 3D."""
    from texture2 import crest_img, project_decal
    H, W = d['mask'].shape
    A = np.asarray(alb.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    P = d['pos'].astype(np.float32); N = d['nrm'].astype(np.float32); M = d['mask']
    crest = crest_img(256)
    for dc in decals:
        c, o, up = (np.array(dc[k], np.float32) for k in ('center', 'out', 'up'))
        o /= np.linalg.norm(o); up = up - o * (up @ o); up /= np.linalg.norm(up); u = np.cross(up, o)
        dist = np.linalg.norm(P - c, axis=-1)
        region = M & (dist < dc['radius']) & ((N * o).sum(-1) > 0.15) & (np.abs(P[..., 0]) > dc.get('min_abs_x', 0))
        r, g, b = A[..., 0], A[..., 1], A[..., 2]
        lum = A.mean(-1)
        navy = (b > r + 0.04) & (lum < 0.32)
        green = (g > r * 1.3) & (g > b)
        patch = region & ~navy & ~green
        patch = binary_dilation(patch, iterations=2) & region & ~green
        keep = (region & navy).astype(np.float32)
        fill = np.stack([gaussian_filter(A[..., k] * keep, 6) for k in range(3)], -1) / np.maximum(gaussian_filter(keep, 6), 1e-4)[..., None]
        A[patch] = fill[patch]
        disc = region & (dist < dc['size'] * 0.75)
        rgb, a = project_decal(disc, P, u, up, c, dc['size'], crest)
        A[disc] = A[disc] * (1 - a[:, None]) + rgb * a[:, None]
        print(f'  sleeve crest at {dc["center"]}: {int(patch.sum())} patch texels replaced')
        if 'stray_box' in dc:                 # leftovers of the old patch on neighbouring islands
            lo_, hi_ = (np.array(v, np.float32) for v in dc['stray_box'])
            box = M & np.all((P >= lo_) & (P <= hi_), axis=-1)
            r, g, b = A[..., 0], A[..., 1], A[..., 2]
            warm = (r > 0.45) & (b < 0.35) & (r > g * 1.1)
            ink = (A.mean(-1) < 0.14) & ~navy                         # black print of the old patch
            stray = binary_dilation(box & (warm | ink), iterations=2) & box & ~green
            nv = (box & navy).astype(np.float32)
            fill = np.stack([gaussian_filter(A[..., k] * nv, 8) for k in range(3)], -1) / np.maximum(gaussian_filter(nv, 8), 1e-4)[..., None]
            A[stray] = fill[stray]
            print(f'    + {int(stray.sum())} stray texels')
    return Image.fromarray((np.clip(A, 0, 1) * 255).astype(np.uint8))


def _smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def recolor(alb, d, cfg):
    """Colour scheme change in texture space. Classes come from hue/value + the baked 3D position:
    accents (bright green), hair (dark teal above the neck), navy cloth split by height into jersey /
    shorts / tights. Each texel keeps its brightness relative to its class (folds, strands, print detail)."""
    H, W = d['mask'].shape
    A = np.asarray(alb.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    hsv = np.asarray(alb.resize((W, H), Image.LANCZOS).convert('HSV')).astype(np.float32) / 255
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    M = d['mask']; y = d['pos'][..., 1].astype(np.float32)
    lum = A @ np.array([0.299, 0.587, 0.114], np.float32)
    # soft class weights (anti-aliased edges get partial weight -> no coloured fringes)
    w_green = _smooth(80, 98, h) * (1 - _smooth(180, 195, h)) * _smooth(0.12, 0.30, s) * _smooth(0.06, 0.12, v)
    hairish = _smooth(148, 156, h) * _smooth(cfg['hair_min_y'] - 2, cfg['hair_min_y'] + 2, y)
    w_hair = w_green * hairish
    w_acc = w_green * (1 - hairish)
    w_navy = _smooth(188, 200, h) * (1 - _smooth(255, 268, h)) * _smooth(0.15, 0.30, s) * (1 - _smooth(0.42, 0.55, v))
    out = A.copy()

    def apply(weight, region, target, gamma=1.0, hi=None):
        m = M & (weight > 0.01) & region
        if not m.any():
            return 0
        ref = np.median(lum[m & (weight > 0.5)]) if (m & (weight > 0.5)).any() else np.median(lum[m])
        r = np.clip(lum / max(ref, 1e-3), 0, 3.0)
        T = np.broadcast_to(np.array(target, np.float32), A.shape).copy()
        if hi is not None:                                    # brighter texels drift towards a second colour
            t = _smooth(hi[1], hi[2], r)[..., None]
            T = T * (1 - t) + np.array(hi[0], np.float32) * t
        new = np.clip(T * (r ** gamma)[..., None], 0, 1)
        wt = (weight * m)[..., None]
        out[:] = out * (1 - wt) + new * wt
        return int((weight[m] > 0.5).sum())
    c = cfg['colors']
    n = {}
    n['accents'] = apply(w_acc, np.ones_like(M), c['accent'])
    n['hair'] = apply(w_hair, np.ones_like(M), c['hair'], 0.9, (c['hair_sheen'], 1.05, 1.9))
    yj, ys = cfg['jersey_min_y'], cfg['shorts_min_y']
    n['jersey'] = apply(w_navy * _smooth(yj - 1.5, yj + 1.5, y), np.ones_like(M), c['jersey'])
    n['shorts'] = apply(w_navy * _smooth(ys - 1.5, ys + 1.5, y) * (1 - _smooth(yj - 1.5, yj + 1.5, y)), np.ones_like(M), c['shorts'])
    n['tights'] = apply(w_navy * (1 - _smooth(ys - 1.5, ys + 1.5, y)), np.ones_like(M), c['tights'])
    print('  recolor: ' + ', '.join(f'{k} {v} texels' for k, v in n.items()))
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def shade(alb, d):
    H, W = d['mask'].shape
    A = np.asarray(alb.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    m = d['mask'].astype(np.float32)

    def denoise(x, s):
        return gaussian_filter(x * m, s) / np.maximum(gaussian_filter(m, s), 1e-3)
    N = d['nrm'].astype(np.float32); N /= np.linalg.norm(N, axis=-1, keepdims=True) + 1e-6
    P = d['pos'].astype(np.float32)
    AO = np.clip(denoise(d['ao'].astype(np.float32), 1.6), 0, 1)
    LT = np.clip(denoise(d['light'].astype(np.float32), 1.0) * np.pi, 0, 1)
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    mx, mn = A.max(-1), A.min(-1)
    skin = (r > 0.55) & (r > g * 1.08) & (g > b * 1.05) & (mx - mn > 0.08) & (mx - mn < 0.45)
    skin = gaussian_filter(skin.astype(np.float32), 1.2) > 0.5
    hair = (g > r * 1.15) & (y > 168)
    face = skin & (y > 160) & (z > -2)
    cosk = np.clip((N * KEY).sum(-1), 0, 1)
    lt = LT.copy()
    # face: flat anime lighting, only the hair casts a soft shadow
    hair_shadow = ss(0.40, 0.20, lt) * (cosk > 0.15)
    lt = np.where(face, 1.0 - 0.75 * hair_shadow, lt)
    t1 = ss(0.06, 0.13, lt); t2 = ss(0.26, 0.38, lt)
    sh_tint = np.where(skin[..., None], np.array([0.90, 0.75, 0.74]), np.array([0.68, 0.71, 0.86]))
    mid_tint = np.where(skin[..., None], np.array([0.97, 0.90, 0.89]), np.array([0.87, 0.88, 0.94]))
    sh = A * sh_tint; mid = A * mid_tint
    col = sh + (mid - sh) * t1[..., None] + (A - mid) * t2[..., None]
    ao_k = np.where(face, 0.92 + 0.08 * AO, 0.74 + 0.26 * AO)
    col *= ao_k[..., None]
    up = np.clip(N[..., 1], 0, 1)
    col *= (0.96 + 0.06 * up)[..., None]
    rim = ss(0.50, 0.85, (N * RIM).sum(-1)) * (~face) * AO
    col += (rim * 0.10)[..., None] * np.array([0.85, 1.0, 0.92])       # faint green-white rim (Flow)
    # hair: soft sheen band on surfaces facing up/forward
    sheen = ss(0.55, 0.8, (N * np.array([0.0, 0.85, 0.53])).sum(-1)) * ss(0.25, 0.45, lt) * hair
    col += (sheen * 0.08)[..., None] * np.array([0.8, 1.0, 0.9])
    col = np.where(m[..., None] > 0, col, A)
    print(f'  shading: skin {skin.mean() * 100:.1f}%  face {face.mean() * 100:.1f}%  hair {hair.mean() * 100:.1f}% of texels')
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))


def main():
    tex, bake, cfg, out = sys.argv[1:5]
    img = Image.open(tex).convert('RGB')
    conf = json.load(open(cfg))
    conf = conf if isinstance(conf, dict) else {'cleanup': conf}
    img = clean(img, conf.get('cleanup', []))
    d = np.load(bake)
    if conf.get('sleeve_crests'):
        img = sleeve_crests(img, d, conf['sleeve_crests'])
    if conf.get('recolor'):
        img = recolor(img, d, conf['recolor'])
    res = shade(img, d)
    res.save(out)
    if len(sys.argv) > 5:
        img.resize(res.size, Image.LANCZOS).save(sys.argv[5])
    print('albedo written', out)


if __name__ == '__main__':
    main()
