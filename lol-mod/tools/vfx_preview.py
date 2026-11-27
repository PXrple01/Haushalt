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


def load_meshes(fantome):
    """All .scb meshes of the build (by path) as point samples for vfxsim."""
    import struct
    wad = zipfile.ZipFile(fantome).read('WAD/Yunara.wad.client')
    b = load_bin(fantome)
    paths = set()
    for e in b.entries:
        if e.struct is None:
            continue
        stack = [e.struct]
        while stack:
            st = stack.pop()
            for f in st.fields:
                if f.type == L.STRING and isinstance(f.value, str) and f.value.lower().endswith('.scb'):
                    paths.add(f.value.lower())
                v = f.value
                if hasattr(v, 'fields'):
                    stack.append(v)
                elif hasattr(v, 'items') and isinstance(v.items, list):
                    stack += [x for x in v.items if hasattr(x, 'fields')]
    n = struct.unpack_from('<I', wad, 268)[0]
    toc = {struct.unpack_from('<Q', wad, 272 + 32 * i)[0]: struct.unpack_from('<II', wad, 272 + 32 * i + 8) for i in range(n)}
    out = {}
    for pth in paths:
        h = xxhash.xxh64(pth.encode()).intdigest()
        if h not in toc:
            continue
        o, c = toc[h]; d = wad[o:o + c]
        nv, nf, flags = struct.unpack_from('<III', d, 140)
        pos = np.frombuffer(d, '<f4', nv * 3, 180).reshape(-1, 3).astype(float)
        off = 180 + nv * 12 + 12
        tris = np.zeros((nf, 3), int); cuv = np.zeros((nf, 3, 2))
        for k in range(nf):
            tris[k] = struct.unpack_from('<3I', d, off); u = struct.unpack_from('<6f', d, off + 76)
            cuv[k] = [(u[0], u[3]), (u[1], u[4]), (u[2], u[5])]; off += 100
        out[pth] = S.mesh_samples(pos, tris, cuv)
    # animated meshes (skn + skl + anm in a VfxMeshDefinitionData)
    import animmesh
    def get_path(pth):
        h = xxhash.xxh64(pth.lower().encode()).intdigest()
        if h not in toc:
            return None
        o, c = toc[h]; return wad[o:o + c]
    for e in b.entries:
        if e.struct is None:
            continue
        stack = [e.struct]
        while stack:
            st = stack.pop()
            if st.type_hash == L.fnv1a('VfxMeshDefinitionData'):
                fs = {f.hash: f.value for f in st.fields}
                skn, skl, anm = (fs.get(L.fnv1a(k)) for k in ('mMeshName', 'mMeshSkeletonName', 'mAnimationName'))
                key = f'{skn}|{anm}'.lower() if skn and anm else None      # one skn can play several animations
                if skn and skl and anm and key not in out:
                    parts = [get_path(x) for x in (skn, skl, anm)]
                    if all(parts):
                        out[key] = animmesh.Provider(*parts)
            for f in st.fields:
                v = f.value
                if hasattr(v, 'fields'):
                    stack.append(v)
                elif hasattr(v, 'items') and isinstance(v.items, list):
                    stack += [x for x in v.items if hasattr(x, 'fields')]
    # the striker himself for attached-mesh glows (mirrored like the backdrop)
    d = np.load(os.path.join(HERE, '..', 'assets_src', 'char', 'meshy_striker_rigged.npz'))
    P = d['pos'].astype(float) * np.array([-1.0, 1, 1]); T = d['tris'][:, ::-1]
    out['__attached__'] = S.mesh_samples(P, T, d['uv'][T].astype(float), per_unit2=1.5, cap=90000)
    return out


def load_textures(game_png):
    tex = {}
    for f in os.listdir(GEN):
        if f.endswith('.png'):
            tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{f[:-4]}.tex'] = Image.open(os.path.join(GEN, f)).convert('RGBA')
    for orb, src in (('yunara_base_ba_orb01', 'ball_sprite'), ('yunara_base_q_orb01', 'ball_sprite_q'), ('yunara_base_passive_orb01', 'ball_sprite_flow')):
        tex[f'assets/characters/yunara/skins/base/particles/{orb}.tex'] = Image.open(os.path.join(GEN, src + '.png')).convert('RGBA')
    tex['assets/characters/yunara/skins/base/particles/mvfx/mvfx_ball_rebound.tex'] = Image.open(os.path.join(GEN, 'ball_sprite.png')).convert('RGBA')
    tex['assets/characters/yunara/skins/base/particles/mvfx/mvfx_ball_ult.tex'] = Image.open(os.path.join(GEN, 'ball_sprite_ult.png')).convert('RGBA')
    sp = os.path.join(game_png, 'assets_characters_yunara_skins_base_particles_base_generic_sparks_add.png')
    if os.path.exists(sp):
        im = Image.open(sp).convert('RGBA')
        a = np.asarray(im).astype(float); lum = a[..., :3].max(-1)
        im = Image.fromarray(np.dstack([np.full(lum.shape, 255), np.full(lum.shape, 255), np.full(lum.shape, 255), lum]).astype(np.uint8))
        tex['assets/characters/yunara/skins/base/particles/base_generic_sparks_add.tex'] = im
    # white-violet copies of shared Riot textures used by the Q (see build_mod.step_q_flow)
    from lolassets import q_image
    import recolor as RC
    for n in RC.COLORED_TEXTURES:
        src = os.path.join(game_png, f'assets_characters_yunara_skins_base_particles_{n}.png')
        if os.path.exists(src):
            tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_q_{n}.tex'] = q_image(Image.open(src))
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
    S.DEPTH['zb'] = zb                 # particles behind the striker get hidden (like the game's depth test)
    return img


def run(b, systems, textures, cam, bg, seconds, fps, out_gif, travel=None, scale_out=None, meshes=None, only=None):
    ems = []
    for sname in systems:
        st = b.entry(PART + sname).struct
        for em in st.field(L.fnv1a('complexEmitterDefinitionData')).value.items:
            if only and not any(str(em.get('emitterName')).startswith(o) for o in only):
                continue
            e = S.Emitter(em, textures, meshes or {})
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
    meshes = load_meshes(fantome)
    wide = S.Camera(W, H, target=(0, 140, 120), dist=2100, pitch=42, yaw=0, fov=40)
    wbg = backdrop(wide, rigged, albedo, W, H)
    run(b, ['Yunara_Base_R_Cast'], tex, wide, wbg, 3.4, 20, os.path.join(outdir, 'ult_stadium.gif'), meshes=meshes)
    print('rendered ult_stadium')
    jobs = {
        'ult_cast': (['Yunara_Base_R_Cast'], 3.0),
        'ult_aura': (['Yunara_Base_R_Buff_OnBase'], 2.0),
        'q_cast': (['Yunara_Base_Q_Cast', 'Yunara_Base_Q_Buff_OnBase'], 2.0),
    }
    for name, (systems, sec) in jobs.items():
        run(b, systems, tex, cam, bg, sec, 24, os.path.join(outdir, name + '.gif'), meshes=meshes)
        print('rendered', name)
