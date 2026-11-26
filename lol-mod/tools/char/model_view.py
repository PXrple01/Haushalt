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
        # one preview atlas: body | expression tiles | awakened body (each one column wide)
        cols = [alb]
        if self.F is not None:
            cols.append(Image.open(os.path.join(CHAR, f'{slot}_faces.png')).convert('RGB').resize(alb.size))
        ap = os.path.join(CHAR, f'{slot}_awake.png')
        self.AW = np.load(os.path.join(CHAR, f'{slot}_awake.npz'))['tris'] if os.path.exists(ap) else None
        if self.AW is not None:
            if self.F is None:
                cols.append(alb)
            cols.append(Image.open(ap).convert('RGB').resize(alb.size))
        atlas = Image.new('RGB', (alb.width * len(cols), alb.height))
        for k, im in enumerate(cols):
            atlas.paste(im, (alb.width * k, 0))
        self.ncol = len(cols)
        us = 1.0 / self.ncol
        self.tex = np.asarray(atlas).astype(np.float32) / 255
        uv = d['uv'].astype(np.float32) * np.array([us, 1.0], np.float32)
        self.cuv = uv[d['tris']].copy(); self.cuv[..., 1] = 1 - self.cuv[..., 1]
        if self.AW is not None:
            auv = d['uv'].astype(np.float32) * np.array([us, 1.0], np.float32) + np.array([2 * us, 0], np.float32)
            self.acuv = auv[d['tris'][self.AW]].copy(); self.acuv[..., 1] = 1 - self.acuv[..., 1]
        self.mir = np.array([-1.0, 1, 1]) if mirror else np.ones(3)
        self.names = [str(x) for x in self.F['names']] if self.F is not None else []

    def skin(self, sk, G, face=None, extra=(), awake=False):
        d = self.d
        P = sk.skin(d['pos'].astype(float), d['infl'].astype(int), d['w'].astype(float), G)
        tris, cuv = d['tris'], self.cuv
        if awake and self.AW is not None:            # the 'Awake' overlay: same vertices pushed out, awakened texture
            n = len(P)
            Pa = sk.skin(d['pos'].astype(float) + d['nrm'].astype(float) * 0.06, d['infl'].astype(int), d['w'].astype(float), G)
            P = np.concatenate([P, Pa]); tris = np.concatenate([tris, d['tris'][self.AW] + n]); cuv = np.concatenate([cuv, self.acuv])
        for name in ([face] if face else []) + list(extra):
            if self.F is None or name not in self.names:
                continue
            src = self.F['src']
            fp = sk.skin(self.F['pos_' + name].astype(float), d['infl'][src].astype(int), d['w'][src].astype(float), G)
            uvf = self.F['uv_' + name]; fuv = np.stack([(1 + uvf[:, 0]) / self.ncol, uvf[:, 1]], 1)
            fc = fuv[self.F['tris']].copy(); fc[..., 1] = 1 - fc[..., 1]
            tris = np.concatenate([tris, self.F['tris'] + len(P)]); cuv = np.concatenate([cuv, fc])
            P = np.concatenate([P, fp])
        P = P * self.mir
        return P, tris[:, ::-1], cuv[:, ::-1]
