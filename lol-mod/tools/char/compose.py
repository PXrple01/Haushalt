"""Splash-style compositing: background (stadium bokeh, flow streaks, pitch lines, aura), the Cycles
render, a separating glow and a flying football. Original art only."""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, '..', '..', 'assets_src', 'gen')


def background(W, H, cx, cy, seed=4):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    top, bot = np.array([0.012, 0.050, 0.030]), np.array([0.030, 0.120, 0.070])
    t = (yy / H)[..., None]
    img = top * (1 - t) + bot * t
    r = np.hypot((xx - cx) / W, (yy - cy) / H)
    img += np.array([0.05, 0.34, 0.17])[None, None] * np.exp(-(r / 0.33) ** 2)[..., None] * 0.9
    base = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
    # stadium floodlight bokeh
    bok = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(bok)
    for _ in range(26):
        x = rng.uniform(0, W); y = rng.uniform(0, H * 0.38); rr = rng.uniform(W * 0.01, W * 0.05)
        c = (int(rng.uniform(160, 230)), 255, int(rng.uniform(180, 230)), int(rng.uniform(40, 110)))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c)
    bok = bok.filter(ImageFilter.GaussianBlur(W * 0.008))
    base.alpha_composite(bok)
    # flow streaks radiating from behind the hero
    st = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(st)
    for _ in range(70):
        a = rng.uniform(0, 2 * np.pi); r0 = rng.uniform(0.18, 0.35) * H; r1 = r0 + rng.uniform(0.15, 0.55) * H
        w = int(rng.uniform(1, 3) * W / 600)
        c = (int(rng.uniform(120, 220)), 255, int(rng.uniform(150, 220)), int(rng.uniform(30, 120)))
        d.line([cx + r0 * np.cos(a), cy + r0 * np.sin(a), cx + r1 * np.cos(a), cy + r1 * np.sin(a)], fill=c, width=max(1, w))
    st = st.filter(ImageFilter.GaussianBlur(W * 0.002))
    base.alpha_composite(st)
    # pitch lines on the ground (perspective)
    pl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(pl)
    gy = H * 0.86
    d.ellipse([cx - W * 0.42, gy - H * 0.045, cx + W * 0.42, gy + H * 0.045], outline=(220, 255, 230, 70), width=max(2, W // 250))
    d.line([0, gy + H * 0.002, W, gy - H * 0.004], fill=(220, 255, 230, 55), width=max(2, W // 300))
    base.alpha_composite(pl.filter(ImageFilter.GaussianBlur(1)))
    # the METAVISION eye, faint, high in the sky
    eye = Image.open(os.path.join(GEN, 'eye.png')).convert('RGBA')
    ew = int(W * 0.78); eye = eye.resize((ew, ew // 2), Image.LANCZOS)
    ea = eye.getchannel('A').point(lambda v: int(v * 0.20)); eye.putalpha(ea)
    base.alpha_composite(eye, (int(W / 2 - ew / 2), int(H * 0.035)))
    return base


def glow(alpha, radius, color):
    a = alpha.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(radius))
    g = Image.new('RGBA', alpha.size, color + (0,))
    g.putalpha(a.point(lambda v: int(v * 0.85)))
    return g


def football(base, x, y, size, angle_deg, trail_dir):
    ball = Image.open(os.path.join(GEN, 'ball_sprite_flow.png')).convert('RGBA').resize((size, size), Image.LANCZOS)
    tx, ty = trail_dir
    for k in range(7, 0, -1):                                    # motion trail
        b = ball.rotate(angle_deg + k * 12, resample=Image.BICUBIC)
        a = b.getchannel('A').point(lambda v, k=k: int(v * 0.10 * (8 - k) / 7))
        b.putalpha(a)
        base.alpha_composite(b, (int(x - size / 2 - tx * k * size * 0.22), int(y - size / 2 - ty * k * size * 0.22)))
    base.alpha_composite(ball.rotate(angle_deg, resample=Image.BICUBIC), (int(x - size / 2), int(y - size / 2)))


def grade(img):
    a = np.asarray(img.convert('RGB')).astype(float) / 255
    a = np.clip((a - 0.5) * 1.06 + 0.5, 0, 1)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.38 * (np.hypot((xx - W / 2) / W, (yy - H / 2) / H) / 0.71) ** 2.2
    return Image.fromarray((np.clip(a * v[..., None], 0, 1) * 255).astype(np.uint8))


def compose(char_png, out_png, out_size, ball_at=None, ball_size=0.15, trail=(-1.0, 0.35)):
    ch = Image.open(char_png).convert('RGBA')
    W, H = ch.size
    a = np.asarray(ch.getchannel('A')).astype(float)
    ys, xs = np.nonzero(a > 128)
    cx, cy = xs.mean(), ys.mean()
    base = background(W, H, cx, cy - H * 0.05)
    base.alpha_composite(glow(ch.getchannel('A'), W * 0.012, (60, 230, 120)))
    base.alpha_composite(ch)
    if ball_at:
        football(base, ball_at[0] * W, ball_at[1] * H, int(ball_size * W), 25, trail)
    img = grade(base)
    if out_size:
        img = img.resize(out_size, Image.LANCZOS)
    img.save(out_png)
    return img


if __name__ == '__main__':
    char_png, out_png = sys.argv[1:3]
    size = tuple(int(v) for v in sys.argv[3].split('x')) if len(sys.argv) > 3 and sys.argv[3] != '-' else None
    ball = tuple(float(v) for v in sys.argv[4].split(',')) if len(sys.argv) > 4 else None
    compose(char_png, out_png, size, ball)
