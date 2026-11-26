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


def _segd(P, a, b):
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32); ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[..., None] * ab), axis=-1)


def arm_region(d, cfg):
    """Texels on upper arms, forearms and hands (distance to the arm bones of the posed model)."""
    import os
    path = cfg.get('landmarks')
    if not path:
        return np.zeros(d['mask'].shape, bool)
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', path)
    LM = json.load(open(path)); P = d['pos'].astype(np.float32)
    arm = np.zeros(d['mask'].shape, bool)
    for s_ in 'LR':
        arm |= _segd(P, LM[s_ + '_Shoulder'], LM[s_ + '_Elbow']) < 8.5
        arm |= _segd(P, LM[s_ + '_Elbow'], LM[s_ + '_Hand']) < 7.5
        arm |= _segd(P, LM[s_ + '_Hand'], LM[s_ + '_HandTip']) < 7.5
        arm &= ~((np.abs(P[..., 0]) < 21) & (P[..., 1] > 118))           # not the torso next to the shoulder
    return arm & d['mask']


def forearm_zones(d, cfg):
    """(forearm without the hand, hand beyond the wristband) as boolean texel masks."""
    import os
    path = cfg.get('landmarks')
    z = np.zeros(d['mask'].shape, bool)
    if not path:
        return z, z
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', path)
    LM = json.load(open(path)); P = d['pos'].astype(np.float32)
    fore = z.copy(); hand = z.copy()
    for s_ in 'LR':
        a, b, t = (np.asarray(LM[s_ + k], np.float32) for k in ('_Elbow', '_Hand', '_HandTip'))
        ab = b - a; ur = ((P - a) @ ab) / (ab @ ab); u = np.clip(ur, 0, 1)
        # the armband sits right at the elbow: the zone reaches 20 % of the forearm length above it
        fore |= (np.linalg.norm(P - (a + u[..., None] * ab), axis=-1) < 7.5) & (ur > -0.2) & (ur < 0.98)
        bt = t - b; v = ((P - b) @ bt) / (bt @ bt)
        hand |= (np.linalg.norm(P - (b + np.clip(v, 0, 1)[..., None] * bt), axis=-1) < 7.5) & (v > 0.22)
    return fore & d['mask'] & ~hand, hand & d['mask']


def wrist_region(d, cfg):
    import os
    path = cfg.get('landmarks')
    if not path:
        return np.zeros(d['mask'].shape, np.float32)
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', path)
    LM = json.load(open(path)); P = d['pos'].astype(np.float32)
    w = np.zeros(d['mask'].shape, np.float32)
    for s_ in 'LR':
        h_, t_ = np.asarray(LM[s_ + '_Hand'], np.float32), np.asarray(LM[s_ + '_HandTip'], np.float32)
        dist = np.linalg.norm(P - h_, axis=-1)
        v = ((P - h_) @ (t_ - h_)) / ((t_ - h_) @ (t_ - h_))          # > 0: towards the fingers
        w = np.maximum(w, (1 - _smooth(6.0, 7.5, dist)) * (1 - _smooth(0.05, 0.18, v)))
    return w * d['mask']


def inpaint(img, hole, valid, sigma=3.0, rounds=4):
    """Fill `hole` texels from the surrounding valid texels (normalised convolution, growing radius)."""
    out = img.copy(); known = (valid & ~hole).astype(np.float32); todo = hole.copy()
    for r in range(rounds):
        sg = sigma * (1.8 ** r)
        num = np.stack([gaussian_filter(out[..., k] * known, sg) for k in range(3)], -1)
        den = gaussian_filter(known, sg)[..., None]
        ok = todo & (den[..., 0] > 0.05)
        out[ok] = (num / np.maximum(den, 1e-6))[ok]
        known = np.maximum(known, ok.astype(np.float32)); todo &= ~ok
        if not todo.any():
            break
    return out


def despeckle(out, A, h, s, v, M, w_acc, w_navy, arm):
    """Meshy textures carry stray brush marks (green-grey strokes on skin, gold/grey flecks on bands, tiny
    green dots). A blob is repainted from its surroundings when it is small, or when it is enclosed almost
    entirely by skin or by navy cloth (a real detail like a stripe or a band touches other colours)."""
    from scipy.ndimage import label, binary_dilation as dil, find_objects
    skin = M & (A[..., 0] > 0.55) & (A[..., 0] > A[..., 1] * 1.05)
    navy = M & (w_navy > 0.5)
    cand = M & ~skin & ~navy
    lab, n = label(cand)
    hole = np.zeros(M.shape, bool)
    stats = {'tiny': 0, 'on_skin': 0, 'on_cloth': 0}
    for i, sl in enumerate(find_objects(lab)):
        if sl is None:
            continue
        y0, y1 = max(0, sl[0].start - 4), min(M.shape[0], sl[0].stop + 4)
        x0, x1 = max(0, sl[1].start - 4), min(M.shape[1], sl[1].stop + 4)
        comp = lab[y0:y1, x0:x1] == i + 1
        size = int(comp.sum())
        if size > 2500:
            continue
        ring = dil(comp, iterations=3) & ~comp & M[y0:y1, x0:x1]
        nr = max(int(ring.sum()), 1)
        f_skin = (ring & skin[y0:y1, x0:x1]).sum() / nr
        f_navy = (ring & navy[y0:y1, x0:x1]).sum() / nr
        is_acc = (w_acc[y0:y1, x0:x1][comp] > 0.5).mean() > 0.5
        on_arm = arm[y0:y1, x0:x1][comp].mean() > 0.5
        kind = None
        if size < 30 and is_acc:
            kind = 'tiny'
        elif f_skin > 0.8 and size < 600 and (on_arm or is_acc):
            kind = 'on_skin'
        elif f_navy > 0.75 and on_arm and not is_acc:
            kind = 'on_cloth'
        if kind:
            hole[y0:y1, x0:x1] |= comp; stats[kind] += size
    hole = dil(hole, iterations=2) & M
    print('  despeckle: ' + ', '.join(f'{k} {v_} texels' for k, v_ in stats.items()))
    return inpaint(out, hole, M & ~hole)


def seam_cleanup(img, cover, pos, band=12, radius=1.2, k=24, foreign=0.16):
    """Meshy's baked texture smears colours of neighbouring islands into the last pixels of an island (the
    green-grey stroke at the edge of the forearm island, violet after the recolour). Every texel of the border
    band is compared with the island-interior texels around it ON THE MODEL SURFACE (3D, across the seam, any
    island): if none of them has a similar colour, the border texel is foreign and takes the colour of the
    nearest interior texel. Hems, bands and stripes continue into some interior, so they stay."""
    from scipy.ndimage import distance_transform_edt
    from scipy.spatial import cKDTree
    A = np.asarray(img).astype(np.float32) / 255
    P = pos.astype(np.float32)
    dist = distance_transform_edt(cover)
    interior = cover & (dist > band)
    border = cover & (dist <= band)
    iy, ix = np.nonzero(interior)
    sel = (iy % 2 == 0) & (ix % 2 == 0)
    iy, ix = iy[sel], ix[sel]
    tree = cKDTree(P[iy, ix])
    by, bx = np.nonzero(border)
    dd, ii = tree.query(P[by, bx], k=k, distance_upper_bound=radius)
    ok = np.isfinite(dd)
    ii = np.where(ok, ii, 0)
    cols = A[iy[ii], ix[ii]]                                          # (N, k, 3)
    cd = np.linalg.norm(cols - A[by, bx][:, None, :], axis=-1)
    cd = np.where(ok, cd, 9.0)
    has_ref = ok.sum(1) >= 6
    is_foreign = has_ref & (cd.min(1) > foreign)
    A[by[is_foreign], bx[is_foreign]] = cols[is_foreign, 0]
    print(f'  seam cleanup (3D): {int(is_foreign.sum())} foreign border texels of {len(by)} replaced')
    return Image.fromarray((np.clip(A, 0, 1) * 255).astype(np.uint8))


def pad_islands(img, mask, px=16):
    """Edge padding: texels outside the UV islands take the colour of the nearest island texel, so bilinear
    filtering and mip-maps never pull in the old (un-recoloured, unshaded) Meshy colours at the seams."""
    from scipy.ndimage import distance_transform_edt
    a = np.asarray(img).copy()
    dist, (iy, ix) = distance_transform_edt(~mask, return_indices=True)
    fill = ~mask
    a[fill] = a[iy[fill], ix[fill]]
    return Image.fromarray(a)


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
    lum_fix = None
    # soft class weights (anti-aliased edges get partial weight -> no coloured fringes)
    w_green = _smooth(80, 98, h) * (1 - _smooth(180, 195, h)) * _smooth(0.12, 0.30, s) * _smooth(0.06, 0.12, v)
    hairish = _smooth(148, 156, h) * _smooth(cfg['hair_min_y'] - 2, cfg['hair_min_y'] + 2, y)
    w_hair = w_green * hairish
    w_acc = w_green * (1 - hairish)
    w_navy = _smooth(188, 200, h) * (1 - _smooth(255, 268, h)) * _smooth(0.15, 0.30, s) * (1 - _smooth(0.42, 0.55, v))
    # arms: sleeves, arm- and wristbands keep one colour whatever height the hanging arm reaches
    arm = arm_region(d, cfg).astype(np.float32)
    out = A.copy()
    out = despeckle(out, A, h, s, v, M, w_acc, w_navy, arm > 0.5)
    # forearm zones: everything that is not skin is band cloth -> armband = jersey blue, wristband = violet,
    # coloured strokes on the hand become skin (Meshy painted grey/gold flecks and a black half band there)
    wrist = wrist_region(d, cfg)
    fore, hand = forearm_zones(d, cfg)
    skin0 = (A[..., 0] > 0.50) & (A[..., 0] > A[..., 1] * 1.05) & (A[..., 2] < A[..., 1] * 1.05)
    nonskin = M & ~skin0
    w_acc = np.maximum(w_acc, nonskin * wrist); w_navy = w_navy * (1 - wrist)
    band = nonskin & fore & (wrist < 0.5) & (w_acc < 0.5)
    w_navy = np.maximum(w_navy, band.astype(np.float32))
    stroke = M & hand & (wrist < 0.5) & ~skin0 & (s > 0.22)
    if stroke.any():
        out = inpaint(out, stroke, M & skin0 & hand)
    # the band texels are recoloured from a mid-grey reference so the old flecks do not show through
    lum_fix = band | (nonskin & (wrist > 0.5))
    print(f'  forearm zones: {int(band.sum())} band texels -> blue, {int((nonskin & (wrist > 0.5)).sum())} -> violet, '
          f'{int(stroke.sum())} hand strokes -> skin')

    if lum_fix is not None:                 # flecks become plain cloth: brightness from the band's smooth shading
        from scipy.ndimage import median_filter
        lum = np.where(lum_fix, np.clip(gaussian_filter(np.where(lum_fix, lum, 0), 3) /
                                        np.maximum(gaussian_filter(lum_fix.astype(np.float32), 3), 1e-3), 0, 1), lum)
        lum = np.where(lum_fix, np.median(lum[lum_fix]) * 0.6 + lum * 0.4, lum)

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
    upper = np.maximum(_smooth(yj - 1.5, yj + 1.5, y), arm)
    n['jersey'] = apply(w_navy * upper, np.ones_like(M), c['jersey'])
    n['shorts'] = apply(w_navy * _smooth(ys - 1.5, ys + 1.5, y) * (1 - upper), np.ones_like(M), c['shorts'])
    n['tights'] = apply(w_navy * (1 - _smooth(ys - 1.5, ys + 1.5, y)) * (1 - arm), np.ones_like(M), c['tights'])
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
    cover = None
    if 'mask_hi' in d.files:
        cover = d['mask_hi']
        img = seam_cleanup(img.resize(cover.shape[::-1], Image.LANCZOS), cover, d['pos'])
    if conf.get('sleeve_crests'):
        img = sleeve_crests(img, d, conf['sleeve_crests'])
    if conf.get('recolor'):
        img = recolor(img, d, conf['recolor'])
    res = shade(img, d)
    res = pad_islands(res, cover if cover is not None else d['mask'])
    res.save(out)
    if len(sys.argv) > 5:
        img.resize(res.size, Image.LANCZOS).save(sys.argv[5])
    print('albedo written', out)


if __name__ == '__main__':
    main()
