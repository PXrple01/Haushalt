"""Preview video: every animation clip of the build on the striker (exact poses from the LeagueToolkit dump,
see posebin.py) followed by the effect showcase (vfxsim renders). Software rendering, 4 processes.

  python3 anim_video.py <work dir> <out.mp4> [processes]
work dir: poses_ours/*.pose, built.skl, built_tex.png, clipnames.json, exact_metrics.json,
          fx/<segment>/f*.png (effect frames, 640x480) + fx/segments.json [[dir, title, subtitle], ...]
"""
import json
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.join(HERE, '..', '..')
W, H = 1280, 720
VW, VH = 660, 700
FPS = 30
FONT = os.path.join(ROOT, 'assets_src', 'fonts', 'BigShoulders-Bold.ttf')
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
ORDER = ['idle', 'run', 'attack', 'crit', 'spell1', 'spell2', 'spell3', 'spell4', 'channel', 'recall', 'respawn',
         'death', 'dance', 'joke', 'laugh', 'taunt', 'knockup', 'clip_', 'unreferenced']
NICE = {'idle': 'Idle', 'run': 'Laufen', 'attack': 'Angriff', 'crit': 'Krit', 'spell1': 'Q-Angriff', 'spell2': 'W',
        'spell3': 'E', 'spell4': 'R', 'channel': 'Kanalisieren', 'recall': 'Rückruf', 'respawn': 'Wiederbeleben',
        'death': 'Tod', 'dance': 'Tanz', 'joke': 'Witz', 'laugh': 'Lachen', 'taunt': 'Spott', 'knockup': 'Hochgeschleudert',
        'clip_': 'Übergang / Spezial', 'unreferenced': 'ungenutzter Clip'}


def font(size, sans=False):
    try:
        return ImageFont.truetype(SANS if sans else FONT, size)
    except OSError:
        return ImageFont.load_default()


def background():
    y = np.linspace(0, 1, H)[:, None, None]
    top, bot = np.array([0.07, 0.08, 0.11]), np.array([0.12, 0.13, 0.19])
    return np.broadcast_to(top * (1 - y) + bot * y, (H, W, 3)).copy()


def clip_list(work):
    names = json.load(open(os.path.join(work, 'clipnames.json')))
    by = {v['anm']: v['name'] or ('clip_' + k) for k, v in names.items() if v['anm']}
    m = json.load(open(os.path.join(work, 'exact_metrics.json')))
    clips = []
    for h, r in m.items():
        nm = by.get(h, 'unreferenced_' + h[:6])
        grp = next((i for i, g in enumerate(ORDER) if nm.startswith(g)), len(ORDER))
        clips.append((grp, nm, h, r['frames']))
    clips.sort()
    return clips


def reps(n):
    return 3 if n < 20 else (2 if n < 45 else 1)


def floor_bg(view_center, yaw, pitch, scale, root):
    """Model viewport background: dark gradient, ground grid around the root, soft contact shadow."""
    import viz_tex
    bg = np.zeros((VH, VW, 3))
    y = np.linspace(0, 1, VH)[:, None]
    bg[:] = (np.array([0.10, 0.11, 0.15]) * (1 - y) + np.array([0.16, 0.17, 0.24]) * y)[:, None, :][:, 0, :][:, None, :]
    im = Image.fromarray((bg * 255).astype(np.uint8)); dr = ImageDraw.Draw(im, 'RGBA')
    gx0, gz0 = np.floor(root[0] / 50) * 50, np.floor(root[2] / 50) * 50
    for k in range(-8, 9):
        for pts in ([(gx0 + k * 50, 0, gz0 - 400), (gx0 + k * 50, 0, gz0 + 400)], [(gx0 - 400, 0, gz0 + k * 50), (gx0 + 400, 0, gz0 + k * 50)]):
            p = viz_tex.project(np.array(pts), (VW, VH), yaw, pitch, view_center, scale)
            dr.line([tuple(p[0]), tuple(p[1])], fill=(120, 130, 170, 70), width=1)
    c = viz_tex.project(np.array([[root[0], 0, root[2]]]), (VW, VH), yaw, pitch, view_center, scale)[0]
    for r_, a in ((70, 40), (48, 55), (30, 70)):
        dr.ellipse([c[0] - r_ * scale * 0.5, c[1] - r_ * scale * 0.12, c[0] + r_ * scale * 0.5, c[1] + r_ * scale * 0.12], fill=(0, 0, 0, a))
    return np.asarray(im).astype(float) / 255


def panel(frame, idx, total, name, h, fr, n, rep, nrep, grp_name):
    im = Image.fromarray((frame * 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
    x0 = 740
    dr.text((x0, 40), 'FLOW STRIKER', font=font(46), fill=(235, 238, 255))
    dr.text((x0, 92), 'Animations-Check · jede Animation am Modell', font=font(19, True), fill=(160, 168, 200))
    dr.text((x0, 170), f'{idx} / {total}', font=font(64), fill=(170, 130, 255))
    dr.text((x0, 250), grp_name, font=font(24, True), fill=(200, 205, 230))
    dr.text((x0, 284), name, font=font(40), fill=(255, 255, 255))
    dr.text((x0, 336), f'Datei {h}', font=font(16, True), fill=(130, 136, 160))
    dr.text((x0, 380), f'Frame {fr + 1} / {n}   ·   {n / FPS:.2f} s   ·   30 fps', font=font(20, True), fill=(210, 214, 235))
    if nrep > 1:
        dr.text((x0, 410), f'Durchlauf {rep + 1} / {nrep} (kurzer Clip)', font=font(18, True), fill=(160, 168, 200))
    bx, by_, bw = x0, 450, 480
    dr.rectangle([bx, by_, bx + bw, by_ + 8], fill=(50, 54, 72))
    dr.rectangle([bx, by_, bx + int(bw * (fr + 1) / n), by_ + 8], fill=(170, 130, 255))
    dr.rectangle([bx, by_ + 18, bx + bw, by_ + 22], fill=(40, 44, 60))
    dr.rectangle([bx, by_ + 18, bx + int(bw * idx / total), by_ + 22], fill=(120, 200, 150))
    note = ['Riots Animation, umgerechnet auf das eigene Skelett', 'des Stürmers (Längen angepasst, extreme Dehnungen',
            'auf ±10 % begrenzt). Bodengitter: 50 Einheiten.']
    for k, t in enumerate(note):
        dr.text((x0, 520 + k * 24), t, font=font(17, True), fill=(140, 146, 172))
    return np.asarray(im)


def render_clip(job):
    (work, out_dir, start, idx, total, grp_name, name, h, n) = job
    from animtest import Skeleton
    import posebin
    import viz_tex
    A = os.path.join(ROOT, 'assets_src', 'char')
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    d = np.load(os.path.join(A, 'meshy_striker_rigged.npz'))
    tex = np.asarray(Image.open(os.path.join(work, 'built_tex.png')).convert('RGB')).astype(float) / 255
    cuv = d['uv'][d['tris']].copy(); cuv[..., 1] = 1 - cuv[..., 1]
    pos, infl, w = d['pos'].astype(float), d['infl'].astype(int), d['w'].astype(float)
    tris = d['tris'][:, ::-1].copy(); cuv = cuv[:, ::-1].copy()      # mirrored like the game (League is left-handed)
    MIR = np.array([-1.0, 1.0, 1.0])
    clip = posebin.PoseClip(os.path.join(work, 'poses_ours', h + '.pose'))
    base = background()
    k = start
    yaw, pitch, scale = 28.0, 12.0, 2.75
    nrep = reps(clip.n)
    for rep in range(nrep):
        for fr in range(clip.n):
            G = posebin.globals_at(sk, clip, fr)
            P = sk.skin(pos, infl, w, G) * MIR
            root = G[0][:3, 3] * MIR
            vc = (root[0], 112.0, root[2])
            bgv = floor_bg(vc, yaw, pitch, scale, root)
            view = viz_tex.render(P, tris, cuv, tex, None, size=(VW, VH), yaw=yaw, pitch=pitch, center=vc,
                                  scale=scale, background=bgv)
            frame = base.copy(); frame[10:10 + VH, 40:40 + VW] = view
            img = panel(frame, idx, total, name, h, fr, clip.n, rep, nrep, grp_name)
            Image.fromarray(img).save(os.path.join(out_dir, f'f{k:06d}.png')); k += 1
    return k - start


def card(out_dir, k, n, title, lines):
    for i in range(n):
        im = Image.fromarray((background() * 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
        a = min(1.0, i / 10, (n - i) / 10)
        col = tuple(int(c * a) for c in (240, 240, 255))
        dr.text((W // 2, 250), title, font=font(84), fill=col, anchor='mm')
        for j, t in enumerate(lines):
            dr.text((W // 2, 350 + j * 38), t, font=font(26, True), fill=tuple(int(c * a) for c in (180, 186, 215)), anchor='mm')
        im.save(os.path.join(out_dir, f'f{k + i:06d}.png'))
    return n


def fx_segment(out_dir, k, seg_dir, title, sub):
    files = sorted(f for f in os.listdir(seg_dir) if f.endswith('.png'))
    for i, f in enumerate(files):
        fx = Image.open(os.path.join(seg_dir, f)).convert('RGB').resize((880, 660), Image.LANCZOS)
        im = Image.fromarray((background() * 255).astype(np.uint8)); im.paste(fx, (30, 30)); dr = ImageDraw.Draw(im)
        dr.text((940, 60), 'EFFEKTE', font=font(30), fill=(160, 168, 200))
        dr.text((940, 100), title, font=font(48), fill=(255, 255, 255))
        for j, t in enumerate(sub):
            dr.text((940, 170 + j * 28), t, font=font(18, True), fill=(185, 190, 215))
        dr.text((940, 640), 'Vorschau-Simulation (nicht der Spiel-Renderer)', font=font(14, True), fill=(120, 126, 150))
        im.save(os.path.join(out_dir, f'f{k + i:06d}.png'))
    return len(files)


def main():
    work, out = sys.argv[1], sys.argv[2]
    procs = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    out_dir = os.path.join(work, 'video_frames'); os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    clips = clip_list(work)
    k = card(out_dir, 0, 75, 'FLOW STRIKER', ['Animations-Check v0.6', f'alle {len(clips)} Animationen am Modell, danach die Effekte'])
    jobs = []
    for i, (grp, nm, h, n) in enumerate(clips):
        gname = NICE.get(ORDER[grp], '') if grp < len(ORDER) else ''
        jobs.append((work, out_dir, k, i + 1, len(clips), gname, nm, h, n))
        k += n * reps(n)
    with Pool(procs) as pool:
        for done in pool.imap_unordered(render_clip, jobs):
            print('clip frames', done, flush=True)
    segs = json.load(open(os.path.join(work, 'fx', 'segments.json')))
    k += card(out_dir, k, 45, 'EFFEKTE', ['Q – Flow-Zustand · R – METAVISION · Hologramm-Stadion'])
    for seg_dir, title, sub in segs:
        k += fx_segment(out_dir, k, os.path.join(work, 'fx', seg_dir), title, sub)
    k += card(out_dir, k, 60, 'FLOW STRIKER', ['v0.6 · Yunara-Skin für CSLoL Manager'])
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(out_dir, 'f%06d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', out], check=True)
    print('video', out, k, 'frames', f'{k / FPS:.1f} s')


if __name__ == '__main__':
    main()
