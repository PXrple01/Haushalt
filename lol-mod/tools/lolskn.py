"""Reader/writer for League .skn skinned meshes (v4.1) using numpy."""
import struct
import numpy as np

_BASE = [('pos', '<f4', 3), ('infl', 'u1', 4), ('w', '<f4', 4), ('nrm', '<f4', 3), ('uv', '<f4', 2)]


def _dtype(vtype):
    f = list(_BASE)
    if vtype >= 1:
        f.append(('col', 'u1', 4))
    if vtype == 2:
        f.append(('tan', '<f4', 4))
    return np.dtype(f)


class Skn:
    def __init__(self):
        self.submeshes = []   # list of dict(name, vstart, vcount, istart, icount)
        self.flags = 0
        self.vtype = 2
        self.indices = None   # np.uint16 (N,)
        self.verts = None     # structured array


def read(path):
    d = open(path, 'rb').read()
    p = 0
    magic, major, minor = struct.unpack_from('<IHH', d, p); p += 8
    assert magic == 0x00112233 and major == 4, (hex(magic), major, minor)
    n, = struct.unpack_from('<I', d, p); p += 4
    s = Skn()
    for _ in range(n):
        name = d[p:p + 64].split(b'\0')[0].decode(); p += 64
        vs, vc, is_, ic = struct.unpack_from('<4I', d, p); p += 16
        s.submeshes.append(dict(name=name, vstart=vs, vcount=vc, istart=is_, icount=ic))
    s.flags, ic, vc, vsize, s.vtype = struct.unpack_from('<5I', d, p); p += 20
    p += 24 + 16  # bbox + sphere (recomputed on write)
    s.indices = np.frombuffer(d, '<u2', ic, p).copy(); p += 2 * ic
    dt = _dtype(s.vtype)
    assert dt.itemsize == vsize, (dt.itemsize, vsize)
    s.verts = np.frombuffer(d, dt, vc, p).copy()
    return s


def write(s: Skn, path):
    dt = _dtype(s.vtype)
    v = s.verts.astype(dt)
    out = bytearray(struct.pack('<IHHI', 0x00112233, 4, 1, len(s.submeshes)))
    for m in s.submeshes:
        out += m['name'].encode()[:64].ljust(64, b'\0')
        out += struct.pack('<4I', m['vstart'], m['vcount'], m['istart'], m['icount'])
    pos = v['pos']
    mn, mx = pos.min(0), pos.max(0)
    c = (mn + mx) / 2
    r = float(np.sqrt(((pos - c) ** 2).sum(1)).max())
    out += struct.pack('<5I', s.flags, len(s.indices), len(v), dt.itemsize, s.vtype)
    out += struct.pack('<6f', *mn, *mx) + struct.pack('<4f', *c, r)
    out += np.asarray(s.indices, '<u2').tobytes() + v.tobytes()
    open(path, 'wb').write(bytes(out))
