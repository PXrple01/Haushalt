"""Preview of the multikill moments (simulation of the built package, camera like League's):
  1. Quadrakill: the effect waits 3.5 s (a penta could still follow), then floodlight + violet Ego meter blaze.
  2. Quadra, then the penta 2 s later: the quadra effect never appears (its carrier clip is replaced and its
     particle killed before it emitted anything); the penta plays: the beast's true form roars far behind him, a golden
     trophy rises above him, camera flashes all around, and on the owner's screen the corner chains snap and burst.

  python3 multikill_video.py <fantome> <work dir: built.skl, clipnames.json, poses_ours/, dl/png> <out.mp4> [stride]
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
ROOT = os.path.join(HERE, '..', '..')
import vfxsim as S  # noqa: E402
import vfx_preview as VP  # noqa: E402
import general_fx as G  # noqa: E402
import ult_beast as UB  # noqa: E402
import multikill_fx as MK  # noqa: E402
import posebin  # noqa: E402
from screen_overlay import Overlay  # noqa: E402
from animtest import Skeleton  # noqa: E402
from model_view import Model  # noqa: E402
from beast_video import system_emitters  # noqa: E402
from video_common import char_layer, font, wrap, FPS, W, H, VW, VH  # noqa: E402

SCENE = 8.0
# (title, description, kill times: list of (time, size))
SCENES = [
    ('Quadrakill', 'Der Effekt wartet 3,5 s - es könnte ja noch ein Penta folgen. Dann fällt ein violetter Flutlichtkegel '
                   'auf ihn und seine Ego-Anzeige lodert violett auf.', [(0.5, 4)]),
    ('Quadra + Penta 2 s später', 'Der Quadra-Effekt erscheint gar nicht erst (der Penta ersetzt ihn, bevor er sichtbar '
                                  'wird). Nur der Penta: die Ego-Bestie bäumt sich riesig hinter ihm auf und brüllt, ein '
                                  'goldener Pokal aus Licht steigt auf, Blitzlichter wie im Stadion, und auf deinem '
                                  'Bildschirm schießen Ketten in die Ecken und zerspringen.', [(0.5, 4), (2.5, 5)]),
]


def main():
    fant, work, out = sys.argv[1:4]
    stride = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    b = VP.load_bin(fant)
    tex = VP.load_textures(os.path.join(work, 'dl', 'png'))
    for n, im in list(UB.textures(ROOT).items()) + list(G.textures().items()) + list(MK.textures().items()):
        tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{n}.tex'] = im
    meshes = VP.load_meshes(fant)
    S.GAME_Z['on'] = True
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    M = Model()
    cn = {v['name']: v['anm'] for v in json.load(open(os.path.join(work, 'clipnames.json'))).values() if v['name'] and v['anm']}
    idle = posebin.PoseClip(os.path.join(work, 'poses_ours', cn['idle1'] + '.pose'))
    frames_dir = os.path.join(work, 'mk_frames'); os.makedirs(frames_dir, exist_ok=True)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    cam = S.Camera(VW, VH, target=(0, 380, 200), dist=1800, pitch=56, yaw=0, fov=40)
    k_out = 0
    for title, desc, kills in SCENES:
        rng = np.random.default_rng(7)
        groups = [(system_emitters(b, G.PART + 'MV_G_EgoFrame', tex, meshes), None)]
        for k in range(1, 9):
            groups.append((system_emitters(b, G.PART + f'MV_G_EgoPip{k}', tex, meshes), None))
        live_q = None; ov = None; t_penta = None
        for t_k, size in kills:
            key = MK.QUADRA[1] if size == 4 else MK.PENTA[1]
            ems = system_emitters(b, MK.PART + key, tex, meshes, t_k)
            groups.append((ems, key))
            if size == 4:
                live_q = ems
            else:
                t_penta = t_k
                ov = Overlay(b, tex, system=MK.PART + MK.PENTA_SCREEN)
        n = int(SCENE * FPS)
        for i in range(n):
            t = i / FPS
            if t_penta is not None and live_q is not None and t >= t_penta:      # the penta replaces the quadra clip
                groups = [g_ for g_ in groups if g_[0] is not live_q]; live_q = None
            G_ = posebin.globals_at(sk, idle, i % idle.n)
            P, T, C = M.skin(sk, G_, None, ())
            live = []
            for ems, _ in groups:
                for e in ems:
                    e.step(t, 1 / FPS, rng, np.zeros(3))
                live += ems
            if i % stride:
                continue
            bg, zb = char_layer(cam, P, T, C, M.tex, VW, VH)
            S.DEPTH['zb'] = zb
            view = S.render_frame(live, cam, t, bg)
            if ov is not None and t >= t_penta:
                ov.advance(t - t_penta); ov.draw(view)
            frame = Image.new('RGB', (W, H), (14, 17, 18))
            frame.paste(Image.fromarray((np.clip(view, 0, 1) * 255).astype(np.uint8)), (20, 40))
            dr = ImageDraw.Draw(frame)
            dr.text((950, 40), 'MULTIKILLS', font=font(26), fill=(140, 200, 160))
            dr.text((950, 72), title, font=font(40), fill=(255, 255, 255))
            for j, line in enumerate(wrap(dr, desc, font(16, True), W - 975)):
                dr.text((950, 130 + j * 23), line, font=font(16, True), fill=(190, 205, 195))
            y = 400
            for t_k, size in kills:
                lab = {4: 'Quadrakill', 5: 'PENTAKILL'}[size]
                col = (255, 230, 120) if t >= t_k else (110, 125, 118)
                dr.text((950, y), f'{t_k:.1f} s  {lab}', font=font(20, True), fill=col); y += 30
            if len(kills) == 1 and t >= kills[0][0]:
                left = kills[0][0] + MK.QUADRA_DELAY - t
                dr.text((950, y + 10), f'Quadra-Effekt in {left:.1f} s' if left > 0 else 'Quadra-Effekt läuft',
                        font=font(17, True), fill=(200, 180, 255))
            if len(kills) == 2 and t >= kills[1][0]:
                dr.text((950, y + 10), 'Quadra-Effekt abgebrochen - nur Penta', font=font(17, True), fill=(255, 200, 120))
            dr.text((30, 8), f'{title}   {t:.2f} s', font=font(18, True), fill=(160, 220, 180))
            dr.text((950, 690 - 18), 'Simulation (nicht der Spiel-Renderer)', font=font(13, True), fill=(110, 125, 118))
            frame.save(os.path.join(frames_dir, f'f{k_out:04d}.png')); k_out += 1
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS // stride if stride > 1 else FPS), '-i',
                    os.path.join(frames_dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], check=True)
    print('video', out, k_out, 'frames')


if __name__ == '__main__':
    main()
