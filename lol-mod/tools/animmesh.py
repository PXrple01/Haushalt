"""Reads League animated meshes (.skn + .skl + uncompressed v4/v5 .anm) back for previews: returns a provider
age_seconds -> (surface points, uv, face normals) that vfxsim renders like a static mesh particle.
Only reads what lolrig.py / lolskn.py write (and Riot's same layouts)."""
import struct

import numpy as np

import lolrig as R
import lolskn


def read_skl(d):
    size, magic, ver, flags, nj, ninf, jo, jio, io, *_ = struct.unpack_from('<IIIHHIiiiiii5i', d, 0)
    parents, hashes, local, ibind = [], [], [], []
    for i in range(nj):
        r = struct.unpack_from('<hhhhIf3f3f4f3f3f4fi', d, jo + 100 * i)
        parents.append(r[2]); hashes.append(r[4])
        local.append(R.trs_to_mat(r[6:9], r[9:12], r[12:16]))
        ibind.append(R.trs_to_mat(r[16:19], r[19:22], r[22:26]))
    infl = list(struct.unpack_from(f'<{ninf}H', d, io))
    return parents, hashes, np.array(local), np.array(ibind), infl


def read_anm(d):
    _, ver, _, _, _, _, nt, nf, dur, *off = struct.unpack_from('<8sIIIIIIIf6i', d, 0)
    assert d[:8] == b'r3d2anmd' and ver == 4, 'preview reads v4 only'
    vo, qo, fo = off[3] + 12, off[4] + 12, off[5] + 12
    vecs = np.frombuffer(d, '<f4', (qo - vo) // 4, vo).reshape(-1, 3).astype(np.float64)
    quats = np.frombuffer(d, '<f4', (fo - qo) // 4, qo).reshape(-1, 4).astype(np.float64)
    rec = np.frombuffer(d, np.dtype([('h', '<u4'), ('t', '<u2'), ('s', '<u2'), ('r', '<u2'), ('p', '<u2')]), nf * nt, fo).reshape(nf, nt)
    return dur, rec, vecs, quats


class Provider:
    def __init__(self, skn_bytes, skl_bytes, anm_bytes, per_unit2=0.5, cap=70000, seed=3):
        import tempfile, os
        tmp = tempfile.mktemp(suffix='.skn'); open(tmp, 'wb').write(skn_bytes); s = lolskn.read(tmp); os.remove(tmp)
        self.parents, hashes, local, self.ibind, infl = read_skl(skl_bytes)
        self.dur, rec, vecs, quats = read_anm(anm_bytes)
        h2i = {h: i for i, h in enumerate(hashes)}
        self.frames = []
        for f in range(len(rec)):
            L = local.copy()
            for t in range(rec.shape[1]):
                i = h2i.get(int(rec[f, t]['h']))
                if i is not None:
                    L[i] = R.trs_to_mat(vecs[rec[f, t]['t']], vecs[rec[f, t]['s']], quats[rec[f, t]['r']])
            G = []
            for i, p in enumerate(self.parents):
                G.append(L[i] if p < 0 else G[p] @ L[i])
            self.frames.append(np.array(G) @ self.ibind)
        v = s.verts
        self.P = v['pos'].astype(np.float64)
        self.J = np.array(infl)[v['infl'].astype(int)]
        self.W = v['w'].astype(np.float64)
        T = s.indices.astype(int).reshape(-1, 3)
        uv = v['uv'].astype(np.float64); uv = np.stack([uv[:, 0], 1 - uv[:, 1]], 1)   # image convention like .scb
        rng = np.random.default_rng(seed)
        a, b, c = self.P[T[:, 0]], self.P[T[:, 1]], self.P[T[:, 2]]
        area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2
        cnt = np.maximum(1, np.round(area * per_unit2)).astype(int)
        if cnt.sum() > cap:
            cnt = np.maximum(1, np.round(cnt * cap / cnt.sum())).astype(int)
        self.fi = np.repeat(np.arange(len(T)), cnt)
        r1, r2 = rng.random(len(self.fi)), rng.random(len(self.fi))
        sq = np.sqrt(r1); self.bw = np.stack([1 - sq, sq * (1 - r2), sq * r2], 1)
        self.T = T
        self.UV = (self.bw[:, :, None] * uv[T[self.fi]]).sum(1)

    def __call__(self, age):
        k = min(int(age / self.dur), len(self.frames) - 1)
        S = self.frames[max(k, 0)]
        P = np.einsum('vk,vkij,vj->vi', self.W, S[self.J][..., :3, :], np.c_[self.P, np.ones(len(self.P))])
        tri = P[self.T]
        n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
        pts = (self.bw[:, :, None] * tri[self.fi]).sum(1)
        return pts, self.UV, n[self.fi]
