"""Props Meshy modelled for the effects (v0.16): read by tools/char/glb_read.py into assets_src/vfx/meshy/<name>.npz
+ <name>_basecolor.png, here turned into League space (y up, the camera looks from -z), scaled, placed and given
their textures:
  trophy      the penta's golden trophy (cup with handles, football relief)        -> multikill_fx
  goal        the recall goal with a real net (posts at the front, net sloping back) -> general_fx
  chainlink   a spiked iron chain link with runes (light 692-tri version) -> the ult cast's chain ring and every
              flying chain shard (build_mod.step_ult_cast, ult_beast)
  floodhead   a stadium floodlight lamp head with ten lamps, at the top of the quadra's light cone -> multikill_fx
  crown       a crown of chains and horns on the penta ghost's head (skinned to its Head joint) -> beast_anim / multikill_fx
glTF faces +z; props that should face the camera are turned 180 degrees about y (x, z negated), the goal already has
its opening at -z.
"""
import math
import os

import numpy as np
from PIL import Image

MESHY = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_src', 'vfx', 'meshy')


def available(name):
    return os.path.exists(os.path.join(MESHY, name + '.npz'))


def _load(name, turn=True):
    d = np.load(os.path.join(MESHY, name + '.npz'))
    P = d['pos'].astype(np.float64); N = d['nrm'].astype(np.float64)
    if turn:
        P = P * np.array([-1.0, 1.0, -1.0]); N = N * np.array([-1.0, 1.0, -1.0])
    return P, N, d['uv'].astype(np.float64), d['tris'].astype(np.int64)


def texture(name, kind='plain'):
    im = Image.open(os.path.join(MESHY, name + '_basecolor.png')).convert('RGB')
    a = np.asarray(im).astype(np.float32) / 255
    if kind == 'gold':                       # warmer, brighter polished gold
        lum = a.mean(-1, keepdims=True)
        a = np.clip(np.array([1.0, 0.80, 0.38]) * (0.25 + 1.15 * lum) + np.clip(lum - 0.75, 0, 1) * 1.2, 0, 1)
    elif kind == 'light':                    # white: drawn additively as light
        a = np.clip(a * 1.1, 0, 1)
    elif kind == 'iron':                     # dark iron, lifted so the links read on the dark field
        a = np.clip(a * 1.7 + 0.06, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))


def _ground_center(P, height=None, width=None):
    if height is not None:
        P = P * (height / np.ptp(P[:, 1]))
    if width is not None:
        P = P * (width / np.ptp(P[:, 0]))
    c = (P.max(0) + P.min(0)) / 2
    return P - np.array([c[0], P[:, 1].min(), c[2]])


def trophy(height=150.0):
    P, N, U, T = _load('trophy')
    return _ground_center(P, height=height), U, T


def goal(width=270.0, z0=30.0):
    """Opening towards the camera, the goal line z0 behind him, the net sloping back (+z)."""
    P, N, U, T = _load('goal', turn=False)
    P = _ground_center(P, width=width)
    P[:, 2] += z0 - P[:, 2].min()
    return P, U, T


def chain_link(length=29.0, name='chainlink_lo'):
    """One link, long axis x, its opening in the x-y plane, thin along z (like make_assets.chain_link)."""
    P, N, U, T = _load(name)
    P = P * (length / np.ptp(P[:, 0]))
    P -= (P.max(0) + P.min(0)) / 2
    return P, U, T


def chain_ring(radius=64.0, count=20, name='chainlink_lo'):
    """A ring of interlocking links around his body in the horizontal plane: each link along the tangent,
    every second one turned 90 degrees about it."""
    L, U, T = chain_link(name=name)
    Ps, Us, Ts = [], [], []
    for k in range(count):
        a = 2 * math.pi * k / count
        t = np.array([-math.sin(a), 0.0, math.cos(a)]); r = np.array([math.cos(a), 0.0, math.sin(a)]); u = np.array([0, 1.0, 0])
        n = u if k % 2 == 0 else r
        z = np.cross(t, n)
        Rm = np.stack([t, n, z], 1)                                   # link x -> tangent, y -> n, z -> t x n
        Ps.append(L @ Rm.T + r * radius); Us.append(U); Ts.append(T + k * len(L))
    return np.concatenate(Ps), np.concatenate(Us), np.concatenate(Ts)


def floodlight_head(width=150.0, tilt_deg=15.0):
    """A stadium floodlight lamp head (ten lamps), centred, its lamps turned towards the camera (a little upwards
    from facing it straight), so the lit lenses read from League's top-down view at the top of the light cone."""
    P, N, U, T = _load('floodhead')
    P = P * (width / np.ptp(P[:, 0]))
    P -= (P.max(0) + P.min(0)) / 2
    t = math.radians(tilt_deg)
    c, s = math.cos(t), math.sin(t)
    Rx = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    return P @ Rx.T, U, T


def crown(head_top, width=125.0):
    """The penta crown in the beast's bind space, sitting on its head (head_top = top centre of the head)."""
    P, N, U, T = _load('crown')
    s = width / np.ptp(P[:, 0])
    P = P * s
    c = (P.max(0) + P.min(0)) / 2
    P = P - np.array([c[0], P[:, 1].min(), c[2]]) + np.asarray(head_top) - np.array([0, 22.0, 0])
    return P, N, U, T
