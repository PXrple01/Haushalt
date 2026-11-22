"""Generates all original art for the mod (soccer ball, chains, METAVISION eye, light FX).

Everything here is procedural and made for this project. Outputs PNG sources to
assets_src/gen/ (for review) - the build step converts them to .tex/.scb.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets_src', 'gen')
FONT = os.path.join(ROOT, 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')

FLOW = np.array([0.08, 0.62, 0.28])       # Flow dark green
DEEP = np.array([0.01, 0.32, 0.14])       # very dark emerald
HIGHLIGHT = np.array([0.62, 0.98, 0.72])  # light green core


def save(arr, name):
    os.makedirs(OUT, exist_ok=True)
    arr = np.clip(arr, 0, 1)
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name + '.png'))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ===================================================================== soccer ball
PHI = (1 + 5 ** 0.5) / 2
_ico = []
for a in (-1, 1):
    for b in (-PHI, PHI):
        _ico += [(0, a, b), (a, b, 0), (b, 0, a)]
ICO = np.array(_ico, float)
ICO /= np.linalg.norm(ICO, axis=1, keepdims=True)
_faces = []
for i in range(12):
    for j in range(i + 1, 12):
        for k in range(j + 1, 12):
            if min(ICO[i] @ ICO[j], ICO[j] @ ICO[k], ICO[i] @ ICO[k]) > 0.4:
                _faces.append(ICO[i] + ICO[j] + ICO[k])
HEX = np.array(_faces)
HEX /= np.linalg.norm(HEX, axis=1, keepdims=True)
assert len(HEX) == 20
H_PENT, H_HEX = 2.32744, 2.26728          # truncated icosahedron face distances (edge = 1)
CENTERS = np.vstack([ICO, HEX])
DIST = np.array([H_PENT] * 12 + [H_HEX] * 20)


def classify(d):
    """d: (...,3) unit directions -> (is_pentagon, edge_measure)."""
    s = (d @ CENTERS.T) / DIST
    idx = np.argsort(-s, axis=-1)
    s1 = np.take_along_axis(s, idx[..., :1], -1)[..., 0]
    s2 = np.take_along_axis(s, idx[..., 1:2], -1)[..., 0]
    e = (s1 - s2) / np.maximum(s1, 1e-6)
    return idx[..., 0] < 12, e


def ball_albedo(d, noise=None):
    pent, e = classify(d)
    base = np.where(pent[..., None], np.array([0.085, 0.085, 0.11]), np.array([0.955, 0.955, 0.97]))
    bulge = 0.80 + 0.20 * smoothstep(0.0, 0.06, e)          # panels puff up, darker at seams
    col = base * bulge[..., None]
    seam = 1 - smoothstep(0.004, 0.009, e)                  # thin dark stitch line
    col = col * (1 - seam[..., None]) + np.array([0.16, 0.16, 0.2]) * seam[..., None]
    if noise is not None:
        col = col * (1 + noise[..., None] * 0.035)
    return col, e


def seam_glow(e):
    return np.clip(np.exp(-(e / 0.0075) ** 2) + 0.45 * np.exp(-(e / 0.024) ** 2), 0, 1)


def equirect_dirs(w, h):
    u = (np.arange(w) + 0.5) / w
    v = (np.arange(h) + 0.5) / h
    lon = u * 2 * np.pi - np.pi
    lat = np.pi / 2 - v * np.pi
    lon, lat = np.meshgrid(lon, lat)
    return np.stack([np.cos(lat) * np.cos(lon), np.sin(lat), np.cos(lat) * np.sin(lon)], -1)


def make_ball_textures():
    w, h = 1024, 512
    d = equirect_dirs(w, h)
    rng = np.random.default_rng(7)
    noise = np.asarray(Image.fromarray((rng.random((h // 4, w // 4)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255 - 0.5
    col, e = ball_albedo(d, noise)
    save(np.concatenate([col, np.ones((h, w, 1))], -1), 'ball_albedo')
    g = seam_glow(e)
    save(np.stack([g, g, g, g], -1), 'ball_seams_glow')


def rot_to(a, b):
    """rotation matrix taking unit vector a to unit vector b"""
    v = np.cross(a, b); c = a @ b
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def make_ball_sprite(name, glow=0.35, rim=0.25, seam_emit=0.0, size=256):
    R = 0.80
    y, x = np.mgrid[size - 1:-1:-1, 0:size] / (size - 1) * 2 - 1
    x = x.astype(float); y = y.astype(float)
    r = np.sqrt(x * x + y * y)
    inside = r < R
    nz = np.sqrt(np.clip(1 - (r / R) ** 2, 0, 1))
    n = np.stack([x / R, y / R, nz], -1)
    # turn the ball so a pentagon sits slightly off-centre (reads as a football instantly)
    target = np.array([0.18, 0.22, 1.0]); target /= np.linalg.norm(target)
    M = rot_to(target, ICO[0])
    d = n @ M.T
    col, e = ball_albedo(d)
    shade = 0.58 + 0.42 * nz ** 0.55                       # rotation-symmetric -> safe to spin
    col = col * shade[..., None]
    fres = (1 - nz) ** 2.2
    col = col * (1 - rim * fres[..., None]) + FLOW * (rim * 1.6 * fres[..., None])
    if seam_emit > 0:
        g = seam_glow(e / (1 + 0.8 * seam_emit))[..., None] * seam_emit
        col = col * (1 - 0.8 * np.clip(g, 0, 1)) + (FLOW * 1.0 + HIGHLIGHT * 0.45) * g * 1.25
    aa = 1 - smoothstep(R - 0.008, R + 0.004, r)
    halo = glow * np.exp(-((r - R) / 0.075) ** 2) * (r >= R - 0.01)
    rgb = col * aa[..., None] + (FLOW * 0.9 + 0.1) * halo[..., None] * (1 - aa[..., None])
    a = np.clip(aa + halo * (1 - aa), 0, 1)
    rgb = np.where(a[..., None] > 1e-4, rgb / np.maximum(a[..., None], 1e-4) * np.minimum(a[..., None], 1), 0)
    save(np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1), name)


def uv_sphere(radius, seg=32, rings=20):
    """positions (N,3), normals, uvs (N,2) and triangles; uv matches equirect_dirs."""
    pos, nrm, uv = [], [], []
    for j in range(rings + 1):
        v = j / rings
        lat = np.pi / 2 - v * np.pi
        for i in range(seg + 1):
            u = i / seg
            lon = u * 2 * np.pi - np.pi
            n = np.array([np.cos(lat) * np.cos(lon), np.sin(lat), np.cos(lat) * np.sin(lon)])
            pos.append(n * radius); nrm.append(n); uv.append((u, v))
    tris = []
    for j in range(rings):
        for i in range(seg):
            a = j * (seg + 1) + i; b = a + seg + 1
            if j != 0:
                tris.append((a, b, a + 1))
            if j != rings - 1:
                tris.append((a + 1, b, b + 1))
    return np.array(pos, np.float32), np.array(nrm, np.float32), np.array(uv, np.float32), np.array(tris, np.uint32)


# ===================================================================== chains
def chain_link(L=7.0, a=5.5, t=2.1, n_path=24, n_tube=7):
    """Stadium-shaped link in the XY plane, centred at origin. Returns pos, uv, tris."""
    per = 4 * L + 2 * np.pi * a
    pts, tan = [], []
    for k in range(n_path):
        s = k / n_path * per
        if s < 2 * L:                                     # bottom straight, -x -> +x
            p = (-L + s, -a); tg = (1, 0)
        elif s < 2 * L + np.pi * a:                       # right half circle
            th = -np.pi / 2 + (s - 2 * L) / a
            p = (L + a * np.cos(th), a * np.sin(th)); tg = (-np.sin(th), np.cos(th))
        elif s < 4 * L + np.pi * a:                       # top straight, +x -> -x
            p = (L - (s - 2 * L - np.pi * a), a); tg = (-1, 0)
        else:                                             # left half circle
            th = np.pi / 2 + (s - 4 * L - np.pi * a) / a
            p = (-L + a * np.cos(th), a * np.sin(th)); tg = (-np.sin(th), np.cos(th))
        pts.append(p); tan.append(tg)
    pos, uv = [], []
    for k in range(n_path + 1):
        p = np.array([*pts[k % n_path], 0.0]); tg = np.array([*tan[k % n_path], 0.0])
        out = np.array([tg[1], -tg[0], 0.0])               # in-plane outward normal
        for m in range(n_tube + 1):
            th = m / n_tube * 2 * np.pi
            q = p + t * (np.cos(th) * out + np.sin(th) * np.array([0, 0, 1.0]))
            pos.append(q); uv.append((k / n_path * 4, m / n_tube))
    tris = []
    for k in range(n_path):
        for m in range(n_tube):
            i0 = k * (n_tube + 1) + m; i1 = i0 + n_tube + 1
            tris += [(i0, i1, i0 + 1), (i0 + 1, i1, i1 + 1)]
    return np.array(pos, np.float32), np.array(uv, np.float32), np.array(tris, np.uint32)


def chain_ring(radius=64.0, count=20):
    lp, luv, lt = chain_link()
    P, U, T = [], [], []
    for i in range(count):
        ph = i / count * 2 * np.pi
        c = np.array([radius * np.cos(ph), 0, radius * np.sin(ph)])
        tg = np.array([-np.sin(ph), 0, np.cos(ph)])
        up = np.array([0, 1.0, 0]); rad = np.array([np.cos(ph), 0, np.sin(ph)])
        ex, ey, ez = (tg, up, rad) if i % 2 == 0 else (tg, rad, -up)
        M = np.stack([ex, ey, ez], 1)                     # columns = local axes
        P.append(lp @ M.T + c); U.append(luv); T.append(lt + i * len(lp))
    return np.vstack(P).astype(np.float32), np.vstack(U).astype(np.float32), np.vstack(T).astype(np.uint32)


def make_chain_texture():
    w, h = 256, 64
    u = (np.arange(w) + 0.5) / w
    v = (np.arange(h) + 0.5) / h
    U, V = np.meshgrid(u, v)
    th = V * 2 * np.pi
    light = 0.5 + 0.5 * np.sin(th)                       # top of tube bright, underside dark
    steel = np.array([0.10, 0.13, 0.11]) + np.array([0.50, 0.62, 0.54]) * (light ** 3)[..., None]
    spec = np.exp(-((V - 0.25) / 0.05) ** 2)[..., None] * np.array([0.85, 1.0, 0.9])
    edge = np.exp(-((V - 0.75) / 0.07) ** 2)[..., None] * FLOW * 0.9  # energy edge on underside
    wear = (np.sin(U * 2 * np.pi * 4 + 1.3) * 0.5 + 0.5)[..., None] * 0.06
    rgb = steel + spec * 0.55 + edge + wear
    save(np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], -1), 'chain_metal')


# ===================================================================== eye + light FX
def _arc_y(x, top):
    # circular arc through (-1,0), (1,0) and (0,top)
    rr = (1 + top * top) / (2 * abs(top))
    cy = top - np.sign(top) * rr
    return cy + np.sign(top) * np.sqrt(np.clip(rr * rr - x * x, 0, None))


def _ring_text(size, r_mid, band, text, cx, cy):
    """Renders text around a circle (clockwise, starting at 12 o'clock). Returns L-mode image."""
    img = Image.new('L', size, 0)
    font = ImageFont.truetype(FONT, int(band * 0.92))
    glyphs = list(text) + ['\u2022']
    widths = [font.getlength(g) for g in glyphs]
    gap = font.getlength(' ') * 0.6
    total = sum(widths) + gap * len(glyphs)
    scale = 2 * np.pi * r_mid / total
    ang = -90.0
    for g, wdt in zip(glyphs, widths):
        span = (wdt + gap) * scale / r_mid * 180 / np.pi
        a_c = ang + span / 2
        tile = Image.new('L', (int(band * 1.7), int(band * 1.5)), 0)
        dt = ImageDraw.Draw(tile)
        if g == '\u2022':
            x0, y0, k = tile.width / 2, tile.height / 2, band * 0.15
            dt.polygon([(x0, y0 - k * 1.6), (x0 + k, y0), (x0, y0 + k * 1.6), (x0 - k, y0)], fill=255)
        else:
            dt.text((tile.width / 2, tile.height / 2), g, font=font, fill=255, anchor='mm')
        tile = tile.resize((max(1, int(tile.width * scale)), tile.height), Image.LANCZOS)
        rot = tile.rotate(-(a_c + 90), resample=Image.BICUBIC, expand=True)
        px = cx + r_mid * np.cos(np.radians(a_c)); py = cy + r_mid * np.sin(np.radians(a_c))
        img.paste(255, (int(px - rot.width / 2), int(py - rot.height / 2)), rot)
        ang += span
    return img


def make_eye(w=1024, h=512):
    """Eye emblem: glowing almond outline, iris made of the word METAVISION, pupil."""
    yy, xx = np.mgrid[h - 1:-1:-1, 0:w].astype(float)
    x = xx / (w - 1) * 2.2 - 1.1
    y = yy / (h - 1) * 1.1 - 0.55
    up, lo = 0.50, -0.44
    xc = np.clip(x, -1, 1)
    yu, yl = _arc_y(xc, up), _arc_y(xc, lo)
    inside = (np.abs(x) < 1) & (y < yu) & (y > yl)
    du, dl = np.abs(y - yu), np.abs(y - yl)
    dist = np.where(np.abs(x) <= 1, np.minimum(du, dl), np.hypot(np.abs(x) - 1, y))
    line = np.exp(-(dist / 0.017) ** 2) + 0.65 * np.exp(-(dist / 0.065) ** 2)
    line *= smoothstep(1.08, 0.80, np.abs(x)) * 0.55 + 0.45
    for sx in (-1, 1):                                    # small HUD ticks past the corners
        m = (sx * x > 1.02) & (sx * x < 1.09)
        line = line + m * np.exp(-(y / 0.007) ** 2) * 0.9
    # iris (pixel space for the text)
    icx, icy = 0.0, 0.03
    px_per_unit = (w - 1) / 2.2
    cxp = (icx + 1.1) * px_per_unit
    cyp = (0.55 - icy) * px_per_unit
    r_out, r_in = 0.425, 0.285
    text = np.asarray(_ring_text((w, h), (r_in + r_out) / 2 * px_per_unit, (r_out - r_in) * px_per_unit,
                                 'METAVISION', cxp, cyp)).astype(float) / 255
    ri = np.hypot(x - icx, y - icy)
    rings = (np.exp(-((ri - r_out - 0.012) / 0.006) ** 2) + np.exp(-((ri - r_in + 0.012) / 0.005) ** 2) * 0.8 +
             np.exp(-((ri - 0.17) / 0.007) ** 2) * 0.9)
    iris_fill = 0.22 * np.exp(-((ri - 0.22) / 0.10) ** 2)
    core = np.exp(-(ri / 0.055) ** 2) * 1.2
    cross = (np.exp(-((x - icx) / 0.004) ** 2) * ((np.abs(y - icy) > 0.07) & (np.abs(y - icy) < 0.13)) +
             np.exp(-((y - icy) / 0.004) ** 2) * ((np.abs(x - icx) > 0.07) & (np.abs(x - icx) < 0.13)))
    tglow = np.asarray(Image.fromarray((text * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) / 255
    sclera = inside * (0.06 + 0.06 * smoothstep(0.6, 0.0, ri))
    bright = np.clip(line + rings + core + cross + text, 0, 1.5)
    soft = np.clip(iris_fill + tglow * 0.9 + sclera, 0, 1)
    inten = np.clip(bright + soft, 0, 1)
    rgb = np.clip(HIGHLIGHT * np.clip(bright, 0, 1)[..., None] + FLOW * soft[..., None] * 1.8 +
                  DEEP * sclera[..., None] * 2.0, 0, 1)
    save(np.concatenate([rgb, inten[..., None]], -1), 'eye')
    # same layout, only the word (for the sequential light sweep over the letters)
    tl = np.clip(text + tglow * 0.6, 0, 1)
    save(np.stack([np.ones_like(tl), np.ones_like(tl), np.ones_like(tl), tl], -1), 'eye_text')
    # dark backing (alpha blended) so the eye reads on bright ground
    back = inside * 0.62 * smoothstep(0.0, 0.06, np.minimum(du, dl))
    save(np.stack([np.full_like(x, 0.005), np.full_like(x, 0.04), np.full_like(x, 0.02), back], -1), 'eye_backing')
    # angular gradient (clockwise from 12 o'clock) used as erosion map for the letter sweep
    ang = (np.degrees(np.arctan2(x - icx, y - icy)) % 360) / 360
    g = (ang * 255).astype(np.uint8)
    Image.fromarray(np.stack([g, g, g, np.full_like(g, 255)], -1), 'RGBA').save(os.path.join(OUT, 'eye_sweep_map.png'))


def make_reticle(size=512):
    img = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(img)
    c = size / 2
    for rad, wdt in ((size * 0.47, 3), (size * 0.43, 2)):
        d.ellipse([c - rad, c - rad, c + rad, c + rad], outline=255, width=wdt)
    for k in range(120):
        a = np.radians(k * 3)
        r0 = size * (0.47 if k % 10 else 0.455)
        r1 = size * (0.485 if k % 10 else 0.495)
        if k % 10 == 0 or k % 2 == 0:
            d.line([c + r0 * np.cos(a), c + r0 * np.sin(a), c + r1 * np.cos(a), c + r1 * np.sin(a)], fill=255, width=3 if k % 10 == 0 else 2)
    for k in range(4):                                     # four bracket arcs
        a0 = k * 90 + 30
        rad = size * 0.40
        d.arc([c - rad, c - rad, c + rad, c + rad], a0, a0 + 30, fill=255, width=4)
    a = np.asarray(img).astype(float) / 255
    glow = np.asarray(img.filter(ImageFilter.GaussianBlur(5))).astype(float) / 255
    i = np.clip(a + glow * 0.9, 0, 1)
    rgb = np.clip(HIGHLIGHT * a[..., None] + FLOW * glow[..., None] * 1.3, 0, 1)
    save(np.concatenate([rgb, i[..., None]], -1), 'reticle')


def make_light_fx():
    # thin light streak (vertical), for the dissolving light lines
    w, h = 64, 512
    y, x = np.mgrid[0:h, 0:w].astype(float)
    x = x / (w - 1) * 2 - 1; y = y / (h - 1)
    core = np.exp(-(x / 0.10) ** 2) + 0.35 * np.exp(-(x / 0.40) ** 2)
    ends = smoothstep(0.0, 0.25, y) * smoothstep(1.0, 0.55, y)
    i = np.clip(core * ends, 0, 1)
    save(np.stack([0.85 + 0.15 * i, 0.85 + 0.15 * i, np.ones_like(i), i], -1), 'light_streak')
    # soft round dot (stretched by velocity into light lines)
    s = 64
    y, x = np.mgrid[0:s, 0:s].astype(float) / (s - 1) * 2 - 1
    i = np.clip(np.exp(-(np.hypot(x, y) / 0.35) ** 2) * 1.1, 0, 1)
    save(np.stack([np.ones_like(i), np.ones_like(i), np.ones_like(i), i], -1), 'light_dot')
    # star flash
    s = 512
    y, x = np.mgrid[s - 1:-1:-1, 0:s].astype(float) / (s - 1) * 2 - 1
    r = np.hypot(x, y); a = np.arctan2(y, x)
    rays = sum(np.exp(-(((a - k * np.pi / 4 + np.pi) % (np.pi / 2 if k % 2 == 0 else np.pi / 2)) - np.pi / 4) ** 2 / 0.0006) *
               (0.9 if k % 2 == 0 else 0.5) for k in range(2)) * np.exp(-r * 2.2)
    glow = np.exp(-(r / 0.16) ** 2) + 0.35 * np.exp(-(r / 0.45) ** 2)
    i = np.clip(glow + rays, 0, 1)
    save(np.stack([np.clip(0.75 + 0.25 * i, 0, 1), np.clip(0.7 + 0.3 * i, 0, 1), np.ones_like(i), i], -1), 'flash_star')
    # shockwave ring
    ring = np.exp(-((r - 0.86) / 0.025) ** 2) + 0.35 * np.exp(-((r - 0.74) / 0.12) ** 2) * (r < 0.86)
    i = np.clip(ring, 0, 1) * (r < 1)
    save(np.stack([np.ones_like(i), np.ones_like(i), np.ones_like(i), i], -1), 'shock_ring')


def make_pitch_lines(size=1024):
    """Top-down football pitch diagram (generic markings) for the ground flash."""
    img = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(img)
    c = size / 2
    W, H = size * 0.46, size * 0.30                      # half extents of the field
    lw = max(4, size // 150)
    d.rectangle([c - W, c - H, c + W, c + H], outline=255, width=lw)
    d.line([c, c - H, c, c + H], fill=255, width=lw)
    rr = size * 0.085
    d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=255, width=lw)
    d.ellipse([c - 5, c - 5, c + 5, c + 5], fill=255)
    for sx in (-1, 1):
        bx = c + sx * W
        d.rectangle(sorted([bx, bx - sx * size * 0.12]) + [c - size * 0.15, c + size * 0.15], outline=255, width=lw) if False else None
        x0, x1 = sorted([bx, bx - sx * size * 0.12])
        d.rectangle([x0, c - size * 0.15, x1, c + size * 0.15], outline=255, width=lw)
        x0, x1 = sorted([bx, bx - sx * size * 0.045])
        d.rectangle([x0, c - size * 0.065, x1, c + size * 0.065], outline=255, width=lw)
    a = np.asarray(img).astype(float) / 255
    glow = np.asarray(img.filter(ImageFilter.GaussianBlur(size * 0.006))).astype(float) / 255
    y, x = np.mgrid[0:size, 0:size].astype(float) / (size - 1) * 2 - 1
    vign = smoothstep(1.0, 0.55, np.hypot(x, y * 1.3))
    i = np.clip(a * 1.2 + glow * 1.8, 0, 1) * vign
    rgb = np.clip(HIGHLIGHT * a[..., None] + FLOW * glow[..., None] * 1.5, 0, 1)
    save(np.concatenate([rgb, i[..., None]], -1), 'pitch_lines')


if __name__ == '__main__':
    make_ball_textures()
    make_ball_sprite('ball_sprite', glow=0.30, rim=0.22)
    make_ball_sprite('ball_sprite_flow', glow=0.75, rim=0.50, seam_emit=0.35)
    make_ball_sprite('ball_sprite_ult', glow=0.95, rim=0.55, seam_emit=1.0)
    make_chain_texture()
    make_eye()
    make_reticle()
    make_light_fx()
    make_pitch_lines()
    print('assets written to', OUT)
