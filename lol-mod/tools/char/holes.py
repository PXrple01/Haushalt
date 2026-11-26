"""See-through check: a triangle that is the nearest surface at a pixel but faces away from the camera gets
culled by the game, so the viewer sees what lies behind it (a hole). Renders depth + triangle id with and
without back-face culling from many directions and poses and counts, per triangle, the pixels where it opens
such a hole (depth jump > `gap` units).  Usage: holes.py <rigged.npz> <skl> <joints.json> <pose dir> <out.npy>"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def raster(P, tris, size=360, yaw=0.0, pitch=10.0, scale=1.6, center=(0, 105, 0)):
    W = H = size
    a, b = np.radians(yaw), np.radians(pitch)
    Ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    v = (P - center) @ (Rx @ Ry).T
    sx = v[:, 0] * scale + W / 2; sy = H / 2 - v[:, 1] * scale
    zf = np.full((H, W), -1e9); idf = np.full((H, W), -1, int); zc = np.full((H, W), -1e9)
    fn = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])[:, 2]
    for fi, (i0, i1, i2) in enumerate(tris):
        xs = np.array([sx[i0], sx[i1], sx[i2]]); ys = np.array([sy[i0], sy[i1], sy[i2]])
        x0, x1 = max(0, int(xs.min())), min(W - 1, int(xs.max()) + 1)
        y0, y1 = max(0, int(ys.min())), min(H - 1, int(ys.max()) + 1)
        if x1 < x0 or y1 < y0:
            continue
        dd = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(dd) < 1e-9:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / dd
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / dd
        w2 = 1 - w0 - w1
        ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        z = w0 * v[i0, 2] + w1 * v[i1, 2] + w2 * v[i2, 2]
        r = zf[y0:y1 + 1, x0:x1 + 1]; ri = idf[y0:y1 + 1, x0:x1 + 1]
        vis = ins & (z > r); r[vis] = z[vis]; ri[vis] = fi
        if fn[fi] > 0:
            rc = zc[y0:y1 + 1, x0:x1 + 1]; vc = ins & (z > rc); rc[vis & vc] = z[vis & vc]; rc[~vis & vc] = z[~vis & vc]
    return zf, idf, zc, fn


def count_holes(pos, tris, frames, gap=2.5):
    hits = np.zeros(len(tris), int)
    for P in frames:
        for yaw in range(0, 360, 30):
            for pitch in (-15, 12, 40):
                zf, idf, zc, fn = raster(P, tris, yaw=yaw, pitch=pitch, center=(P[:, 0].mean(), P[:, 1].mean(), P[:, 2].mean()))
                hole = (idf >= 0) & (fn[np.maximum(idf, 0)] <= 0) & ((zf - zc) > gap)
                np.add.at(hits, idf[hole], 1)
    return hits


if __name__ == '__main__':
    from animtest import Skeleton
    import posebin
    rig, skl, joints, pose_dir, out = sys.argv[1:6]
    d = np.load(rig); pos = d['pos'].astype(float); tris = d['tris']
    frames = [pos]
    if pose_dir != '-':
        sk = Skeleton(skl, joints)
        for h, fr in (('477dc1765be45513', 20), ('d9764325bfc64c9f', 30), ('77971d46872dff53', 16), ('6c9eb02e478956e1', 60)):
            clip = posebin.PoseClip(os.path.join(pose_dir, h + '.pose'))
            frames.append(sk.skin(pos, d['infl'].astype(int), d['w'].astype(float), posebin.globals_at(sk, clip, fr)))
    hits = count_holes(pos, tris, frames)
    np.save(out, hits)
    bad = np.where(hits > 0)[0]
    print(f'{len(bad)} triangles open see-through holes ({int(hits.sum())} pixel hits over {len(frames)} poses x 36 views)')
