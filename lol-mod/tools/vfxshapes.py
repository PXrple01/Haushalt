"""Small geometry + look helpers shared by the effect modules: quads, boxes, cones, combined meshes, the
hologram look (Riot's alpha erosion + fresnel rim) and fade curves."""
import numpy as np

import lolbin as L
import vfxlib as V

F = L.Field
RIM = (0.45, 1.0, 0.62)


def combine(parts):
    pos, uv, tris, n = [], [], [], 0
    for P, U, T in parts:
        pos.append(P); uv.append(U); tris.append(T + n); n += len(P)
    return np.concatenate(pos).astype(np.float32), np.concatenate(uv).astype(np.float32), np.concatenate(tris).astype(np.int64)


def box(c, size):
    """Axis-aligned box (12 tris) with planar uvs."""
    c = np.asarray(c, float); h = np.asarray(size, float) / 2
    corners = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], float) * h + c
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    P, U, T = [], [], []
    for f in faces:
        b = len(P)
        P += [corners[i] for i in f]; U += [(0, 0), (1, 0), (1, 1), (0, 1)]
        T += [(b, b + 1, b + 2), (b, b + 2, b + 3)]
    return np.array(P), np.array(U, float), np.array(T)


def quad(p0, p1, p2, p3, uv=((0, 0), (1, 0), (1, 1), (0, 1))):
    return np.array([p0, p1, p2, p3], float), np.array(uv, float), np.array([(0, 1, 2), (0, 2, 3)])


def cone(a, b, ra, rb, seg=20):
    """Open cone from a (radius ra, v=0) to b (radius rb, v=1)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = (b - a) / np.linalg.norm(b - a)
    t = np.cross(d, [0, 1, 0]); t = t / np.linalg.norm(t) if np.linalg.norm(t) > 1e-6 else np.array([1, 0, 0])
    w = np.cross(d, t)
    P, U = [], []
    for k in range(seg + 1):
        ang = 2 * np.pi * k / seg; ring = np.cos(ang) * t + np.sin(ang) * w
        P += [a + ring * ra, b + ring * rb]; U += [(k / seg, 0.0), (k / seg, 1.0)]
    T = []
    for k in range(seg):
        i = 2 * k
        T += [(i, i + 2, i + 1), (i + 1, i + 2, i + 3)]
    return np.array(P), np.array(U), np.array(T)


def holo(erode_tex, drive_t, drive_v, rim=RIM):
    """Hologram look: Riot's alpha erosion (build-up / dissolve) + fresnel rim (as on Yunara's EdgeGlow)."""
    ero = L.Struct('VfxAlphaErosionDefinitionData', [
        F('erosionDriveCurve', L.EMBED, V.vfloat(drive_v[0], drive_t, drive_v)),
        F('erosionFeatherIn', L.F32, 0.03), F('erosionFeatherOut', L.F32, 0.03),
        F('erosionMapName', L.STRING, erode_tex),
        F('erosionMapChannelMixer', L.EMBED, V.vcolor((1.0, 0.0, 0.0, 0.0))),
        F('erosionMapAddressMode', L.U8, 0)], L.STRUCT)
    refl = L.Struct('VfxReflectionDefinitionData', [F('fresnelColor', L.VEC4, tuple(rim) + (0.0,))], L.STRUCT)
    return [F('alphaErosionDefinition', L.STRUCT, ero), F('reflectionDefinition', L.STRUCT, refl)]


def flat_quad():
    """World-aligned horizontal quad (not camera facing, not glued to the terrain)."""
    return [F('primitive', L.STRUCT, L.Struct('VfxPrimitiveArbitraryQuad', [], L.STRUCT)),
            F('disableBackfaceCull', L.BOOL, True)]


def fade(c, t_in=0.08, t_out=0.85, a=1.0):
    return ([0.0, t_in, t_out, 1.0], [tuple(c) + (0.0,), tuple(c) + (a,), tuple(c) + (a,), tuple(c) + (0.0,)])
