"""Preview of the whole ult (16.5 s): R is pressed, the chains burst, the Ego beast rises behind the striker and stays
for the 15 s of the R buff while he stands, attacks, runs right and left and turns - the beast follows him without
turning - then it hurls itself into him as the screen chains burst. Effects come from the built package (vfxsim, an
approximation of the game renderer); camera close to League's (looking down ~56 deg).

  python3 beast_video.py <fantome> <work dir: built.skl, clipnames.json, poses_ours/, dl/png> <out.mp4> [stride]
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
import lolbin as L  # noqa: E402
import vfxsim as S  # noqa: E402
import vfx_preview as VP  # noqa: E402
import general_fx as G  # noqa: E402
import ult_beast as UB  # noqa: E402
import beast_anim as BA  # noqa: E402
import posebin, viz_tex  # noqa: E402
from screen_overlay import Overlay  # noqa: E402
from animtest import Skeleton  # noqa: E402
from model_view import Model  # noqa: E402
from video_common import char_layer, font, wrap, FPS, W, H, VW, VH  # noqa: E402

CAST_AT = 0.6
TOTAL = 16.6
SPEED = 330.0
# (from, to, clip, face, facing yaw deg (0 = camera), x velocity) in seconds of the video
SCRIPT = [
    (0.0, 0.6, 'idle1', None, 0, 0),
    (0.6, 1.63, 'channel_wndup', 'focus', 0, 0),
    (1.63, 3.6, 'idle1', None, 0, 0),
    (3.6, 4.0, 'attack1', 'focus', 0, 0),
    (4.0, 4.4, 'attack2', 'focus', 0, 0),
    (4.4, 5.6, 'run_base', None, 90, SPEED),
    (5.6, 6.2, 'idle1', None, 50, 0),
    (6.2, 8.0, 'run_base', None, -90, -SPEED),
    (8.0, 9.2, 'idle1', None, -30, 0),
    (9.2, 9.6, 'crit1', 'shout', 0, 0),
    (9.6, 10.6, 'run_base', None, 90, SPEED),
    (10.6, 12.6, 'taunt', 'grin', 0, 0),
    (12.6, 13.4, 'run_base', None, -90, -SPEED),
    (13.4, TOTAL, 'idle1', None, 0, 0),
]
LABELS = {'rise': 'steigt aus dem Schattenpool', 'roar': 'brüllt - seine Ketten zerspringen', 'pound': 'trommelt auf die Brust',
          'stomp': 'stampft auf', 'swipe': 'Klauenhieb', 'shout': 'breitet die Arme aus und brüllt', 'dive': 'stürzt sich in ihn hinein',
          None: 'lauert hinter ihm, sieht sich um'}


def rot_y(P, deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    Q = P.copy(); Q[:, 0], Q[:, 2] = c * P[:, 0] + s * P[:, 2], -s * P[:, 0] + c * P[:, 2]
    return Q


def system_emitters(b, key, tex, meshes, delay=0.0):
    out = []
    st = b.entry(key).struct
    for em in st.get('complexEmitterDefinitionData').items:
        e = S.Emitter(em, tex, meshes)
        if e.tex is not None and not e.attached:     # attached-mesh afterimages: the sim can only show a frozen pose
            e.delay += delay
            out.append(e)
    return out


def main():
    fant, work, out = sys.argv[1:4]
    stride = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    b = VP.load_bin(fant)
    tex = VP.load_textures(os.path.join(work, 'dl', 'png'))
    for n, im in list(UB.textures(ROOT).items()) + list(G.textures().items()):
        tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{n}.tex'] = im
    meshes = VP.load_meshes(fant)
    S.GAME_Z['on'] = True
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    names = [j.name for j in sk.skl.joints]
    M = Model()
    cn = {v['name']: v['anm'] for v in json.load(open(os.path.join(work, 'clipnames.json'))).values() if v['name'] and v['anm']}
    clips = {c: posebin.PoseClip(os.path.join(work, 'poses_ours', cn[c] + '.pose')) for c in {s_[2] for s_ in SCRIPT}}
    groups = [   # (emitters, bone or None for his position)
        (system_emitters(b, VP.PART + 'Yunara_Base_R_Cast', tex, meshes, CAST_AT), None),
        (system_emitters(b, G.PART + UB.SYSTEM, tex, meshes, CAST_AT), None),
        (system_emitters(b, VP.PART + 'Yunara_Base_R_Buff_OnBase', tex, meshes, CAST_AT), None),
        (system_emitters(b, G.PART + 'MV_G_AwakeAuraBig', tex, meshes, CAST_AT), 'C_Buffbone_Glb_Head_Loc'),
        (system_emitters(b, G.PART + 'MV_G_EgoFrame', tex, meshes), None)]
    for k in range(1, 6):
        groups.append((system_emitters(b, G.PART + f'MV_G_EgoPip{k}', tex, meshes), None))
    ov = Overlay(b, tex)
    segs, total = BA.timeline()
    frames_dir = os.path.join(work, 'beast_frames'); os.makedirs(frames_dir, exist_ok=True)
    rng = np.random.default_rng(4)
    x, k_out = 0.0, 0
    n = int(TOTAL * FPS)
    cam = S.Camera(VW, VH, target=(0, 150, 60), dist=1500, pitch=56, yaw=0, fov=40)
    for i in range(n):
        t = i / FPS
        seg = next(s_ for s_ in SCRIPT if s_[0] <= t < s_[1] + 1e-9)
        a, _, clip, face, yaw, vx = seg
        x += vx / FPS
        c = clips[clip]
        fr = int((t - a) * FPS) % c.n
        G_ = posebin.globals_at(sk, c, fr)
        tb = t - CAST_AT                                 # time since R
        in_ult = 0 <= tb < 15.0
        extra = ('meta',) if in_ult else ()
        P, T, C = M.skin(sk, G_, face, extra, awake=in_ult)
        P = rot_y(P, yaw); P[:, 0] += x

        def bone(name):
            p = G_[names.index(name)][:3, 3] * np.array([-1.0, 1, 1])
            p = rot_y(p[None], yaw)[0]; p[0] += x
            return p * np.array([1.0, 1, -1])            # preview space -> game coordinates
        live = []
        for ems, bn in groups:
            org = bone(bn) if bn else np.array([x, 0.0, 0.0])
            for e in ems:
                e.step(t, 1 / FPS, rng, org)
            live += ems
        if i % stride:
            continue
        bg, zb = char_layer(cam, P, T, C, M.tex, VW, VH)
        S.DEPTH['zb'] = zb
        view = S.render_frame(live, cam, t, bg)
        if 0 <= tb:
            ov.advance(tb); ov.draw(view)
        hd = bone('Head') * np.array([1, 1, -1.0])
        fc = viz_tex.render(P, T, C, M.tex, None, size=(300, 300), yaw=-yaw + 10, pitch=4, center=(hd[0], hd[1] + 8, hd[2]),
                            scale=8.5, bg=(0.1, 0.12, 0.11))
        frame = Image.new('RGB', (W, H), (14, 17, 18))
        frame.paste(Image.fromarray((np.clip(view, 0, 1) * 255).astype(np.uint8)), (20, 40))
        frame.paste(Image.fromarray((fc * 255).astype(np.uint8)), (950, 380))
        dr = ImageDraw.Draw(frame)
        dr.text((950, 40), 'DIE ULT', font=font(26), fill=(140, 200, 160))
        dr.text((950, 72), 'Ego-Bestie', font=font(46), fill=(255, 255, 255))
        desc = ('Das Biest bleibt die ganzen 15 Sekunden hinter ihm, folgt ihm überallhin und dreht sich nie mit. '
                'Am Ende stürzt es sich in ihn, während die Bildschirm-Ketten zerspringen.')
        for j, line in enumerate(wrap(dr, desc, font(16, True), W - 975)):
            dr.text((950, 136 + j * 23), line, font=font(16, True), fill=(190, 205, 195))
        if tb < 0:
            act = 'R gleich ...'
        elif tb < total:
            lab = next((lb for s0, s1, _, _, _, lb in segs if s0 <= tb < s1), None)
            act = 'Biest: ' + LABELS.get(lab, LABELS[None])
        else:
            act = 'Ult vorbei'
        dr.text((950, 300), act, font=font(17, True), fill=(230, 235, 170))
        dr.text((950, 356), 'Erwachte Form + Metavision-Augen' if in_ult else 'Gesicht', font=font(15, True), fill=(150, 170, 160))
        dr.text((30, 8), f'R  +{tb:.2f} s' if tb >= 0 else 'R gleich', font=font(18, True), fill=(160, 220, 180))
        dr.text((200, 8), 'er läuft rechts / links und dreht sich - das Biest folgt, ohne sich mitzudrehen', font=font(15, True), fill=(200, 210, 200))
        dr.text((950, 690 - 18), 'Simulation (nicht der Spiel-Renderer)', font=font(13, True), fill=(110, 125, 118))
        frame.save(os.path.join(frames_dir, f'f{k_out:04d}.png')); k_out += 1
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS // stride if stride > 1 else FPS), '-i',
                    os.path.join(frames_dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], check=True)
    print('video', out, k_out, 'frames')


if __name__ == '__main__':
    main()
