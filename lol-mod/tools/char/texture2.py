"""Texture painter v2: anime cel shading from baked light (with hair shadows), 3-tone ramps,
fabric, seams, crest, sock ribbing, boot details, hair strands + zigzag highlights, detailed eyes,
and ink patches for the outline shell. Everything here is procedural original art."""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', '..', 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')
A = lambda *v: np.array(v, np.float32)
PAL = dict(
    skin=A(1.0, 0.86, 0.76), skin_mid=A(0.97, 0.75, 0.66), skin_sh=A(0.86, 0.60, 0.56),
    jersey=A(0.08, 0.15, 0.36), jersey_mid=A(0.055, 0.105, 0.27), jersey_sh=A(0.03, 0.06, 0.17),
    panel=A(0.055, 0.11, 0.28),
    white=A(0.97, 0.98, 0.97), white_mid=A(0.86, 0.90, 0.92), white_sh=A(0.66, 0.74, 0.80),
    shorts=A(0.055, 0.10, 0.24), shorts_mid=A(0.04, 0.075, 0.18), shorts_sh=A(0.022, 0.042, 0.11),
    tights=A(0.042, 0.068, 0.155), tights_mid=A(0.03, 0.05, 0.118), tights_sh=A(0.018, 0.03, 0.076),
    accent=A(0.15, 0.66, 0.36), accent_mid=A(0.11, 0.52, 0.30), accent_sh=A(0.07, 0.36, 0.22),
    boot=A(0.12, 0.13, 0.14), boot_mid=A(0.08, 0.09, 0.10), boot_sh=A(0.045, 0.05, 0.06),
    neon=A(0.36, 0.95, 0.55), neon_mid=A(0.27, 0.80, 0.45), neon_sh=A(0.18, 0.58, 0.34),
    hair=A(0.10, 0.39, 0.22), hair_mid=A(0.07, 0.29, 0.17), hair_sh=A(0.035, 0.17, 0.10), hair_hi=A(0.42, 0.78, 0.52),
)
INK_DARK = A(0.025, 0.04, 0.085)
INK_SKIN = A(0.34, 0.17, 0.13)
LINE = A(0.07, 0.07, 0.09); BROW = A(0.05, 0.19, 0.11); MOUTH = A(0.60, 0.31, 0.28)
IRIS_TOP = A(0.42, 0.18, 0.02); IRIS_BOT = A(1.0, 0.76, 0.24); PUPIL = A(0.14, 0.06, 0.02)
RIM_DIR = np.array([0.65, 0.45, -0.62]); RIM_DIR /= np.linalg.norm(RIM_DIR)


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def seg_t(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return t, np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


def glyph(text, size=256, scale=0.95):
    img = Image.new('L', (size, size), 0)
    ImageDraw.Draw(img).text((size / 2, size / 2), text, font=ImageFont.truetype(FONT, int(size * scale)), fill=255, anchor='mm')
    return np.asarray(img).astype(np.float32) / 255


def crest_img(size=256):
    """Original club crest: shield, a football, a small star. Returns RGBA float."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    s = size
    shield = [(0.14 * s, 0.10 * s), (0.86 * s, 0.10 * s), (0.86 * s, 0.52 * s), (0.5 * s, 0.94 * s), (0.14 * s, 0.52 * s)]
    d.polygon(shield, fill=(250, 250, 250, 255))
    inner = [(0.21 * s, 0.17 * s), (0.79 * s, 0.17 * s), (0.79 * s, 0.50 * s), (0.5 * s, 0.84 * s), (0.21 * s, 0.50 * s)]
    d.polygon(inner, fill=(22, 110, 60, 255))
    c, r = (0.5 * s, 0.47 * s), 0.17 * s
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=(250, 250, 250, 255))
    pent = [(c[0] + 0.45 * r * np.cos(np.radians(-90 + 72 * k)), c[1] + 0.45 * r * np.sin(np.radians(-90 + 72 * k))) for k in range(5)]
    d.polygon(pent, fill=(20, 20, 24, 255))
    st = [(0.5 * s + (0.07 if k % 2 == 0 else 0.03) * s * np.cos(np.radians(-90 + 36 * k)),
           0.24 * s + (0.07 if k % 2 == 0 else 0.03) * s * np.sin(np.radians(-90 + 36 * k))) for k in range(10)]
    d.polygon(st, fill=(250, 230, 120, 255))
    return np.asarray(img).astype(np.float32) / 255


def project_decal(mask, P, u_axis, v_axis, center, size, img):
    """Sample an RGBA decal by planar projection; returns (rgb, alpha) for masked texels."""
    q = P[mask] - center
    u = (q @ u_axis) / size + 0.5
    v = 0.5 - (q @ v_axis) / size
    ok = (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    H, W = img.shape[:2]
    iu = np.clip((u * (W - 1)).astype(int), 0, W - 1); iv = np.clip((v * (H - 1)).astype(int), 0, H - 1)
    px = img[iv, iu]
    a = px[:, 3] * ok if px.shape[1] == 4 else px[:, 0] * ok
    return px[:, :3] if px.shape[1] == 4 else None, a


def paint(baked, raw, joints_json, out_png, out_json):
    d = np.load(baked); r = np.load(raw)
    H, W = d['mask'].shape
    P = d['pos'].reshape(-1, 3).astype(np.float64)
    N = d['nrm'].reshape(-1, 3).astype(np.float64); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    part = d['partmap'].reshape(-1).astype(int)
    from scipy.ndimage import gaussian_filter

    def denoise(a, sigma):                     # normalised convolution: blur only inside the islands
        m = d['mask'].astype(np.float32)
        return gaussian_filter(a * m, sigma) / np.maximum(gaussian_filter(m, sigma), 1e-3)
    AO = denoise(d['ao'], 2.2).reshape(-1)
    LT = np.clip(denoise(d['light'], 1.0).reshape(-1) * np.pi, 0, 1)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    J = {j['name']: np.array(j['pos']) for j in json.load(open(joints_json))['joints']}
    n = len(P)
    mat = np.full(n, '', dtype=object)          # material name per texel
    col_override = np.zeros((n, 3), np.float32); has_override = np.zeros(n, bool)

    def setm(m, name):
        mat[m] = name

    body, head, cap, locks, hands, studs, band = [part == k for k in range(7)]
    setm(body, 'jersey'); setm(head | hands, 'skin'); setm(cap | locks, 'hair'); setm(studs, 'neon'); setm(band, 'shorts')
    # ---------------- arms
    arm_any = np.zeros(n, bool)
    for s, sx in (('L', -1), ('R', 1)):
        S, E, Hn = J[s + '_Shoulder'], J[s + '_Elbow'], J[s + '_Hand']
        tu, du = seg_t(P, S, E); tf, df = seg_t(P, E, Hn)
        outside = (x * sx) > 15.5
        upper = body & outside & (du < 11) & (tu > 0.0)
        fore = body & outside & (df < 9.5) & (tf > 0.02)
        arm = upper | fore; arm_any |= arm
        setm(arm & (tu > 0.50), 'skin'); setm(fore, 'skin')
        setm(upper & (tu <= 0.50), 'jersey')
        out_dir = np.array([sx * 0.8, 0.6, 0.0]); out_dir /= np.linalg.norm(out_dir)
        cuff = upper & (tu > 0.42) & (tu <= 0.50) & ((N @ out_dir) > -0.25)      # no white under the arm (stretches)
        setm(cuff, 'white'); setm(cuff & (np.abs(tu - 0.445) < 0.008), 'accent')
    torso = body & ~arm_any
    # ---------------- neck / collar / V
    rad_neck = np.hypot(x, (z + 1.4) * 1.05)
    setm(torso & (y > 166.0) & (rad_neck < 7.9), 'skin')
    collar = torso & (np.abs(y - 168.0) < 1.55) & (rad_neck >= 6.6) & (rad_neck < 10.0)
    setm(collar, 'white')
    vopen = torso & (z > 2.0) & (y > 157.5) & (np.abs(x) < (y - 157.5) * 0.52) & (y < 168.5)
    setm(vopen, 'skin')
    vtrim = torso & (z > 2.0) & (y > 157.0) & (np.abs(np.abs(x) - (y - 157.5) * 0.52) < 0.85) & (y < 167)
    setm(vtrim, 'white')
    # ---------------- jersey panels, seams, sash, crest, number
    jersey = torso & (y > 121.2) & ~collar & ~vopen & ~vtrim & (mat == 'jersey')
    side_panel = jersey & (np.abs(x) > 11.8) & (y < 158)
    setm(side_panel, 'panel')
    raglan = jersey & (y > 148) & (np.abs(np.abs(x) - (7.5 + (171 - y) * 0.62)) < 0.28)
    side_seam = jersey & (np.abs(np.abs(x) - 11.8) < 0.22) & (y < 158)
    a2 = np.array([13.5, 165.0]); b2 = np.array([-14.5, 122.5])
    nd = np.array([-(b2 - a2)[1], (b2 - a2)[0]]); nd /= np.linalg.norm(nd)
    dist = (np.stack([x, y], 1) - a2) @ nd
    sash = jersey & (z > -1.0) & (np.abs(dist) < 3.1) & (y < 166)
    setm(sash, 'white')
    setm(jersey & (z > -1.0) & (np.abs(np.abs(dist) - 3.55) < 0.42) & (y < 166), 'accent')
    hem = torso & (y > 121.2) & (y < 123.0)
    setm(hem, 'jersey_dark')
    num = glyph('8')
    back = torso & (z < -3.0) & (np.abs(x) < 8.0) & (y > 139) & (y < 161)
    u = ((x[back] + 8.0) / 16.0 * 255).astype(int).clip(0, 255); v = ((161 - y[back]) / 22.0 * 255).astype(int).clip(0, 255)
    idx = np.where(back)[0][num[v, u] > 0.5]; setm(np.isin(np.arange(n), idx), 'white')
    crest = crest_img()
    cm = torso & (z > 3.0) & (np.abs(x + 7.2) < 3.0) & (np.abs(y - 158.6) < 3.2) & ~sash
    rgb, al = project_decal(cm, P, np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), np.array([-7.2, 158.6, 9.0]), 5.6, crest)
    ci = np.where(cm)[0][al > 0.5]
    col_override[ci] = rgb[al > 0.5]; has_override[ci] = True
    # ---------------- shorts, legs, socks, boots
    hem_y = J['L_Hip'][1] - 0.42 * (J['L_Hip'][1] - J['L_KneeLower'][1]) - 0.5
    shorts = torso & (y <= 121.2) & (y > hem_y)
    setm(shorts, 'shorts')
    stripe = shorts & ((np.abs(x) - 10.6) > 6.4)
    setm(stripe, 'accent'); setm(shorts & (np.abs((np.abs(x) - 10.6) - 6.4) < 0.25), 'white')
    setm(shorts & (y < hem_y + 1.2), 'shorts_dark')
    sn = glyph('8')
    sfront = shorts & (z > 4) & (np.abs(x + 12.5) < 2.2) & (np.abs(y - 108.5) < 3.0)
    u = ((x[sfront] + 12.5 + 2.2) / 4.4 * 255).astype(int).clip(0, 255); v = ((108.5 + 3.0 - y[sfront]) / 6.0 * 255).astype(int).clip(0, 255)
    idx = np.where(sfront)[0][sn[v, u] > 0.5]; setm(np.isin(np.arange(n), idx), 'white')
    kn_y, ft_y = J['L_KneeLower'][1], J['L_Foot'][1]
    legs = torso & (y <= hem_y)
    setm(legs, 'tights')                                                  # long base-layer pants under the shorts
    sock_top = kn_y - 0.16 * (kn_y - ft_y)
    socks = legs & (y < sock_top) & (y > 17.0)
    setm(socks, 'white')
    setm(socks & (((y > sock_top - 5.2) & (y < sock_top - 3.6)) | ((y > sock_top - 2.4) & (y < sock_top - 0.8))), 'accent')
    boots = legs & (y <= 17.0)
    setm(boots, 'boot')
    for s in ('L', 'R'):
        bx = J[s + '_Foot'][0]
        side_b = boots & (np.sign(x) == np.sign(bx)) & (np.abs(np.abs(x - bx) - 0) > 2.6)
        flow = side_b & (np.abs(y - (4.6 + 0.16 * z + 0.9 * np.sin(z * 0.35))) < 0.75)
        setm(flow, 'accent')
    setm(boots & (y < 2.2), 'neon')
    collar_b = boots & (y > 13.8)
    setm(collar_b, 'boot_dark')
    # ---------------- 3-tone cel shading
    names = list(PAL.keys())
    base = np.zeros((n, 3), np.float32); mid = np.zeros((n, 3), np.float32); sh = np.zeros((n, 3), np.float32)
    alias = {'jersey_dark': 'jersey_sh_base', 'shorts_dark': 'shorts_mid_base', 'boot_dark': 'boot_mid_base', 'panel': 'panel'}
    for name in set(mat.tolist()):
        m = mat == name
        if name == 'panel':
            b, mi, s_ = PAL['panel'], PAL['jersey_sh'] * 1.15, PAL['jersey_sh'] * 0.8
        elif name == 'jersey_dark':
            b, mi, s_ = PAL['jersey_mid'], PAL['jersey_sh'], PAL['jersey_sh'] * 0.75
        elif name == 'shorts_dark':
            b, mi, s_ = PAL['shorts_mid'], PAL['shorts_sh'], PAL['shorts_sh'] * 0.8
        elif name == 'boot_dark':
            b, mi, s_ = PAL['boot_mid'], PAL['boot_sh'], PAL['boot_sh'] * 0.8
        elif name in ('', None):
            continue
        else:
            b, mi, s_ = PAL[name], PAL.get(name + '_mid', PAL[name] * 0.8), PAL.get(name + '_sh', PAL[name] * 0.6)
        base[m] = b; mid[m] = mi; sh[m] = s_
    base[has_override] = col_override[has_override]
    mid[has_override] = col_override[has_override] * 0.85
    sh[has_override] = col_override[has_override] * 0.65
    face = head & (z > -3.0) & (y > 178.5)
    lt = LT.copy()
    kdir = np.array([-0.35, 0.80, 0.55]); kdir /= np.linalg.norm(kdir)
    cosk = np.clip(N @ kdir, 0, 1)
    cast = lt < 0.55 * cosk - 0.02                                             # in a cast shadow
    lt[face] = np.where(cast[face] & (y[face] > 193.5), 0.20, np.where((N[face] @ kdir) < -0.25, 0.20, 0.9))
    t1 = ss(0.07, 0.12, lt); t2 = ss(0.28, 0.36, lt)
    col = sh + (mid - sh) * t1[:, None] + (base - mid) * t2[:, None]
    col *= (0.80 + 0.20 * AO)[:, None]
    col *= (0.95 + 0.05 * np.clip(N[:, 1], 0, 1))[:, None]
    rim = ss(0.55, 0.85, N @ RIM_DIR) * (~face)
    col += (rim * 0.10)[:, None] * np.array([1.0, 1.0, 0.95])
    # fabric micro detail
    knit = (np.sin(x * 2.4 + y * 2.4) * np.sin(x * 2.4 - y * 2.4))
    fab = ((mat == 'jersey') | (mat == 'panel') | (mat == 'shorts')) & ~socks
    col[fab] *= (1.0 + 0.010 * knit[fab])[:, None]
    dots = (np.sin(x * 3.1) * np.sin(y * 3.1) * np.sin(z * 3.1)) > 0.55
    col[(mat == 'panel') & dots] *= 0.93
    # stitches
    stitch = (raglan | side_seam) & ((np.floor((y + x) * 1.3) % 2) == 0)
    col[raglan | side_seam] *= 0.80
    col[stitch] = col[stitch] * 0.6 + PAL['white'] * 0.4 * 0.6
    # sock ribbing
    for s in ('L', 'R'):
        kx = J[s + '_KneeLower'][0]
        ang = np.arctan2(z, x - kx)
        rib = socks & (np.sign(x) == np.sign(kx))
        col[rib] *= (0.975 + 0.025 * np.sin(ang[rib] * 16))[:, None]
    # tights: compression sheen and an outer seam
    tg = mat == 'tights'
    col[tg] += (ss(0.82, 0.95, N[tg] @ hvec_t) * 0.10)[:, None] if False else 0
    # boot gloss
    view = np.array([0.0, 0.55, 0.83]); hvec = view + np.array([-0.35, 0.80, 0.55]); hvec /= np.linalg.norm(hvec)
    spec = ss(0.90, 0.97, N @ hvec)
    gl = (mat == 'boot') | (mat == 'boot_dark') | (mat == 'shorts') | (mat == 'tights')
    col[gl] += (spec[gl] * np.where(mat[gl] == 'tights', 0.12, 0.22))[:, None]
    for s_ in ('L', 'R'):
        kx = J[s_ + '_KneeLower'][0]
        seam = (mat == 'tights') & (np.sign(x) == np.sign(kx)) & (np.abs(np.abs(x - kx) - 5.0) < 0.22) & (np.abs(z) < 2.5)
        col[seam] *= 0.78
    # ---------------- hair: strands along the flow, zigzag highlights
    hair = cap | locks
    cl = r['locks_cl']; cln = r['locks_cl_n']
    tangents, tvals = [], []
    for k, cnt in enumerate(cln):
        seg = cl[int(cln[:k].sum()):int(cln[:k].sum()) + cnt]
        tg = np.gradient(seg, axis=0); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
        tangents.append(tg); tvals.append(np.linspace(0, 1, cnt))
    tree = cKDTree(cl); TG = np.vstack(tangents); TV = np.concatenate(tvals)
    hi_ = np.where(hair)[0]
    _, nn = tree.query(P[hi_])
    flow = TG[nn]; tpar = TV[nn]
    crown = np.array([0.0, 212.0, -2.0])
    capi = cap[hi_]
    capi_full = capi.copy()
    rad = P[hi_][capi] - crown
    fl_cap = rad - N[hi_][capi] * np.sum(rad * N[hi_][capi], 1, keepdims=True)
    flow[capi] = fl_cap / (np.linalg.norm(fl_cap, axis=1, keepdims=True) + 1e-9); tpar[capi] = 0.0
    a1 = np.cross(flow, N[hi_]); a1 /= np.linalg.norm(a1, axis=1, keepdims=True) + 1e-9
    across = np.sum(P[hi_] * a1, 1)
    along = np.sum(P[hi_] * flow, 1)
    strands = 0.5 + 0.5 * np.sin(across * 2.6 + 0.8 * np.sin(along * 0.6))
    col[hi_] *= (0.93 + 0.09 * strands)[:, None]
    col[hi_] *= (0.92 + 0.12 * tpar)[:, None]
    up = np.array([0.0, 0.86, 0.50]); up /= np.linalg.norm(up)
    nd_up = N[hi_] @ up + 0.05 * np.sin(across * 2.2)
    crown_d = np.linalg.norm(P[hi_] - crown, axis=1)
    ring = (nd_up > 0.80) & (nd_up < 0.92) & (P[hi_, 1] > 197.5) & (LT[hi_] > 0.12) & (crown_d > 7.0) & ~capi_full
    col[hi_[ring]] = col[hi_[ring]] * 0.30 + PAL['hair_hi'] * 0.70
    tipglow = (tpar > 0.75) & (LT[hi_] > 0.2)
    col[hi_[tipglow]] *= 1.10
    # ---------------- face paint (front projection)
    ff = head & (z > 4.0) & (y > 181)
    for side in (-1, 1):
        cx, cy = side * 4.9, 193.4
        lx = (x - cx) * side; ly = y - cy
        m = ff & (np.abs(lx) < 6) & (np.abs(ly) < 7.5)
        e = ((lx - 0.2) / 3.25) ** 2 + ((ly - 0.1) / np.where(ly > 0.1, 2.7, 2.35)) ** 2
        sclera = m & (e < 1.0)
        col[sclera] = A(0.97, 0.97, 0.99)
        col[sclera & (ly > 1.2)] = col[sclera & (ly > 1.2)] * 0.80 + A(0.55, 0.62, 0.74) * 0.20      # lid shadow
        ir = (lx / 2.05) ** 2 + ((ly + 0.15) / 2.6) ** 2
        iris = sclera & (ir < 1.0)
        g = np.clip((ly[iris] + 2.6) / 5.2, 0, 1)[:, None]
        ang = np.arctan2(ly[iris] + 0.15, lx[iris])
        streak = (0.92 + 0.08 * np.sin(ang * 15))[:, None]
        col[iris] = (IRIS_BOT * (1 - g) + IRIS_TOP * g) * streak
        col[sclera & (ir >= 0.78) & (ir < 1.0)] = IRIS_TOP * 0.75
        pup = iris & ((lx / 0.82) ** 2 + ((ly + 0.25) / 1.30) ** 2 < 1.0)
        col[pup] = PUPIL
        hl1 = sclera & (((lx + 0.75) / 0.80) ** 2 + ((ly - 0.95) / 0.62) ** 2 < 1.0)
        hl2 = sclera & (((lx - 0.65) / 0.34) ** 2 + ((ly + 1.25) / 0.34) ** 2 < 1.0)
        hl3 = sclera & (((lx - 1.15) / 0.18) ** 2 + ((ly - 0.75) / 0.18) ** 2 < 1.0)
        col[hl1 | hl2 | hl3] = A(1, 1, 1)
        th = 0.55 + 0.38 * ss(-2.5, 3.0, lx)
        upper_curve = 0.1 + 2.7 * np.sqrt(np.clip(1 - ((lx - 0.2) / 3.25) ** 2, 0, 1))
        lash = m & (lx > -3.2) & (lx < 3.5) & (ly > upper_curve - 0.15) & (ly < upper_curve + th)
        spikes = m & (lx > 2.4) & (lx < 4.6) & (((np.abs(ly - (1.9 + (lx - 2.4) * 0.45)) < 0.20 - (lx - 2.4) * 0.07)) |
                                                 ((np.abs(ly - (1.2 + (lx - 2.4) * 0.30)) < 0.18 - (lx - 2.4) * 0.06) & (lx < 4.2)))
        col[lash | spikes] = LINE
        crease = m & (lx > -1.4) & (lx < 3.0) & (np.abs(ly - (upper_curve + th + 0.85)) < 0.12)
        col[crease] = col[crease] * 0.72
        lower_curve = 0.1 - 2.35 * np.sqrt(np.clip(1 - ((lx - 0.2) / 3.25) ** 2, 0, 1))
        lower = m & (lx > -0.3) & (lx < 3.3) & (np.abs(ly - lower_curve + 0.05) < 0.16)
        col[lower] = col[lower] * 0.35 + LINE * 0.65
        bt = np.clip((lx + 2.8) / 6.4, 0, 1)
        by = 4.25 + bt * 1.35 - 0.6 * (bt - 0.55) ** 2
        bw = 1.0 - 0.55 * bt
        brow = m & (lx > -2.8) & (lx < 3.6) & (np.abs(ly - by) < bw / 2 + 0.05)
        col[brow] = BROW
    nose = ff & (x > 0.15) & (x < 0.95) & (y > 188.3) & (y < 190.0) & (np.abs(x - 0.55 - (y - 189.15) * 0.25) < 0.20)
    col[nose] *= 0.82
    mx = x / 1.9
    mouth = ff & (np.abs(mx) < 1.0) & (np.abs(y - (184.55 + 0.35 * mx ** 2)) < 0.16)
    col[mouth] = MOUTH
    lip = ff & (np.abs(x) < 1.1) & (np.abs(y - 183.7) < 0.35)
    col[lip] *= 0.93
    ears = head & (np.abs(x) > 11.0) & (y > 189) & (y < 196.5)
    col[ears] *= 0.94
    # ---------------- ink patches for the outline shell (in empty texture space)
    img = np.clip(col.reshape(H, W, 3), 0, 1)
    cover = d['mask']
    patches = {}
    from scipy.ndimage import binary_dilation
    occ = binary_dilation(cover, iterations=14)
    for name, c in (('ink_dark', INK_DARK), ('ink_skin', INK_SKIN)):
        found = None
        for yy in range(16, H - 48, 8):
            row = occ[yy:yy + 32]
            free = ~row.any(0)
            run = 0
            for xx in range(16, W - 16):
                run = run + 1 if free[xx] else 0
                if run >= 32:
                    found = (yy, xx - 31); break
            if found:
                break
        yy, xx = found
        img[yy:yy + 32, xx:xx + 32] = c
        occ[yy - 8:yy + 40, xx - 8:xx + 40] = True
        patches[name] = ((xx + 16) / W, (yy + 16) / H)          # (u, v) with v from the top
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), 'RGB').save(out_png)
    json.dump(patches, open(out_json, 'w'))


if __name__ == '__main__':
    paint(*sys.argv[1:6])
