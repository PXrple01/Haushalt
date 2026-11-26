"""Texels covered by the UV islands of a mesh object in a .blend (default: the high-poly source 'hi').
The decimated game mesh reaches slightly beyond these islands at its borders; there Meshy's texture only holds
padding (colour smears from neighbouring islands), so the final texture is padded from the covered texels.

  python3 uv_coverage.py <blend> <out.npy> [res] [object]
"""
import sys

import bpy  # noqa: I001
import numpy as np
from PIL import Image, ImageDraw


def main():
    blend, out = sys.argv[1], sys.argv[2]
    res = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
    name = sys.argv[4] if len(sys.argv) > 4 else 'hi'
    bpy.ops.wm.open_mainfile(filepath=blend)
    me = bpy.data.objects[name].data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    loops = np.zeros(n * 3, np.int32); me.loop_triangles.foreach_get('loops', loops)
    uv = np.zeros(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)[loops].reshape(n, 3, 2)
    px = np.stack([uv[..., 0] * res, (1 - uv[..., 1]) * res], -1)              # image rows: v = 1 at the top
    im = Image.new('L', (res, res), 0); dr = ImageDraw.Draw(im)
    for t in px:
        dr.polygon([tuple(t[0]), tuple(t[1]), tuple(t[2])], fill=255)
    m = np.asarray(im) > 0
    np.save(out, m)
    print(f'{name}: {n} triangles cover {m.mean() * 100:.1f}% of the {res}px texture')


if __name__ == '__main__':
    main()
