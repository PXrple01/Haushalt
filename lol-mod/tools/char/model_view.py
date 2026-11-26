"""The striker as the build ships it, for previews: body + ink-free mesh with the combined texture (body atlas
left, expression tiles right) and the expression overlay layers. skin(sk, G, face) -> (P, tris, corner uv)."""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CHAR = os.path.join(HERE, '..', '..', 'assets_src', 'char')


class Model:
    def __init__(self, slot='meshy_striker', mirror=True):
        d = np.load(os.path.join(CHAR, f'{slot}_rigged.npz'))
        self.d = d
        alb = Image.open(os.path.join(CHAR, f'{slot}_albedo.png')).convert('RGB')
        fp = os.path.join(CHAR, f'{slot}_faces.npz')
        self.F = np.load(fp) if os.path.exists(fp) else None
        us = 1.0
        if self.F is not None:
            both = Image.new('RGB', (alb.width * 2, alb.height)); both.paste(alb, (0, 0))
            both.paste(Image.open(os.path.join(CHAR, f'{slot}_faces.png')).convert('RGB').resize(alb.size), (alb.width, 0))
            alb = both; us = 0.5
        self.tex = np.asarray(alb).astype(np.float32) / 255
        uv = d['uv'].astype(np.float32) * np.array([us, 1.0], np.float32)
        self.cuv = uv[d['tris']].copy(); self.cuv[..., 1] = 1 - self.cuv[..., 1]
        self.mir = np.array([-1.0, 1, 1]) if mirror else np.ones(3)
        self.names = [str(x) for x in self.F['names']] if self.F is not None else []

    def skin(self, sk, G, face=None, extra=()):
        d = self.d
        P = sk.skin(d['pos'].astype(float), d['infl'].astype(int), d['w'].astype(float), G)
        tris, cuv = d['tris'], self.cuv
        for name in ([face] if face else []) + list(extra):
            if self.F is None or name not in self.names:
                continue
            src = self.F['src']
            fp = sk.skin(self.F['pos_' + name].astype(float), d['infl'][src].astype(int), d['w'][src].astype(float), G)
            uvf = self.F['uv_' + name]; fuv = np.stack([0.5 + uvf[:, 0] * 0.5, uvf[:, 1]], 1)
            fc = fuv[self.F['tris']].copy(); fc[..., 1] = 1 - fc[..., 1]
            tris = np.concatenate([tris, self.F['tris'] + len(P)]); cuv = np.concatenate([cuv, fc])
            P = np.concatenate([P, fp])
        P = P * self.mir
        return P, tris[:, ::-1], cuv[:, ::-1]
