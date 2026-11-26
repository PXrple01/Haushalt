"""Short preview video of one ult proposal: the striker (animated, with his expression + metavision eyes) and the
cast effects from the built package (vfxsim, an approximation of the game renderer), plus a face close-up.

  python3 ult_video.py <fantome> <variant> <title> <subtitle lines separated by |> <work dir> <out.mp4>
work dir: poses_ours/*.pose, built.skl, dl/png (game particle pngs)
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
ROOT = os.path.join(HERE, '..', '..')
import lolbin as L  # noqa: E402
import vfxsim as S  # noqa: E402
import vfx_preview as VP  # noqa: E402
import ult_variants as UV  # noqa: E402
import ult_variants2 as UV2  # noqa: E402
import posebin, viz_tex  # noqa: E402
from screen_overlay import Overlay  # noqa: E402
from animtest import Skeleton  # noqa: E402
from model_view import Model  # noqa: E402

FPS = 30
W, H = 1280, 720
VW, VH = 900, 640
FONT = os.path.join(ROOT, 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
CAST_AT = 0.5                      # seconds into the video when R is pressed
CAST_LEN = 3.4                     # seconds of the cast shown
END_FROM, END_TO = 14.25, 15.75    # then the end of the ult (screen chains burst), buff time
CLIPS = [('033266373e54c00f', 'focus'), ('477dc1765be45513', None)]     # channel wind-up, then idle


def font(n, sans=False):
    return ImageFont.truetype(SANS if sans else FONT, n)


def wrap(dr, text, f, width):
    out, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if dr.textlength(t, font=f) > width and cur:
            out.append(cur); cur = w
        else:
            cur = t
    return out + ([cur] if cur else [])


def char_layer(cam, P, T, cuv, tex, w, h):
    """Perspective raster of the striker with a depth buffer (same camera as the effects)."""
    img = np.zeros((h, w, 3)); yy = np.linspace(0, 1, h)[:, None]
    img[:] = (np.array([0.16, 0.22, 0.17]) * (1 - yy) + np.array([0.25, 0.32, 0.23]) * yy)[:, None, :][:, 0, :][:, None, :]   # turf-like
    scr, z = cam.project(P)
    zb = np.full((h, w), 1e9); th, tw = tex.shape[:2]
    for fi, (i0, i1, i2) in enumerate(T):
        xs = scr[[i0, i1, i2], 0]; ys = scr[[i0, i1, i2], 1]
        x0, x1 = max(0, int(xs.min())), min(w - 1, int(xs.max()) + 1)
        y0, y1 = max(0, int(ys.min())), min(h - 1, int(ys.max()) + 1)
        if x1 < x0 or y1 < y0:
            continue
        dd = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if dd >= -1e-9:           # back face (front faces have a negative signed area on this y-down screen)
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / dd
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / dd
        w2 = 1 - w0 - w1
        ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        zz = w0 * z[i0] + w1 * z[i1] + w2 * z[i2]
        zr = zb[y0:y1 + 1, x0:x1 + 1]; vis = ins & (zz < zr)
        if not vis.any():
            continue
        uv = w0[..., None] * cuv[fi, 0] + w1[..., None] * cuv[fi, 1] + w2[..., None] * cuv[fi, 2]
        u = np.clip(uv[..., 0] * (tw - 1), 0, tw - 1).astype(int); v = np.clip((1 - uv[..., 1]) * (th - 1), 0, th - 1).astype(int)
        img[y0:y1 + 1, x0:x1 + 1][vis] = tex[v, u][vis]; zr[vis] = zz[vis]
    # grid on the ground
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)); dr = ImageDraw.Draw(im, 'RGBA')
    for k in range(-8, 9):
        for a, b in (((k * 100, 0, -800), (k * 100, 0, 800)), ((-800, 0, k * 100), (800, 0, k * 100))):
            p, zz = cam.project(np.array([a, b], float))
            if (zz > 1).all():
                dr.line([tuple(p[0]), tuple(p[1])], fill=(90, 140, 110, 60))
    out = np.asarray(im).astype(float) / 255
    out[zb < 1e8] = img[zb < 1e8]
    return out, zb


def main():
    fant, variant, title, sub, work, out = sys.argv[1:7]
    b = VP.load_bin(fant)
    tex = VP.load_textures(os.path.join(work, 'dl', 'png'))
    txs = UV2.textures(ROOT, variant) if variant in UV2.VARIANTS else UV.textures(ROOT)
    for n, im in txs.items():
        tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{n}.tex'] = im
    S.GAME_Z['on'] = variant in UV2.VARIANTS
    meshes = VP.load_meshes(fant)
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    M = Model()
    tex[UV2.STRIKER_TEX] = Image.fromarray((M.tex * 255).astype(np.uint8)).convert('RGBA')
    ems = [S.Emitter(em, tex, meshes) for em in b.entry(VP.PART + 'Yunara_Base_R_Cast').struct.field(L.fnv1a('complexEmitterDefinitionData')).value.items]
    ems = [e for e in ems if e.tex is not None]
    ov = Overlay(b, tex) if b.entry(L.fnv1a('Characters/Yunara/Skins/Skin0/Particles/Yunara_Base_R_ScreenChains')) else None
    clips = [(posebin.PoseClip(os.path.join(work, 'poses_ours', h + '.pose')), f) for h, f in CLIPS]
    cam = S.Camera(VW, VH, target=(0, 175, 30), dist=1150, pitch=30, yaw=0, fov=42)
    rng = np.random.default_rng(1)
    frames_dir = os.path.join(work, f'uv_{variant}'); os.makedirs(frames_dir, exist_ok=True)
    n_cast = int((CAST_AT + CAST_LEN) * FPS)
    total = n_cast + (int((END_TO - END_FROM) * FPS) if ov is not None else 0)
    names = [j.name for j in sk.skl.joints]
    only = [int(x) for x in os.environ.get('ONLY_FRAMES', '').split(',') if x]
    for k in range(total):
        if only and k > max(only):
            break
        t = k / FPS; tf = t - CAST_AT
        ending = k >= n_cast
        if ending:
            tf = END_FROM + (k - n_cast) / FPS
            clip, face, fr = clips[1][0], None, k; extra = ('meta',) if tf < 15.0 else ()
        elif tf < 0:
            clip, face, fr = clips[1][0], None, k; extra = ()
        else:
            n0 = clips[0][0].n
            fr_ = int(tf * FPS)
            clip, face, fr = (clips[0][0], 'focus', fr_) if fr_ < n0 else (clips[1][0], None, fr_ - n0)
            extra = ('meta',)
        if only and k not in only:
            if tf >= 0 and not ending:
                for e in ems:
                    e.step(tf, 1 / FPS, rng, np.zeros(3))
            continue
        G = posebin.globals_at(sk, clip, fr % clip.n)
        P, T, C = M.skin(sk, G, face, extra, awake=(tf >= 0 and tf < 15.0))
        bg, zb = char_layer(cam, P, T, C, M.tex, VW, VH)
        S.DEPTH['zb'] = zb
        if tf >= 0 and not ending:
            for e in ems:
                e.step(tf, 1 / FPS, rng, np.zeros(3))
            view = S.render_frame(ems, cam, tf, bg)
        else:
            view = bg.copy()
        if ov is not None and tf >= 0:
            ov.advance(tf)
            ov.draw(view)
        # face close-up
        hd = G[names.index('Head')][:3, 3] * np.array([-1, 1, 1.])
        fc = viz_tex.render(P, T, C, M.tex, None, size=(300, 300), yaw=10, pitch=4, center=(hd[0], hd[1] + 8, hd[2]), scale=8.5, bg=(0.1, 0.12, 0.11))
        frame = Image.new('RGB', (W, H), (14, 17, 18))
        frame.paste(Image.fromarray((np.clip(view, 0, 1) * 255).astype(np.uint8)), (20, 40))
        frame.paste(Image.fromarray((fc * 255).astype(np.uint8)), (950, 380))
        dr = ImageDraw.Draw(frame)
        dr.text((950, 40), 'ULT-VORSCHLAG', font=font(26), fill=(140, 200, 160))
        fs = 46
        while fs > 22 and dr.textlength(title, font=font(fs)) > W - 965:
            fs -= 2
        dr.text((950, 72), title, font=font(fs), fill=(255, 255, 255))
        fsz = 17
        while True:                                   # the caption must end above the face label (y 356)
            lines = wrap(dr, sub.replace('-|', '-').replace('|', ' '), font(fsz, True), W - 975)
            if 140 + len(lines) * (fsz + 9) <= 350 or fsz <= 12:
                break
            fsz -= 1
        for j, line in enumerate(lines):
            dr.text((950, 140 + j * (fsz + 9)), line, font=font(fsz, True), fill=(190, 205, 195))
        dr.text((950, 690 - 18), 'Simulation (nicht der Spiel-Renderer)', font=font(13, True), fill=(110, 125, 118))
        dr.text((950, 356), 'Gesicht: Ausdruck + Metavision-Augen', font=font(15, True), fill=(150, 170, 160))
        dr.text((30, 8), f'R gedrückt bei {CAST_AT:.1f} s' if tf < 0 else f'R  +{tf:.2f} s', font=font(18, True), fill=(160, 220, 180))
        if ov is not None:
            dr.text((260, 8), 'Ketten an DEINEN Bildschirmecken (nur du siehst sie)' if not ending else '… Ult-Ende: die Ketten sprengen sich weg',
                    font=font(18, True), fill=(230, 235, 170))
        frame.save(os.path.join(frames_dir, f'f{k:04d}.png'))
    if only:
        ims = [Image.open(os.path.join(frames_dir, f'f{k:04d}.png')).crop((20, 40, 20 + VW, 40 + VH)).resize((VW // 2, VH // 2)) for k in only]
        sheet = Image.new('RGB', (VW // 2 * 3, VH // 2 * ((len(ims) + 2) // 3)))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % 3) * (VW // 2), (i // 3) * (VH // 2)))
        sheet.save(out.replace('.mp4', '_frames.png')); print('sheet', out.replace('.mp4', '_frames.png')); return
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], check=True)
    print('video', out, total, 'frames')


if __name__ == '__main__':
    main()
