"""Preview renders straight from a built .skn + texture (with the ink shell), mirrored to match the
in-game handedness. Usage: render_built.py <skn> <tex.png> <ball.png> <skl> <joints> <anm_dir> <out> <shots>"""
import sys

import numpy as np
import pyritofile
from PIL import Image

sys.path.insert(0, '..')
import lolskn  # noqa: E402
import viz_tex  # noqa: E402
from animtest import Skeleton  # noqa: E402

SHOW = ['Body', 'Pants', 'Bead_1', 'Bead_2', 'Bead_3', 'Bead_4', 'Bead_5']


def load_scene(skn_path, tex_path, ball_path):
    s = lolskn.read(skn_path)
    tex_s = np.asarray(Image.open(tex_path).convert('RGB')).astype(float) / 255
    tex_b = np.asarray(Image.open(ball_path).convert('RGB').resize((tex_s.shape[1], tex_s.shape[0] // 2))).astype(float) / 255
    atlas = np.zeros((tex_s.shape[0], tex_s.shape[1] * 2, 3)); atlas[:, :tex_s.shape[1]] = tex_s; atlas[:tex_b.shape[0], tex_s.shape[1]:] = tex_b
    V = s.verts; tris, cuv = [], []
    for m in s.submeshes:
        if m['name'] not in SHOW:
            continue
        t = s.indices[m['istart']:m['istart'] + m['icount']].reshape(-1, 3).astype(int)
        uv = V['uv'][t].copy()
        if m['name'].startswith('Bead'):
            uv[..., 0] = uv[..., 0] * 0.5 + 0.5; uv[..., 1] = uv[..., 1] * 0.5
        else:
            uv[..., 0] = uv[..., 0] * 0.5
        uv[..., 1] = 1 - uv[..., 1]
        tris.append(t); cuv.append(uv)
    return s, np.concatenate(tris), np.concatenate(cuv), atlas


def render_pose(s, tris, cuv, atlas, sk, anm_path, frame, out, size, yaw, pitch, scale, center_y=112, bg=(0.09, 0.10, 0.12)):
    pos = s.verts['pos'].astype(float)
    if anm_path:
        a = pyritofile.ANM(); a.read(None, raw=open(anm_path, 'rb').read())
        P = sk.skin(pos, s.verts['infl'].astype(int), s.verts['w'].astype(float), sk.globals_for(a, frame))
    else:
        P = pos
    P = P * np.array([-1.0, 1.0, 1.0])              # League is left-handed: mirror for a correct view
    tris2 = tris[:, ::-1]                            # mirroring flips the winding back
    cuv2 = cuv[:, ::-1]
    viz_tex.render(P, tris2, cuv2, atlas, out, size=size, yaw=yaw, pitch=pitch,
                   center=(P[:, 0].mean(), center_y, P[:, 2].mean()), scale=scale, bg=bg, outline=False)


if __name__ == '__main__':
    skn, tex, ball, skl, joints, anm_dir, out, shots = sys.argv[1:9]
    s, tris, cuv, atlas = load_scene(skn, tex, ball)
    sk = Skeleton(skl, joints)
    tiles = []
    for shot in shots.split(','):
        name, fr, yaw = shot.split(':')
        render_pose(s, tris, cuv, atlas, sk, None if name == 'bind' else f'{anm_dir}/{name}.anm', int(fr), out + '.tile.png',
                    (400, 640), float(yaw), 12, 2.65)
        tiles.append(Image.open(out + '.tile.png').copy())
    sheet = Image.new('RGB', (400 * len(tiles), 640))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * 400, 0))
    sheet.save(out)
