"""Writers for League skeletons (.skl, the 0x22FD4FC3 'RigResource' layout) and uncompressed animations
(.anm r3d2anmd v4), laid out exactly like Riot's own files (see yunara_base.skl / Yunara's v4 clips):

  .skl  header 64 B | joints 100 B each | (id, pad, ELF hash) sorted by hash | influences u16 | names
  .anm  header 76 B | vector palette (3 f32) | quaternion palette (4 f32, x y z w) | per frame per track
        (ELF hash u32, translation idx u16, scale idx u16, rotation idx u16, pad u16)

Joint and track hashes are ELF hashes of the lower-case joint name (as Riot's files have them).
"""
import struct

import numpy as np


def elf(name):
    h = 0
    for c in name.lower().encode():
        h = ((h << 4) + c) & 0xFFFFFFFF
        g = h & 0xF0000000
        if g:
            h ^= g >> 24
        h &= ~g & 0xFFFFFFFF
    return h


def mat_to_trs(M):
    """4x4 (rotation * scale, translation) -> (t, s, q xyzw)."""
    M = np.asarray(M, np.float64)
    t = M[:3, 3].copy()
    R = M[:3, :3].copy()
    s = np.linalg.norm(R, axis=0)
    R = R / np.where(s > 1e-12, s, 1.0)
    if np.linalg.det(R) < 0:
        s[0] = -s[0]; R[:, 0] = -R[:, 0]
    return t, s, quat_from_mat(R)


def quat_from_mat(R):
    tr = R[0, 0] + R[1, 1] + R[2, 2]
    if tr > 0:
        S = np.sqrt(tr + 1.0) * 2
        w = 0.25 * S; x = (R[2, 1] - R[1, 2]) / S; y = (R[0, 2] - R[2, 0]) / S; z = (R[1, 0] - R[0, 1]) / S
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        S = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2
        w = (R[2, 1] - R[1, 2]) / S; x = 0.25 * S; y = (R[0, 1] + R[1, 0]) / S; z = (R[0, 2] + R[2, 0]) / S
    elif R[1, 1] > R[2, 2]:
        S = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2
        w = (R[0, 2] - R[2, 0]) / S; x = (R[0, 1] + R[1, 0]) / S; y = 0.25 * S; z = (R[1, 2] + R[2, 1]) / S
    else:
        S = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2
        w = (R[1, 0] - R[0, 1]) / S; x = (R[0, 2] + R[2, 0]) / S; y = (R[1, 2] + R[2, 1]) / S; z = 0.25 * S
    q = np.array([x, y, z, w]); q /= np.linalg.norm(q)
    return q


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def trs_to_mat(t, s, q):
    M = np.eye(4)
    M[:3, :3] = quat_to_mat(q) * np.asarray(s)
    M[:3, 3] = t
    return M


def _pad4(b):
    return b + b'\0' * ((-len(b)) % 4)


def write_skl(names, parents, local_bind, influences, radius=2.1):
    """names[i], parents[i] (-1 = root, parents precede children), local_bind[i] = 4x4 local rest transform,
    influences = joint ids used by the .skn (the skn's influence index k means joint influences[k])."""
    n = len(names)
    G = []
    for i in range(n):
        G.append(local_bind[i] if parents[i] < 0 else G[parents[i]] @ local_bind[i])
    jo = 64
    jio = jo + 100 * n
    io = jio + 8 * n
    tail = io + 2 * len(influences)
    tail += (-tail) % 4
    name_off, asset_off = tail, tail + 4
    names_off = tail + 8
    name_pos, blob = [], b''
    for nm in names:
        name_pos.append(names_off + len(blob))
        blob += _pad4(nm.encode() + b'\0')
    size = names_off + len(blob)
    out = bytearray(size)
    struct.pack_into('<IIIHHIiiiiii5i', out, 0, size, 0x22FD4FC3, 0, 0, n, len(influences), jo, jio, io, name_off,
                     asset_off, names_off, -1, -1, -1, -1, -1)
    for i in range(n):
        lt, ls, lq = mat_to_trs(local_bind[i])
        it, is_, iq = mat_to_trs(np.linalg.inv(G[i]))
        p = jo + 100 * i
        struct.pack_into('<hhhhIf3f3f4f3f3f4fi', out, p, 0, i, parents[i], 0, elf(names[i]), radius,
                         *lt, *ls, *lq, *it, *is_, *iq, name_pos[i] - (p + 96))
    for k, (h, i) in enumerate(sorted((elf(nm), i) for i, nm in enumerate(names))):
        struct.pack_into('<HHI', out, jio + 8 * k, i, 0, h)
    struct.pack_into(f'<{len(influences)}H', out, io, *influences)
    out[names_off:] = blob
    return bytes(out)


def write_anm_v4(names, frames_trs, fps=30.0):
    """frames_trs[f][j] = (t, s, q) local transform of joint j in frame f. Returns r3d2anmd v4 bytes."""
    nf, nj = len(frames_trs), len(names)
    vecs, vkey, quats, qkey = [], {}, [], {}

    def vid(v):
        k = tuple(np.round(np.asarray(v, np.float64), 5))
        if k not in vkey:
            vkey[k] = len(vecs); vecs.append(k)
        return vkey[k]

    def qid(q):
        q = np.asarray(q, np.float64)
        if q[3] < 0:
            q = -q
        k = tuple(np.round(q, 6))
        if k not in qkey:
            qkey[k] = len(quats); quats.append(k)
        return qkey[k]
    hashes = [elf(n) for n in names]
    recs = []
    for f in range(nf):
        for j in range(nj):
            t, s, q = frames_trs[f][j]
            recs.append((hashes[j], vid(t), vid(s), qid(q)))
    assert len(vecs) < 65536 and len(quats) < 65536, (len(vecs), len(quats))
    vec_b = np.array(vecs, '<f4').tobytes()
    quat_b = np.array(quats, '<f4').tobytes()
    frm_b = b''.join(struct.pack('<IHHHH', h, t, s, r, 0) for h, t, s, r in recs)
    vecs_o = 64; quats_o = vecs_o + len(vec_b); frames_o = quats_o + len(quat_b)
    size = 12 + frames_o + len(frm_b)   # offsets are relative to byte 12
    hdr = struct.pack('<8sIIIIIIIf6i', b'r3d2anmd', 4, size - 12, 0, 0, 0, nj, nf, 1.0 / fps, 0, 0, 0, vecs_o, quats_o, frames_o)
    hdr += b'\0' * (12 + vecs_o - len(hdr))            # 12 reserved bytes: the palette starts at offset 64 + 12
    return hdr + vec_b + quat_b + frm_b
