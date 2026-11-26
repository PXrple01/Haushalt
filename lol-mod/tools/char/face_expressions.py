"""Facial expressions as thin overlay layers on the face (League shows/hides submeshes per animation clip).

Input: the slot's rigged mesh + albedo, the frontal face render the edits were made from (neutral.png,
render_face() below) and the edited expression images (made with Meshy image-to-image, same framing).
Output: <slot>_faces.npz (one overlay patch per expression: positions pushed out along the normal, the head's
skin weights, planar UVs into its tile) and <slot>_faces.png (2048x2048 atlas of the tiles).
Expressions = whole face changes where the edit differs from the neutral face (eyes, brows, mouth);
'eyes-only' layers (glowing eyes) keep only the eye band and sit a little further out, so they combine with
any expression underneath.

  python3 face_expressions.py <slot> <edits dir>
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import viz_tex  # noqa: E402

CHAR = os.path.join(HERE, '..', '..', 'assets_src', 'char')
# the edits were made from this camera: 1024 px, 40 units, centre y 183, front view, model mirrored like the game
RES, SPAN, CY = 1024, 40.0, 183.0
SC = RES / SPAN
BOX = (-12.5, 12.5, 163.0, 188.0)                  # face patch in model space: x0, x1, y0, y1
TILE = 640
EXPRESSIONS = ['focus', 'shout', 'grin', 'laugh', 'pain', 'flow', 'meta']
EYES_ONLY = {'flow', 'meta'}
EYE_BAND = (172.5, 184.5)                          # y range of eyes + brows
OFFSET = {'face': 0.05, 'eyes': 0.10, 'meta': 0.13}       # meta (ult) wins over flow (Q) if both are on


def to_px(x, y):
    """model (x, y) -> pixel in the 1024 render (x mirrored)."""
    return RES / 2 - x * SC, RES / 2 - (y - CY) * SC


def load(slot):
    d = np.load(os.path.join(CHAR, f'{slot}_rigged.npz'))
    tex = np.asarray(Image.open(os.path.join(CHAR, f'{slot}_albedo.png')).convert('RGB')).astype(np.float32) / 255
    return d, tex


def hair_tris(d, tex):
    """Triangles textured with hair colour (dark blue) - they are geometry in front of the face."""
    uv = d['uv'][d['tris']].mean(1)
    H, W = tex.shape[:2]
    c = tex[np.clip((uv[:, 1] * (H - 1)).astype(int), 0, H - 1), np.clip((uv[:, 0] * (W - 1)).astype(int), 0, W - 1)]
    return (c[:, 2] > c[:, 0] * 1.25) & (c[:, 2] > c[:, 1] * 1.2) & (c[:, 0] < 0.45)


def bangs_tris(d, tex):
    """Hair-coloured triangles that float in front of the face (bangs); hair-coloured triangles lying on the
    face surface (eyebrows, lashes) are part of the face."""
    from holes import raster
    hair = hair_tris(d, tex)
    P = d['pos'].astype(float) * np.array([-1, 1, 1.]); T = d['tris'][:, ::-1]
    zf, idf, _, _ = raster(P, T[~hair], size=RES, yaw=0, pitch=0, scale=SC, center=(0, CY, 0))
    c = P[T].mean(1)
    px = np.clip((RES / 2 + c[:, 0] * SC).astype(int), 0, RES - 1); py = np.clip((RES / 2 - (c[:, 1] - CY) * SC).astype(int), 0, RES - 1)
    skin_z = zf[py, px]
    in_front = (c[:, 2] - skin_z > 0.6) | (skin_z < -1e8)
    return hair & in_front


def render_face(d, tex, skip=None):
    cuv = d['uv'][d['tris']].copy(); cuv[..., 1] = 1 - cuv[..., 1]
    P = d['pos'].astype(float) * np.array([-1, 1, 1.]); T = d['tris'][:, ::-1]; cuv = cuv[:, ::-1]
    keep = np.ones(len(T), bool) if skip is None else ~skip
    im = viz_tex.render(P, T[keep], cuv[keep], tex, None, size=(RES, RES), yaw=0, pitch=0, center=(0, CY, 0),
                        scale=SC, bg=(1, 1, 1), outline=False)
    return im


def face_patch(d, tex):
    pos = d['pos']; T = d['tris']
    c = pos[T].mean(1)
    fn = np.cross(pos[T[:, 1]] - pos[T[:, 0]], pos[T[:, 2]] - pos[T[:, 0]])
    fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-9
    x0, x1, y0, y1 = BOX
    sel = (c[:, 0] > x0 + 0.5) & (c[:, 0] < x1 - 0.5) & (c[:, 1] > y0 + 0.5) & (c[:, 1] < y1 - 0.5) & (c[:, 2] > 0) & (fn[:, 2] > 0.2)
    return sel & ~bangs_tris(d, tex)


def align(img, ref, rows=(560, 1000)):
    """Translation of an edit relative to the neutral render (lower face: no hair moves there)."""
    from skimage.registration import phase_cross_correlation
    g = lambda a: a[rows[0]:rows[1], :, :3].mean(-1)
    shift, _, _ = phase_cross_correlation(g(ref), g(img), upsample_factor=4)
    from scipy.ndimage import shift as sh
    return np.stack([sh(img[..., k], shift, order=1, mode='nearest') for k in range(3)], -1), shift


def main():
    slot, edits = sys.argv[1], sys.argv[2]
    d, tex = load(slot)
    hair = bangs_tris(d, tex)
    ref_full = np.asarray(Image.open(os.path.join(edits, 'neutral.png')).convert('RGB')).astype(np.float32) / 255
    base = render_face(d, tex, skip=hair)                       # face without the hair geometry in front
    x0, x1, y0, y1 = BOX
    px0, py0 = to_px(x1, y1); px1, py1 = to_px(x0, y0)          # mirrored x
    crop = lambda a: np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).crop(
        (int(px0), int(py0), int(px1), int(py1))).resize((TILE, TILE), Image.LANCZOS)).astype(np.float32) / 255
    base_t = crop(base)
    yy, xx = np.mgrid[0:TILE, 0:TILE]
    ymod = y1 - (yy + 0.5) / TILE * (y1 - y0)                    # model y of each tile row
    tiles, layers = {}, {}
    for name in EXPRESSIONS:
        ed = np.asarray(Image.open(os.path.join(edits, name + '.png')).convert('RGB').resize((RES, RES), Image.LANCZOS)).astype(np.float32) / 255
        ed, shift = align(ed, ref_full)
        ed_t = crop(ed)
        diff = np.abs(ed_t - crop(ref_full)).max(-1)
        hair_px = (ed_t[..., 2] > ed_t[..., 0] * 1.3) & (ed_t[..., 2] > ed_t[..., 1] * 1.2) & (ed_t[..., 0] < 0.4) & (ymod > 183.5)
        # (drawn bangs above the brows: never paint them on the skin; brows/lashes below that are wanted)
        zone = (ymod > 164.5) & (ymod < 186.5)
        if name in EYES_ONLY:
            zone &= (ymod > EYE_BAND[0]) & (ymod < EYE_BAND[1])
        m = binary_dilation((diff > 0.10) & zone & ~hair_px, iterations=6) & ~hair_px & zone
        m = gaussian_filter(m.astype(np.float32), 4)
        t = base_t * (1 - m[..., None]) + ed_t * m[..., None]
        tiles[name] = t; layers[name] = 'eyes' if name in EYES_ONLY else 'face'
        print(f'  {name:6s}: shift {np.round(shift, 1)} px, changed area {m.mean() * 100:.1f}% of the tile')
    # atlas 2048: 3x3 tiles of 640 + 16 px gutters
    atlas = np.ones((2048, 2048, 3), np.float32)
    slots = {}
    for k, name in enumerate(EXPRESSIONS):
        r, c = divmod(k, 3)
        ox, oy = 16 + c * (TILE + 32), 16 + r * (TILE + 32)
        tile = tiles[name]
        pad = np.pad(tile, ((16, 16), (16, 16), (0, 0)), mode='edge')
        atlas[oy - 16:oy + TILE + 16, ox - 16:ox + TILE + 16] = pad
        slots[name] = (ox / 2048, oy / 2048, TILE / 2048)
    Image.fromarray((atlas * 255).astype(np.uint8)).save(os.path.join(CHAR, f'{slot}_faces.png'))
    # overlay geometry: the face patch, compacted, pushed out along the normal, planar uv into each tile
    sel = face_patch(d, tex)
    T = d['tris'][sel]
    used = np.unique(T); remap = np.full(len(d['pos']), -1); remap[used] = np.arange(len(used))
    pos = d['pos'][used].astype(np.float64); nrm = d['nrm'][used].astype(np.float64)
    u = (x1 - pos[:, 0]) / (x1 - x0)                              # mirrored like the render
    v = (y1 - pos[:, 1]) / (y1 - y0)                              # image rows (top = 0)
    out = {'tris': remap[T].astype(np.int32), 'src': used.astype(np.int32)}
    for name in EXPRESSIONS:
        ox, oy, s = slots[name]
        out[f'uv_{name}'] = np.stack([ox + u * s, oy + v * s], 1).astype(np.float32)   # atlas uv, v = row/height
        out[f'pos_{name}'] = (pos + nrm * OFFSET['meta' if name == 'meta' else layers[name]]).astype(np.float32)
    out['names'] = np.array(EXPRESSIONS)
    np.savez_compressed(os.path.join(CHAR, f'{slot}_faces.npz'), **out)
    json.dump({n: layers[n] for n in EXPRESSIONS}, open(os.path.join(CHAR, f'{slot}_faces.json'), 'w'))
    print(f'face patch: {len(T)} triangles, {len(used)} vertices; atlas + overlays written')


if __name__ == '__main__':
    main()
