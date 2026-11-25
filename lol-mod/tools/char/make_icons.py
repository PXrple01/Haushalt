"""HUD portraits (square + circle, 128x128) from a Cycles head render with transparent film."""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def make(src, out_sq, out_circ, preview=None):
    ch = Image.open(src).convert('RGBA')
    W, H = ch.size
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    r = np.hypot(xx - W * 0.5, yy - H * 0.42) / W
    bg = np.array([0.02, 0.05, 0.10]) + np.array([0.06, 0.36, 0.20]) * np.exp(-(r / 0.45) ** 2)[..., None]
    base = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
    st = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(st)
    rng = np.random.default_rng(2)
    for _ in range(26):
        a = rng.uniform(0, 2 * np.pi); r0 = W * 0.32; r1 = W * rng.uniform(0.55, 0.9)
        d.line([W / 2 + r0 * np.cos(a), H * 0.42 + r0 * np.sin(a), W / 2 + r1 * np.cos(a), H * 0.42 + r1 * np.sin(a)],
               fill=(150, 255, 190, int(rng.uniform(30, 90))), width=3)
    base.alpha_composite(st.filter(ImageFilter.GaussianBlur(1.5)))
    a = ch.getchannel('A').filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(6))
    g = Image.new('RGBA', (W, H), (60, 230, 120, 0)); g.putalpha(a.point(lambda v: int(v * 0.7))); base.alpha_composite(g)
    base.alpha_composite(ch)
    sq = base.convert('RGB').resize((128, 128), Image.LANCZOS); sq.save(out_sq)
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).ellipse([6, 6, W - 7, H - 7], fill=255); m = m.filter(ImageFilter.GaussianBlur(1.2))
    circ = base.copy(); circ.putalpha(m); circ = circ.resize((128, 128), Image.LANCZOS); circ.save(out_circ)
    if preview:
        p = Image.new('RGB', (300, 140), (30, 30, 30)); p.paste(sq, (10, 6)); p.paste(circ, (160, 6), circ); p.save(preview)


if __name__ == '__main__':
    make(*sys.argv[1:5])
