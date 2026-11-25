"""Renders GIF previews of effect systems from the built mod (uses vfxsim; approximation only).
usage: vfx_preview.py <fantome> <game dir with png/> <rigged npz> <albedo png> <out dir>"""
import json
import math
import os
import sys
import zipfile

import numpy as np
import pyritofile
import xxhash
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lolbin as L  # noqa: E402
import vfxsim as S  # noqa: E402

GEN = os.path.join(HERE, '..', 'assets_src', 'gen')
PART = 'Characters/Yunara/Skins/Skin0/Particles/'


def load_bin(fantome):
    wad = zipfile.ZipFile(fantome).read('WAD/Yunara.wad.client')
    w = pyritofile.WAD(); w.read(None, raw=wad)
    h = xxhash.xxh64(b'data/characters/yunara/skins/skin0.bin').intdigest()
    c = [c for c in w.chunks if int(c.hash, 16) == h][0]
    return L.read(wad[c.offset:c.offset + c.compressed_size])


def load_textures(game_png):
    tex = {}
    for f in os.listdir(GEN):
        if f.endswith('.png'):
            tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{f[:-4]}.tex'] = Image.open(os.path.join(GEN, f)).convert('RGBA')
    for orb, src in (('yunara_base_ba_orb01', 'ball_sprite'), ('yunara_base_q_orb01', 'ball_sprite_flow'), ('yunara_base_passive_orb01', 'ball_sprite_flow')):
        tex[f'assets/characters/yunara/skins/base/particles/{orb}.tex'] = Image.open(os.path.join(GEN, src + '.png')).convert('RGBA')
    tex['assets/characters/yunara/skins/base/particles/mvfx/mvfx_ball_rebound.tex'] = Image.open(os.path.join(GEN, 'ball_sprite.png')).convert('RGBA')
    tex['assets/characters/yunara/skins/base/particles/mvfx/mvfx_ball_ult.tex'] = Image.open(os.path.join(GEN, 'ball_sprite_ult.png')).convert('RGBA')
    sp = os.path.join(game_png, 'assets_characters_yunara_skins_base_particles_base_generic_sparks_add.png')
    if os.path.exists(sp):
        im = Image.open(sp).convert('RGBA')
        a = np.asarray(im).astype(float); lum = a[..., :3].max(-1)
        im = Image.fromarray(np.dstack([np.full(lum.shape, 255), np.full(lum.shape, 255), np.full(lum.shape, 255), lum]).astype(np.uint8))
        tex['assets/characters/yunara/skins/base/particles/base_generic_sparks_add.tex'] = im
    return {k.lower(): v for k, v in tex.items()}


def backdrop(cam, rigged, albedo, W, H):
    """Ground + the striker rendered with the same perspective camera (static)."""
    img = np.zeros((H, W, 3)); img[:] = (0.10, 0.13, 0.12)
    yy, xx = np.mgrid[0:H, 0:W]
    img *= (0.75 + 0.25 * (yy / H))[..., None]
    d = np.load(rigged)
    tex = np.asarray(Image.open(albedo).convert('RGB')).astype(float) / 255
    P = d['pos'].astype(float) * np.array([-1.0, 1, 1])
    tris = d['tris'][:, ::-1]
    scr, z = cam.project(P)
    zb = np.full((H, W), 1e9)
    th, tw = tex.shape[:2]
    for (i0, i1, i2) in tris:
        xs = scr[[i0, i1, i2], 0]; ys = scr[[i0, i1, i2], 1]
        x0, x1 = max(0, int(xs.min())), min(W - 1, int(xs.max()) + 1)
        y0, y1 = max(0, int(ys.min())), min(H - 1, int(ys.max()) + 1)
        if x1 < x0 or y1 < y0:
            continue
        dd = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if dd >= -1e-9:                                         # back face / degenerate
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / dd
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / dd
        w2 = 1 - w0 - w1
        ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        zz = w0 * z[i0] + w1 * z[i1] + w2 * z[i2]
        zr = zb[y0:y1 + 1, x0:x1 + 1]
        vis = ins & (zz < zr)
        if not vis.any():
            continue
        uv = w0[..., None] * d['uv'][i0] + w1[..., None] * d['uv'][i1] + w2[..., None] * d['uv'][i2]
        u = np.clip(uv[..., 0] * (tw - 1), 0, tw - 1).astype(int); v = np.clip(uv[..., 1] * (th - 1), 0, th - 1).astype(int)
        img[y0:y1 + 1, x0:x1 + 1][vis] = tex[v, u][vis]
        zr[vis] = zz[vis]
    return img


def run(b, systems, textures, cam, bg, seconds, fps, out_gif, travel=None, scale_out=None):
    ems = []
    for sname in systems:
        st = b.entry(PART + sname).struct
        for em in st.field(L.fnv1a('complexEmitterDefinitionData')).value.items:
            e = S.Emitter(em, textures, {})
            if e.tex is not None:
                ems.append(e)
    rng = np.random.default_rng(1)
    frames = []
    dt = 1.0 / fps
    for k in range(int(seconds * fps)):
        t = k * dt
        origin = np.zeros(3) if travel is None else travel(t)
        for e in ems:
            e.step(t, dt, rng, origin)
        fr = S.render_frame(ems, cam, t, bg)
        im = Image.fromarray((fr * 255).astype(np.uint8))
        if scale_out:
            im = im.resize(scale_out, Image.LANCZOS)
        frames.append(im.convert('P', palette=Image.ADAPTIVE, colors=220))
    frames[0].save(out_gif, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0, optimize=True)
    return frames


if __name__ == '__main__':
    fantome, game_png, rigged, albedo, outdir = sys.argv[1:6]
    os.makedirs(outdir, exist_ok=True)
    b = load_bin(fantome)
    tex = load_textures(game_png)
    W, H = 640, 480
    cam = S.Camera(W, H, target=(0, 120, 0), dist=900, pitch=48, yaw=0, fov=40)
    bg = backdrop(cam, rigged, albedo, W, H)
    Image.fromarray((bg * 255).astype(np.uint8)).save(os.path.join(outdir, 'backdrop.png'))
    jobs = {
        'ult_cast': (['Yunara_Base_R_Cast'], 3.0),
        'ult_aura': (['Yunara_Base_R_Buff_OnBase'], 2.0),
        'q_cast': (['Yunara_Base_Q_Cast', 'Yunara_Base_Q_Buff_OnBase'], 2.0),
    }
    for name, (systems, sec) in jobs.items():
        run(b, systems, tex, cam, bg, sec, 24, os.path.join(outdir, name + '.gif'))
        print('rendered', name)
