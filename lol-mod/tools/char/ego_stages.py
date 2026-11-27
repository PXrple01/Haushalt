"""Preview of the Ego stages (general_fx.py): his look grows with the rank of his R (levels 1 / 6 / 11 / 16).
The glow layers are drawn additively over the body like the game's attached-mesh glow; the small extras (boot glow,
embers, meter flames) are listed in the captions.

  python3 ego_stages.py <work dir: built.skl, clipnames.json, poses_ours/> <out.png>
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
ROOT = os.path.join(HERE, '..', '..')
CHAR = os.path.join(ROOT, 'assets_src', 'char')
import posebin, viz_tex  # noqa: E402
from animtest import Skeleton  # noqa: E402
from model_view import Model  # noqa: E402
from video_common import font, wrap  # noqa: E402

# (stage, title, level, layers: (texture, colour, alpha), extras text) - same values as general_fx.sys_ego
STAGES = [
    (1, 'Stufe 1', 'Level 1-5', [], 'Grundform: so wie bisher.'),
    (2, 'Stufe 2', 'ab Level 6 (R Rang 1)', [('egoseams', (0.55, 1.0, 0.65), 0.35)],
     'Trikot-Säume und Nähte glimmen grün, grüne Linie unter der Ego-Anzeige.'),
    (3, 'Stufe 3', 'ab Level 11 (R Rang 2)', [('egoseams', (0.55, 1.0, 0.65), 0.35), ('egoseams', (0.8, 1.0, 0.85), 0.3)],
     'Säume leuchten heller, die Schuhe glühen grün, einzelne Funken steigen von den Schultern.'),
    (4, 'Stufe 4', 'ab Level 16 (R Rang 3)', [('egoseams', (0.55, 1.0, 0.65), 0.35), ('egoseams', (0.8, 1.0, 0.85), 0.3),
                                         ('egoseams', (0.75, 0.55, 1.0), 0.25), ('egohair', (0.8, 0.55, 1.0), 0.45)],
     'Violett leuchtende Haarspitzen, violetter Schimmer auf den Nähten, kleine flache Flammen an der Ego-Anzeige.'),
]


def main():
    work, out = sys.argv[1:3]
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    names = [j.name for j in sk.skl.joints]
    M = Model()
    base = M.tex.copy()
    W0 = base.shape[0]                                       # body column is square (height x height)
    layers = {n: np.asarray(Image.open(os.path.join(CHAR, f'meshy_striker_{n}.png')).convert('RGBA').resize((W0, W0))).astype(np.float32) / 255
              for n in ('egoseams', 'egohair')}
    cn = {v['name']: v['anm'] for v in json.load(open(os.path.join(work, 'clipnames.json'))).values() if v['name'] and v['anm']}
    clip = posebin.PoseClip(os.path.join(work, 'poses_ours', cn['idle1'] + '.pose'))
    G = posebin.globals_at(sk, clip, 0)
    P, T, C = M.skin(sk, G, None, ())
    hd = G[names.index('Head')][:3, 3] * np.array([-1, 1, 1.])
    cw, ch = 470, 880
    sheet = Image.new('RGB', (cw * 4, ch), (14, 17, 18))
    dr = ImageDraw.Draw(sheet)
    for k, (st, title, lvl, lay, text) in enumerate(STAGES):
        tex = base.copy()
        for n, col, a in lay:
            tex[:, :W0, :3] += layers[n][..., :3] * np.array(col, np.float32) * a
        tex = np.clip(tex, 0, 1)
        ctr = (P.max(0) + P.min(0)) / 2
        body = viz_tex.render(P, T, C, tex, None, size=(cw - 20, 470), yaw=20, pitch=8, center=(ctr[0], 105, ctr[2]), scale=2.0,
                              bg=(0.07, 0.09, 0.08))
        face = viz_tex.render(P, T, C, tex, None, size=(cw - 20, 200), yaw=15, pitch=3, center=(hd[0], hd[1] - 10, hd[2]), scale=5.0,
                              bg=(0.07, 0.09, 0.08))
        sheet.paste(Image.fromarray((body * 255).astype(np.uint8)), (cw * k + 10, 90))
        sheet.paste(Image.fromarray((face * 255).astype(np.uint8)), (cw * k + 10, 570))
        dr.text((cw * k + 14, 14), title, font=font(34), fill=(255, 255, 255))
        dr.text((cw * k + 14, 56), lvl, font=font(17, True), fill=(140, 200, 160))
        for j, line in enumerate(wrap(dr, text, font(15, True), cw - 30)):
            dr.text((cw * k + 14, 790 + j * 19), line, font=font(15, True), fill=(200, 210, 200))
    sheet.save(out)
    print('saved', out)


if __name__ == '__main__':
    main()
