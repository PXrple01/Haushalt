"""Minimal GLB reader (no Blender needed): the first mesh's triangles with POSITION / NORMAL / TEXCOORD_0 (node
transforms applied) and the base colour image of its material.

  python3 glb_read.py <model.glb> <out.npz> <out_basecolor.png>
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read(path):
    data = open(path, 'rb').read()
    assert data[:4] == b'glTF', 'not a GLB'
    off, js, binary = 12, None, None
    while off < len(data):
        ln, typ = struct.unpack_from('<I4s', data, off)
        chunk = data[off + 8:off + 8 + ln]
        if typ == b'JSON':
            js = json.loads(chunk)
        elif typ == b'BIN\0':
            binary = chunk
        off += 8 + ln
    return js, binary


def accessor(js, binary, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    n, dt = NC[a['type']], CT[a['componentType']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0) or n * np.dtype(dt).itemsize
    raw = np.frombuffer(binary, np.uint8, count=stride * (a['count'] - 1) + n * np.dtype(dt).itemsize, offset=start)
    out = np.lib.stride_tricks.as_strided(raw.view(dt), (a['count'], n), (stride, np.dtype(dt).itemsize)).copy()
    if a.get('normalized') and dt != np.float32:
        out = out.astype(np.float32) / np.iinfo(dt).max
    return out


def node_matrix(nd):
    if 'matrix' in nd:
        return np.array(nd['matrix'], float).reshape(4, 4).T
    M = np.eye(4)
    if 'scale' in nd:
        M = np.diag(list(nd['scale']) + [1.0]) @ M
    if 'rotation' in nd:
        x, y, z, w = nd['rotation']
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        Rm = np.eye(4); Rm[:3, :3] = R; M = Rm @ M
    if 'translation' in nd:
        T = np.eye(4); T[:3, 3] = nd['translation']; M = T @ M
    return M


def main(path, out_npz, out_png):
    js, binary = read(path)
    # world matrix of the node that holds the first mesh
    parents = {}
    for i, nd in enumerate(js.get('nodes', [])):
        for c in nd.get('children', []):
            parents[c] = i
    mi = next(i for i, nd in enumerate(js['nodes']) if 'mesh' in nd)
    W = np.eye(4); k = mi
    while k is not None:
        W = node_matrix(js['nodes'][k]) @ W; k = parents.get(k)
    prim = js['meshes'][js['nodes'][mi]['mesh']]['primitives'][0]
    at = prim['attributes']
    P = accessor(js, binary, at['POSITION']).astype(np.float64)
    N = accessor(js, binary, at['NORMAL']).astype(np.float64) if 'NORMAL' in at else np.zeros_like(P)
    U = accessor(js, binary, at['TEXCOORD_0']).astype(np.float64)
    I = accessor(js, binary, prim['indices']).reshape(-1, 3).astype(np.int64)
    P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
    N = N @ W[:3, :3].T; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    mat = js['materials'][prim['material']]
    tex = mat['pbrMetallicRoughness']['baseColorTexture']['index']
    img = js['images'][js['textures'][tex]['source']]
    bv = js['bufferViews'][img['bufferView']]
    im = Image.open(io.BytesIO(binary[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))
    im.convert('RGB').save(out_png)
    np.savez_compressed(out_npz, pos=P, nrm=N, uv=U, tris=I)
    print(f'{len(P)} verts, {len(I)} tris, bbox {P.min(0).round(3)} .. {P.max(0).round(3)}, texture {im.size}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
