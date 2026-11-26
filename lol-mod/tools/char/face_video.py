"""Preview video: facial expressions + blinking together with the animations, switched exactly like the build does
it in game: every clip in build_mod.FACE_CLIPS shows its face layer for the whole clip (SubmeshVisibility event),
the clips in build_mod.BLINKS close the eyes for BLINK_LEN frames at the listed frames, Q shows the white-violet
flow eyes, R the green Metavision eyes (buff conditions). Body view + face close-up.

  python3 face_video.py <work dir: built.skl, clipnames.json, poses_ours/> <out.mp4>
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
import posebin, viz_tex  # noqa: E402
from animtest import Skeleton  # noqa: E402
from model_view import Model  # noqa: E402
from video_common import font, wrap, FPS, W, H  # noqa: E402
import build_mod as BM  # noqa: E402

FACE_DE = {None: 'neutral', 'focus': 'konzentriert', 'shout': 'Kampfschrei', 'grin': 'Grinsen', 'laugh': 'Lachen',
           'pain': 'Schmerz', 'blink': 'Blinzeln', 'flow': 'Flow-Augen (Q)', 'meta': 'Metavision-Augen (R)'}
# (clip, first frame, frames to show, title, what happens, buff eyes)
SEGMENTS = [
    ('idle1', 0, 162, 'Stehen', 'Er blinzelt zweimal, ganz kurz (4 Frames), wie im Spiel.', None),
    ('run_base', 0, 122, 'Laufen', 'Ein Blinzeln pro Laufzyklus.', None),
    ('attack1', 0, 12, 'Angriff 1', 'Konzentrierter Blick für die ganze Animation.', None),
    ('attack2', 0, 12, 'Angriff 2', 'Konzentriert.', None),
    ('crit1', 0, 12, 'Kritischer Treffer', 'Kampfschrei.', None),
    ('crit2', 0, 12, 'Kritischer Treffer 2', 'Kampfschrei.', None),
    ('spell1_attack1', 0, 21, 'Q-Angriff', 'Konzentriert + weiß-violett leuchtende Flow-Augen (Q aktiv).', 'flow'),
    ('spell1_crit1', 0, 40, 'Q-Krit', 'Kampfschrei + Flow-Augen.', 'flow'),
    ('spell2', 0, 33, 'W', 'Kampfschrei.', None),
    ('channel_wndup', 0, 31, 'R: Metavision', 'Konzentriert + grüne Metavision-Augen.', 'meta'),
    ('channel', 0, 21, 'R: Metavision', 'Grüne Metavision-Augen bleiben die ganze Ult über.', 'meta'),
    ('taunt', 0, 120, 'Spott', 'Selbstbewusstes Grinsen.', None),
    ('joke_loop', 0, 82, 'Witz', 'Grinsen.', None),
    ('laugh', 0, 100, 'Lachen', 'Lacht mit geschlossenen Augen.', None),
    ('dance_loop', 0, 74, 'Tanz', 'Lachen.', None),
    ('knockup', 0, 31, 'Hochgeschleudert', 'Schmerz.', None),
    ('death', 0, 70, 'Tod', 'Schmerz.', None),
]


def face_for(clip):
    for face, clips in BM.FACE_CLIPS.items():
        if clip in clips:
            return face
    return None


def main():
    work, out = sys.argv[1:3]
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    names = [j.name for j in sk.skl.joints]
    M = Model()
    cn = {v['name']: v['anm'] for v in json.load(open(os.path.join(work, 'clipnames.json'))).values() if v['name'] and v['anm']}
    frames_dir = os.path.join(work, 'face_frames'); os.makedirs(frames_dir, exist_ok=True)
    k = 0
    for clip, f0, n, title, what, buff in SEGMENTS:
        c = posebin.PoseClip(os.path.join(work, 'poses_ours', cn[clip] + '.pose'))
        face = face_for(clip)
        blinks = BM.BLINKS.get(clip, [])
        reps = 2 if n <= 21 else 1
        for rep in range(reps):
            for i in range(n):
                fr = (f0 + i) % c.n
                G = posebin.globals_at(sk, c, fr)
                blink = any(b <= fr < b + BM.BLINK_LEN for b in blinks)
                extra = (['blink'] if blink else []) + ([buff] if buff else [])
                P, T, C = M.skin(sk, G, face, tuple(extra))
                ctr = (P.max(0) + P.min(0)) / 2
                body = viz_tex.render(P, T, C, M.tex, None, size=(700, 680), yaw=20, pitch=8, center=(ctr[0], 105, ctr[2]),
                                      scale=2.6, bg=(0.10, 0.12, 0.11))
                hd = G[names.index('Head')][:3, 3] * np.array([-1, 1, 1.])
                fc = viz_tex.render(P, T, C, M.tex, None, size=(420, 420), yaw=12, pitch=3, center=(hd[0], hd[1] + 8, hd[2]),
                                    scale=12.0, bg=(0.10, 0.12, 0.11))
                frame = Image.new('RGB', (W, H), (14, 17, 18))
                frame.paste(Image.fromarray((body * 255).astype(np.uint8)), (20, 20))
                frame.paste(Image.fromarray((fc * 255).astype(np.uint8)), (790, 280))
                dr = ImageDraw.Draw(frame)
                dr.text((790, 20), 'MIMIK + BLINZELN', font=font(24), fill=(140, 200, 160))
                dr.text((790, 50), title, font=font(42), fill=(255, 255, 255))
                for j, line in enumerate(wrap(dr, what, font(17, True), W - 810)):
                    dr.text((790, 104 + j * 24), line, font=font(17, True), fill=(190, 205, 195))
                shown = [FACE_DE[face]] + [FACE_DE[e] for e in extra]
                col = (255, 230, 120) if blink else (170, 220, 190)
                dr.text((790, 200), 'Gesicht jetzt: ' + ' + '.join(shown), font=font(18, True), fill=col)
                dr.text((790, 226), f'Animation: {clip}  Frame {fr}/{c.n}', font=font(15, True), fill=(130, 145, 138))
                frame.save(os.path.join(frames_dir, f'f{k:05d}.png')); k += 1
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, 'f%05d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], check=True)
    print('video', out, k, 'frames')


if __name__ == '__main__':
    main()
