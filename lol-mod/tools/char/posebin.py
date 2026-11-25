"""Exact animation poses for previews/checks: reads the per-frame local TRS dump written by the LeagueToolkit
helper (ltk_pose_dump, every frame at a fixed fps, with the toolkit's own interpolation of compressed clips) and
turns it into global joint matrices for animtest.Skeleton."""
import struct

import numpy as np


class PoseClip:
    def __init__(self, path):
        d = open(path, 'rb').read()
        self.n, nt, self.duration = struct.unpack_from('<iif', d, 0)
        self.hashes = np.frombuffer(d, '<u4', nt, 12).copy()
        self.data = np.frombuffer(d, '<f4', self.n * nt * 10, 12 + 4 * nt).reshape(self.n, nt, 10).astype(np.float64)


def _quat_mats(q):
    x, y, z, w = q[:, 0], q[:, 1], q[:, 2], q[:, 3]
    R = np.empty((len(q), 3, 3))
    R[:, 0, 0] = 1 - 2 * (y * y + z * z); R[:, 0, 1] = 2 * (x * y - z * w); R[:, 0, 2] = 2 * (x * z + y * w)
    R[:, 1, 0] = 2 * (x * y + z * w); R[:, 1, 1] = 1 - 2 * (x * x + z * z); R[:, 1, 2] = 2 * (y * z - x * w)
    R[:, 2, 0] = 2 * (x * z - y * w); R[:, 2, 1] = 2 * (y * z + x * w); R[:, 2, 2] = 1 - 2 * (x * x + y * y)
    return R


def globals_at(sk, clip, k):
    """Global joint matrices of frame k (joints without a track keep their bind-local transform)."""
    k = int(min(max(k, 0), clip.n - 1))
    local = np.array(sk.local_bind, dtype=np.float64)
    fr = clip.data[k]
    idx = np.array([sk.hash_to_idx.get(int(h), -1) for h in clip.hashes])
    ok = idx >= 0
    R = _quat_mats(fr[ok, 0:4]) * fr[ok, None, 7:10]
    M = local[idx[ok]]
    M[:, :3, :3] = R
    M[:, :3, 3] = fr[ok, 4:7]
    local[idx[ok]] = M
    G = np.empty_like(local)
    for i, p in enumerate(sk.parent):
        G[i] = local[i] if p < 0 else G[p] @ local[i]
    return G
