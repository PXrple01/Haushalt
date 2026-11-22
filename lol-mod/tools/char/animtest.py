"""Linear-blend skinning of the exported mesh with real League animation clips (verification)."""
import json
import sys

import numpy as np
import pyritofile


def quat_mat(x, y, z, w):
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


class Skeleton:
    def __init__(self, skl_path, joints_json):
        self.skl = pyritofile.read_skl(skl_path)
        d = json.load(open(joints_json))
        self.bind = np.array([j['bind'] for j in d['joints']])
        self.ibind = np.array([j['ibind'] for j in d['joints']])
        self.parent = [j['parent'] for j in d['joints']]
        self.infl = np.array(d['influences'])
        self.hash_to_idx = {j.hash: i for i, j in enumerate(self.skl.joints)}
        self.local_bind = []
        for i, p in enumerate(self.parent):
            self.local_bind.append(self.bind[i] if p < 0 else np.linalg.inv(self.bind[p]) @ self.bind[i])

    def globals_for(self, anm, frame):
        local = list(self.local_bind)
        for tr in anm.tracks:
            i = self.hash_to_idx.get(tr.joint_hash)
            if i is None:
                continue
            keys = sorted(tr.poses.keys())
            k = keys[min(frame, len(keys) - 1)]
            p = tr.poses[k]
            M = local[i].copy()
            if p.rotate is not None:
                M[:3, :3] = quat_mat(p.rotate.x, p.rotate.y, p.rotate.z, p.rotate.w)
            if p.scale is not None:
                M[:3, :3] = M[:3, :3] * np.array([p.scale.x, p.scale.y, p.scale.z])
            if p.translate is not None:
                M[:3, 3] = [p.translate.x, p.translate.y, p.translate.z]
            local[i] = M
        G = [None] * len(local)
        for i, p in enumerate(self.parent):      # parents always precede children in .skl
            G[i] = local[i] if p < 0 else G[p] @ local[i]
        return np.array(G)

    def skin(self, pos, infl, w, G):
        S = G @ self.ibind                                     # (J,4,4)
        joint = self.infl[infl]                               # (N,4) influence -> joint
        M = (S[joint] * w[..., None, None]).sum(1)            # (N,4,4)
        p = np.concatenate([pos, np.ones((len(pos), 1))], 1)
        return np.einsum('nij,nj->ni', M, p)[:, :3]


if __name__ == '__main__':
    import os
    from PIL import Image
    sys.path.insert(0, os.path.dirname(__file__))
    import viz_tex
    skl, joints, rigged, albedo, anm_dir, out = sys.argv[1:7]
    names = sys.argv[7].split(',')
    sk = Skeleton(skl, joints)
    d = np.load(rigged)
    tex = np.asarray(Image.open(albedo).convert('RGB')).astype(float) / 255
    cuv = d['uv'][d['tris']].copy(); cuv[..., 1] = 1 - cuv[..., 1]
    tiles = []
    for nm in names:
        h, fr = nm.split(':')
        a = pyritofile.ANM(); a.read(None, raw=open(f'{anm_dir}/{h}.anm', 'rb').read())
        G = sk.globals_for(a, int(fr))
        P = sk.skin(d['pos'].astype(float), d['infl'].astype(int), d['w'].astype(float), G)
        viz_tex.render(P, d['tris'], cuv, tex, out + '.tile.png', size=(360, 560), yaw=25, pitch=12,
                       center=(P[:, 0].mean(), 110, P[:, 2].mean()), scale=2.4)
        tiles.append(Image.open(out + '.tile.png').copy())
    sheet = Image.new('RGB', (360 * len(tiles), 560))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * 360, 0))
    sheet.save(out)
