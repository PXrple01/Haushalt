"""Preview of the camera-bound screen chains (tools/screen_chains.py) over a rendered frame: the emitters are taken
from the built package and simulated with vfxsim, then drawn in the camera frame (x right, z up, the 16:9
screen = x -160..160, z -90..90; for another preview aspect the x positions are stretched to its corners)."""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import lolbin as L  # noqa: E402
import vfxsim as S  # noqa: E402
import screen_chains as SC  # noqa: E402


class Overlay:
    def __init__(self, b, textures, seed=3, system=SC.SYSTEM):
        st = b.entry(system).struct
        tex = dict(textures)
        for n, im in SC.textures().items():
            tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{n}.tex'] = im
        self.ems = []
        for em in st.get('complexEmitterDefinitionData').items:
            e = S.Emitter(em, tex, {})
            e.pass_ = em.get('pass') or 0
            if e.tex is not None:
                self.ems.append(e)
        self.rng = np.random.default_rng(seed)
        self.t = None

    def advance(self, t):
        """Simulate up to time t (seconds since the R buff started), in steps of at most 1/30 s."""
        if self.t is None:
            self.t = 0.0
            for e in self.ems:
                e.step(0.0, 0.0, self.rng, np.zeros(3))
        while self.t < t - 1e-6:
            dt = min(1 / 30, t - self.t); self.t += dt
            for e in self.ems:
                e.step(self.t, dt, self.rng, np.zeros(3))

    def draw(self, canvas):
        """canvas: float HxWx3 image of the game view (modified in place)."""
        H, W = canvas.shape[:2]
        ppu = H / (2 * SC.HALF_H); stretch = (W / 2 / ppu) / SC.HALF_W
        items = []
        for e in self.ems:
            for p in e.particles:
                items.append((e, p))
        items.sort(key=lambda it: int(getattr(it[0], 'pass_', 0)))
        for e, p in items:
            age = (self.t - p['t0']) / p['life']
            sc = p['bscale'][:3] * e.scale.at(age)[:3]
            col = p['bcol'][:4] * e.col.at(age)[:4]
            if col[3] <= 0.003:
                continue
            x, z = p['pos'][0] * stretch, p['pos'][2]
            sx, sy = W / 2 + x * ppu, H / 2 - z * ppu
            w = 2 * sc[0] * ppu
            if e.flat:
                h = 2 * sc[1] * ppu; ang = 0.0
            else:
                h = w; ang = p['rot'][0] + p['spin'][0] * (self.t - p['t0'])
                if e.dir and np.linalg.norm(p['vel']) > 1:
                    v = p['vel']; ang = -np.degrees(np.arctan2(-v[2], v[0])) + 90
                    h = max(h, np.linalg.norm(v) * e.dscale * 2 * sc[0] * ppu + h)
            spr = S._sprite(e.tex, col, (w, h), ang)
            S.composite(canvas, spr, sx, sy, e.blend == 4, None)
        return canvas
