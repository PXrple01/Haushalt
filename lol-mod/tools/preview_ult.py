"""Concept mock-up (NOT a game capture) of the METAVISION ult timing, as an animated GIF."""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import make_assets as MA
from render_preview import render

GEN = MA.OUT


def load(n):
    return np.asarray(Image.open(os.path.join(GEN, n + '.png')).convert('RGBA')).astype(float) / 255


def blit(canvas, sprite, cx, cy, sw, sh, mode='add', alpha=1.0, color=(1, 1, 1), angle=0.0):
    if sw < 2 or sh < 2 or alpha <= 0:
        return
    im = Image.fromarray((np.clip(sprite, 0, 1) * 255).astype(np.uint8), 'RGBA').resize((int(sw), int(sh)), Image.LANCZOS)
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    a = np.asarray(im).astype(float) / 255
    h, w = a.shape[:2]
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    H, W = canvas.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb:
        return
    s = a[ya - y0:yb - y0, xa - x0:xb - x0]
    rgb = s[..., :3] * np.array(color); al = s[..., 3:4] * alpha
    reg = canvas[ya:yb, xa:xb]
    if mode == 'add':
        reg += rgb * al
    else:
        reg[:] = reg * (1 - al) + rgb * al


def curve(t, ts, vs):
    return np.interp(t, ts, vs)


def main(skn, body_tx, ball_tx, out):
    W, H = 640, 760
    body = np.asarray(Image.open(body_tx).convert('RGBA')).astype(float) / 255
    ball = np.asarray(Image.open(ball_tx).convert('RGBA')).astype(float) / 255
    tex = {'default': body, **{f'Bead_{i}': ball for i in range(1, 9)}}
    base, project, scale = render(skn, tex, None, size=(W, H), yaw_deg=20, pitch_deg=14,
                                  hidden=('Dragon_Head', 'Tail'), fixed=(1.55, 0, 215))
    eye, back, ret, flash = load('eye'), load('eye_backing'), load('reticle'), load('flash_star')
    ring, pitch, dot, text = load('shock_ring'), load('pitch_lines'), load('light_dot'), load('eye_text')
    rng = np.random.default_rng(3)
    shards = [(rng.uniform(-1, 1, 3) * (950, 0, 950) + (0, rng.uniform(150, 650), 0), rng.uniform(0, 360)) for _ in range(30)]
    lines = [(rng.uniform(-150, 150), rng.uniform(-40, 40), rng.uniform(-1, 1, 3) * (750, 0, 750) + (0, rng.uniform(-950, 240), 0)) for _ in range(46)]
    frames = []
    fps = 20
    for fi in range(int(3.1 * fps)):
        t = fi / fps
        c = base.copy()
        # ground pitch (squashed by camera pitch)
        if 1.90 <= t <= 2.90:
            k = (t - 1.90) / 1.0
            a = curve(k, [0, 0.12, 0.6, 1], [0, 1, 0.8, 0])
            s = 235 * 2 * curve(k, [0, 0.2, 1], [0.82, 1.0, 1.04]) * scale
            x, y = project((0, 0, 0))
            blit(c, pitch, x, y, s, s * 0.32, alpha=a, color=(0.9, 0.85, 1))
        if 0.30 <= t <= 0.90:
            k = (t - 0.30) / 0.6
            s = 60 * 2 * curve(k, [0, 1], [1, 7]) * scale
            x, y = project((0, 0, 0))
            blit(c, ring, x, y, s, s * 0.32, alpha=curve(k, [0, 0.1, 1], [0, 1, 0]), color=(0.55, 0.36, 1))
        # chains
        if t < 0.32:
            k = t / 0.32
            sc = curve(k, [0, 0.22, 0.85, 1], [1.28, 1.0, 0.93, 0.9])
            d = ImageDraw.Draw(img := Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)))
            glow = Image.new('L', img.size, 0); dg = ImageDraw.Draw(glow)
            for hgt, tilt in ((60, 8), (105, -13), (150, 10)):
                ph = np.linspace(0, 2 * np.pi, 41)
                pts = np.stack([64 * sc * np.cos(ph), hgt + np.sin(ph) * 64 * sc * np.sin(np.radians(tilt)), 64 * sc * np.sin(ph)], -1)
                xs, ys = project(pts)
                for i in range(40):
                    col = (190, 185, 230) if i % 2 == 0 else (90, 90, 120)
                    d.line([xs[i], ys[i], xs[i + 1], ys[i + 1]], fill=col, width=7 if i % 2 == 0 else 4)
                    dg.line([xs[i], ys[i], xs[i + 1], ys[i + 1]], fill=255, width=14)
            c = np.asarray(img).astype(float) / 255
            g = np.asarray(glow.filter(ImageFilter.GaussianBlur(6))).astype(float) / 255
            flare = curve(k, [0, 0.5, 0.9, 1], [0.3, 0.35, 1.0, 0.6])
            c += g[..., None] * np.array([0.55, 0.36, 1.0]) * flare * 0.8
        # burst
        if 0.28 <= t <= 0.66:
            k = (t - 0.28) / 0.38
            x, y = project((0, 110, 0))
            s = 95 * 2 * curve(k, [0, 0.18, 1], [0.3, 1.35, 1.7]) * scale
            blit(c, flash, x, y, s, s, alpha=curve(k, [0, 0.2, 1], [1, 0.9, 0]))
            s2 = 40 * 2 * curve(k, [0, 1], [1, 6]) * scale
            blit(c, ring, x, y, s2, s2, alpha=curve(k, [0, 0.15, 1], [0, 1, 0]), color=(0.55, 0.36, 1))
        if 0.30 <= t <= 1.25:
            dt = t - 0.30
            for (v, ang) in shards:
                p = np.array([0, 105, 0]) + v * dt + np.array([0, -0.5 * 1700 * dt * dt, 0])
                if p[1] < 0:
                    continue
                x, y = project(p)
                a = curve(dt / 0.95, [0, 0.65, 1], [1, 1, 0])
                img = Image.new('RGBA', (30, 30)); dd = ImageDraw.Draw(img)
                dd.ellipse([4, 9, 26, 21], outline=(205, 200, 255, 255), width=4)
                spr = np.asarray(img.rotate(ang + dt * 600)).astype(float) / 255
                blit(c, spr, x, y, 22, 22, mode='alpha', alpha=a)
        # eye
        e0, el = 0.42, 1.45
        if e0 <= t <= e0 + el:
            k = (t - e0) / el
            sy_ = curve(k, [0, 0.09, 0.15, 1], [0.02, 1.12, 1, 1.03])
            sx_ = curve(k, [0, 1], [1, 1.03])
            a = curve(k, [0, 0.08, 0.85, 1], [0, 1, 1, 0])
            x, y = project((0, 300, 0))
            ew, eh = 145 * 2 * scale * sx_, 72 * 2 * scale * sy_
            blit(c, back, x, y, ew, eh, mode='alpha', alpha=a)
            rs = 165 * 2 * scale * curve(k, [0, 0.15, 1], [1.35, 1.0, 0.97])
            blit(c, ret, x, y, rs, rs, alpha=a * curve(k, [0, 0.12, 0.8, 1], [0, 1, 1, 0]), color=(0.45, 0.34, 0.75), angle=-32 * (t - e0))
            blit(c, eye, x, y, ew, eh, alpha=a)
            tk = (t - e0 - 0.16) / 0.45
            if 0 <= tk <= 1:
                blit(c, text, x, y, ew, eh, alpha=curve(tk, [0, 0.15, 1], [0, 1, 0]))
            pk = (t - e0 - 0.16) / 0.32
            if 0 <= pk <= 1:
                ps = 50 * 2 * scale * curve(pk, [0, 0.25, 1], [0.2, 1.4, 0.8])
                blit(c, flash, x, y + 6, ps, ps, alpha=curve(pk, [0, 0.25, 1], [1, 1, 0]))
        end = e0 + el - 0.12
        if end <= t <= end + 0.7:
            dt = t - end
            x, y = project((0, 300, 0))
            if dt <= 0.28:
                s = 110 * 2 * scale * curve(dt / 0.28, [0, 1], [0.5, 1.5])
                blit(c, flash, x, y, s, s, alpha=curve(dt / 0.28, [0, 0.2, 1], [0.9, 0.7, 0]))
            img = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)); d = ImageDraw.Draw(img)
            for ox, oz, v in lines:
                p0 = np.array([ox * 0.75, 300, oz]) + v * dt
                p1 = p0 - v * 0.05
                x0, y0 = project(p0); x1, y1 = project(p1)
                a = curve(dt / 0.6, [0, 0.5, 1], [1, 0.9, 0])
                d.line([x0, y0, x1, y1], fill=(int(200 * a + 30), int(185 * a + 20), 255), width=3)
            c = np.asarray(img).astype(float) / 255
        frames.append(Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0, optimize=True)
    frames[int(1.0 * fps)].save(out.replace('.gif', '_still.png'))


if __name__ == '__main__':
    main(*sys.argv[1:5])
