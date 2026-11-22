"""Paints the anime cel-shaded texture from baked position/normal/part/AO maps (all procedural)."""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', '..', 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')

C = {k: np.array(v, np.float32) for k, v in dict(
    skin=(0.99, 0.85, 0.75), skin_sh=(0.88, 0.64, 0.58),
    jersey=(0.07, 0.35, 0.19), jersey_sh=(0.03, 0.20, 0.13),
    white=(0.96, 0.97, 0.96), white_sh=(0.70, 0.77, 0.81),
    shorts=(0.10, 0.10, 0.11), shorts_sh=(0.05, 0.05, 0.06),
    accent=(0.13, 0.62, 0.33), accent_sh=(0.07, 0.36, 0.20),
    boot=(0.09, 0.09, 0.10), boot_sh=(0.04, 0.04, 0.05), sole=(0.30, 0.90, 0.50),
    hair=(0.10, 0.38, 0.21), hair_sh=(0.04, 0.18, 0.10), hair_hi=(0.36, 0.70, 0.46),
    line=(0.07, 0.07, 0.09), brow=(0.06, 0.20, 0.12), mouth=(0.58, 0.30, 0.27),
    iris_top=(0.50, 0.24, 0.03), iris_bot=(1.0, 0.74, 0.22), pupil=(0.16, 0.07, 0.02)).items()}

LIGHT = np.array([-0.35, 0.80, 0.55]); LIGHT /= np.linalg.norm(LIGHT)


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def seg_t(P, a, b):
    ab = b - a
    t = ((P - a) @ ab) / (ab @ ab)
    t = np.clip(t, 0, 1)
    d = np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
    return t, d


def number_mask(text='8', size=256):
    img = Image.new('L', (size, size), 0)
    f = ImageFont.truetype(FONT, int(size * 0.95))
    ImageDraw.Draw(img).text((size / 2, size / 2), text, font=f, fill=255, anchor='mm')
    return np.asarray(img).astype(np.float32) / 255


def paint(baked, joints_json, out_png):
    d = np.load(baked)
    pos, nrm, part_rgb, ao, mask = d['pos'], d['nrm'], d['partmap'], d['ao'], d['mask']
    H, W = mask.shape
    P = pos.reshape(-1, 3).astype(np.float64)
    N = nrm.reshape(-1, 3).astype(np.float64)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    pr = part_rgb.reshape(-1, 3)
    part = np.where(pr[:, 0] > 0.5, 1, np.where(pr[:, 1] > 0.5, 2, np.where(pr[:, 2] > 0.5, 3, 0)))
    AO = ao.reshape(-1)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    J = {j['name']: np.array(j['pos']) for j in json.load(open(joints_json))['joints']}

    base = np.zeros((len(P), 3), np.float32); shade = np.zeros((len(P), 3), np.float32)

    def setc(m, name):
        base[m] = C[name]; shade[m] = C[name + '_sh'] if name + '_sh' in C else C[name] * 0.62

    body = part == 0
    setc(body, 'jersey')
    # ---- arms: sleeves, skin, wristband
    arm_any = np.zeros(len(P), bool)
    for s in ('L', 'R'):
        S, E, Hn = J[s + '_Shoulder'], J[s + '_Elbow'], J[s + '_Hand']
        tu, du = seg_t(P, S, E)
        tf, df = seg_t(P, E, Hn)
        sx = -1 if s == 'L' else 1
        outside = (x * sx) > 15.5
        upper = body & outside & (du < 11) & (tu > 0.0)
        fore = body & outside & (df < 9.5) & (tf > 0.02)
        hand = body & ((P - Hn) @ (Hn - E) / np.linalg.norm(Hn - E) > -1.0) & (np.linalg.norm(P - Hn, axis=1) < 16) & outside
        arm = upper | fore | hand
        arm_any |= arm
        setc(arm & (tu > 0.50), 'skin'); setc(fore | hand, 'skin')
        setc(upper & (tu <= 0.50), 'jersey')
        setc(upper & (tu > 0.43) & (tu <= 0.50), 'white')                      # sleeve cuff
        if s == 'L':
            setc(fore & (tf > 0.80) & (tf < 0.90), 'shorts')                    # black wristband
    torso = body & ~arm_any
    # ---- neck, collar, V-neck (crew neck sits at the base of the neck)
    rad_neck = np.hypot(x, (z + 1.4) * 1.05)
    neck = torso & (y > 166.0) & (rad_neck < 7.9)
    setc(neck, 'skin')
    collar = torso & (y > 165.0) & (rad_neck >= 7.9) & (rad_neck < 10.0) & (y < 170.8)
    setc(collar, 'white')
    vopen = torso & (z > 2.0) & (y > 157.5) & (np.abs(x) < (y - 157.5) * 0.52) & (y < 168.5)
    setc(vopen, 'skin')
    vtrim = torso & (z > 2.0) & (y > 157.0) & (np.abs(np.abs(x) - (y - 157.5) * 0.52) < 0.85) & (y < 167)
    setc(vtrim, 'white')
    # ---- diagonal sash (front), from the right shoulder (+x) to the left hip (-x)
    a = np.array([13.5, 165.0]); b = np.array([-14.5, 122.5])
    nd = np.array([-(b - a)[1], (b - a)[0]]); nd /= np.linalg.norm(nd)
    dist = (np.stack([x, y], 1) - a) @ nd
    sash = torso & (z > -1.0) & (np.abs(dist) < 3.1) & (y > 121.5) & (y < 166) & ~vopen & ~collar
    setc(sash, 'white')
    setc(torso & (z > -1.0) & (np.abs(np.abs(dist) - 3.55) < 0.45) & (y > 121.5) & (y < 166) & ~vopen & ~collar & ~vtrim, 'accent')
    # ---- number on the back
    num = number_mask('8')
    back = torso & (z < -3.0) & (np.abs(x) < 8.0) & (y > 139) & (y < 161)
    u = ((x[back] + 8.0) / 16.0 * 255).astype(int).clip(0, 255)
    v = ((161 - y[back]) / 22.0 * 255).astype(int).clip(0, 255)
    nb = np.zeros(len(P), bool); nb[np.where(back)[0][num[v, u] > 0.5]] = True
    setc(nb, 'white')
    # ---- shorts, legs, socks, boots
    hem_y = J['L_Hip'][1] - 0.42 * (J['L_Hip'][1] - J['L_KneeLower'][1]) - 0.5
    shorts = torso & (y <= 121.6) & (y > hem_y)
    setc(shorts, 'shorts')
    setc(shorts & ((np.abs(x) - 10.6) > 6.4), 'accent')                       # side stripe
    setc(torso & (y <= 122.6) & (y > 121.6), 'jersey')                         # shirt hem
    kn_y = J['L_KneeLower'][1]; ft_y = J['L_Foot'][1]
    legs = torso & (y <= hem_y)
    setc(legs, 'skin')
    sock_top = kn_y - 0.16 * (kn_y - ft_y)
    socks = legs & (y < sock_top) & (y > 17.0)
    setc(socks, 'white')
    setc(socks & (((y > sock_top - 5.2) & (y < sock_top - 3.6)) | ((y > sock_top - 2.4) & (y < sock_top - 0.8))), 'accent')
    boots = legs & (y <= 17.0)
    setc(boots, 'boot')
    setc(boots & (y < 2.3), 'sole')
    lace = boots & (z > 5.5) & (y > 9.0) & (np.abs(np.abs(x) - 10.8) < 2.0) & ((np.floor(z * 0.9) % 2) == 0)
    setc(lace, 'sole')
    # ---- head & face
    head = part == 1
    setc(head, 'skin')
    hair = part >= 2
    setc(hair, 'hair')

    # ---- cel shading
    ndl = N @ LIGHT
    lit = sstep(0.02, 0.12, ndl)
    face_front = head & (z > 4.0) & (y > 181)
    face_soft = head & (z > -3.0) & (y > 178.5)
    lit[face_soft] = sstep(-0.55, -0.35, ndl[face_soft])                       # anime faces stay clean
    col = shade + (base - shade) * lit[:, None]
    occl = np.where(hair, 0.62 + 0.38 * AO, 0.74 + 0.26 * AO)
    col *= occl[:, None]
    col *= (0.93 + 0.07 * np.clip(N[:, 1], 0, 1))[:, None]
    # hair: darker towards the ends, glossy "ring" highlight on the crown
    hg = sstep(183, 207, y)
    col[hair] *= (0.78 + 0.22 * hg[hair])[:, None]
    up = np.array([0.0, 0.85, 0.52]); up /= np.linalg.norm(up)
    ring = hair & (N @ up > 0.78) & (N @ up < 0.93) & (y > 199) & (np.sin(x * 1.6 + z * 0.9) > -0.35)
    col[ring] = col[ring] * 0.35 + C['hair_hi'] * 0.65

    # ---- face paint (front projection)
    fx, fy = x, y
    for side in (-1, 1):
        cx, cy = side * 4.9, 193.4
        lx = (fx - cx) * side; ly = fy - cy
        m = face_front & (np.abs(lx) < 6) & (np.abs(ly) < 7)
        e = ((lx - 0.2) / 3.25) ** 2 + ((ly - 0.1) / np.where(ly > 0.1, 2.7, 2.35)) ** 2
        sclera = m & (e < 1.0)
        col[sclera] = C['white'] * 0.97
        ir = (lx / 2.05) ** 2 + ((ly + 0.15) / 2.6) ** 2
        iris = sclera & (ir < 1.0)
        g = np.clip((ly[iris] + 2.6) / 5.2, 0, 1)[:, None]
        col[iris] = C['iris_bot'] * (1 - g) + C['iris_top'] * g
        col[sclera & (ir >= 0.80) & (ir < 1.0)] = C['iris_top'] * 0.8                # iris rim
        pup = iris & ((lx / 0.85) ** 2 + ((ly + 0.25) / 1.35) ** 2 < 1.0)
        col[pup] = C['pupil']
        col[sclera & (ly > 1.6)] *= 0.86                                               # lid shadow
        hl1 = sclera & (((lx + 0.75) / 0.78) ** 2 + ((ly - 0.95) / 0.62) ** 2 < 1.0)
        hl2 = sclera & (((lx - 0.65) / 0.34) ** 2 + ((ly + 1.25) / 0.34) ** 2 < 1.0)
        col[hl1 | hl2] = (1.0, 1.0, 1.0)
        # upper lash line: thick, thicker outward, with a flick at the outer corner
        th = 0.55 + 0.35 * sstep(-2.5, 3.0, lx)
        upper_curve = 0.1 + 2.7 * np.sqrt(np.clip(1 - ((lx - 0.2) / 3.25) ** 2, 0, 1))
        lash = m & (lx > -3.2) & (lx < 3.5) & (ly > upper_curve - 0.15) & (ly < upper_curve + th)
        flick = m & (lx >= 3.0) & (lx < 4.3) & (np.abs(ly - (1.0 + (lx - 3.0) * 0.55)) < 0.42 - (lx - 3.0) * 0.22)
        col[lash | flick] = C['line']
        lower_curve = 0.1 - 2.35 * np.sqrt(np.clip(1 - ((lx - 0.2) / 3.25) ** 2, 0, 1))
        lower = m & (lx > 0.0) & (lx < 3.3) & (np.abs(ly - lower_curve + 0.05) < 0.17)
        col[lower] = C['line']
        # eyebrow: determined, slightly angled up outward
        bt = np.clip((lx + 2.8) / 6.4, 0, 1)
        by = 4.25 + bt * 1.35 - 0.6 * (bt - 0.55) ** 2
        bw = 0.95 - 0.45 * bt
        brow = m & (lx > -2.8) & (lx < 3.6) & (np.abs(ly - by) < bw / 2 + 0.05)
        col[brow] = C['brow']
    nose = face_front & (fx > 0.15) & (fx < 0.95) & (fy > 188.3) & (fy < 190.0) & (np.abs(fx - 0.55 - (fy - 189.15) * 0.25) < 0.22)
    col[nose] *= 0.80
    mx = fx / 1.9
    mouth = face_front & (np.abs(mx) < 1.0) & (np.abs(fy - (184.55 + 0.35 * mx ** 2)) < 0.17)
    col[mouth] = C['mouth']

    img = np.clip(col.reshape(H, W, 3), 0, 1)
    img[~mask] = img[~mask]            # margins keep extrapolated colours (no seams)
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), 'RGB').save(out_png)


if __name__ == '__main__':
    paint(*sys.argv[1:4])
