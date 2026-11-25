"""Custom skeleton for a model with its own proportions + animation retargeting.

The model is first re-posed so every limb points the same way as in Yunara's bind pose (meshy_repose.py).
Then every joint keeps Yunara's orientation and only moves to the model's landmarks, so Yunara's animation
*rotations* drive the model unchanged. Animation *translations* are retargeted per joint (in the parent's
frame):   t' = c + (t - b) * s      b/c = Yunara/custom bind offset, s = bone-length ratio (root: hip height)
This keeps Riot's squash & stretch proportional and puts the feet on the ground.

Files are patched in place byte for byte (SKL joint records; ANM translation data), so every other part of
Riot's formats (hash tables, influences, quaternions, jump caches) stays exactly as shipped.

  python3 custom_skeleton.py skeleton <yunara.skl> <yunara joints.json> <landmarks_posed.json> <out_dir> <name>
  python3 custom_skeleton.py anims <retarget.json> <anm_in_dir> <anm_out_dir>
"""
import json
import os
import struct
import sys

import numpy as np

MAIN = ['Root', 'Spine1', 'Spine2', 'Chest', 'Neck', 'Head'] + [
    f'{s}_{n}' for s in ('L', 'R') for n in ('Clavicle', 'Shoulder', 'Elbow', 'Hand', 'Hip', 'KneeUpper', 'Foot', 'Toe')]
TWINS = {f'{s}_{a}': f'{s}_{b}' for s in ('L', 'R') for a, b in
         (('KneeLower', 'KneeUpper'), ('Shoulder_Scale', 'Shoulder'), ('Elbow_Scale', 'Elbow'), ('Hip_Snap', 'Hip'))}
ROOTLIKE = ['Root', 'C_Buffbone_Glb_Center_Loc', 'L_Hip_Snap', 'R_Hip_Snap', 'Buffbone_Glb_Ground_Loc']
# Riot's clips stretch limbs and spine up to +80 % for a frame or two (squash & stretch smears). On Yunara's thin
# limbs that reads as motion; on a model with sleeves, shorts and socks it reads as broken. Body bones keep their
# length within about +-15 % (soft limit, tanh), timing and direction stay exactly as animated.
STRETCH_LIMIT = 0.10


def segments(P, head_top):
    seg = [('Root', 'Spine1'), ('Spine1', 'Spine2'), ('Spine2', 'Chest'), ('Chest', 'Neck'), ('Neck', 'Head'), ('Head', head_top)]
    for s in ('L', 'R'):
        seg += [(f'{s}_Clavicle', f'{s}_Shoulder'), (f'{s}_Shoulder', f'{s}_Elbow'), (f'{s}_Elbow', f'{s}_Hand'),
                (f'{s}_Hand', f'{s}_HandEnd'), ('Root', f'{s}_Hip'), (f'{s}_Hip', f'{s}_KneeUpper'),
                (f'{s}_KneeUpper', f'{s}_Foot'), (f'{s}_Foot', f'{s}_Toe')]
    return seg


def build_skeleton(skl_path, joints_path, lm_path, out_dir, name):
    jd = json.load(open(joints_path)); J = jd['joints']
    names = [j['name'] for j in J]; idx = {n: i for i, n in enumerate(names)}
    LM = {k: np.array(v, float) for k, v in json.load(open(lm_path)).items()}
    G = [np.array(j['bind'], float) for j in J]
    Y = {n: G[i][:3, 3] for i, n in enumerate(names)}

    def under_root(i):
        while J[i]['parent'] >= 0:
            i = J[i]['parent']
        return names[i] == 'Root'
    # landmark targets for the main joints (+ helper end points of head and hands)
    T = {n: LM[n] for n in MAIN}
    Y = dict(Y)
    Y['HeadTop'] = np.array([0.0, 210.0, 1.0]); T['HeadTop'] = np.array([LM['Head'][0], 210.5, LM['Head'][2]])
    for s in ('L', 'R'):
        Y[f'{s}_HandEnd'] = Y[f'{s}_Middle3']
        T[f'{s}_HandEnd'] = LM[f'{s}_Hand'] + (LM[f'{s}_HandTip'] - LM[f'{s}_Hand']) * 0.85
    head_scale = np.linalg.norm(T['HeadTop'] - T['Head']) / np.linalg.norm(Y['HeadTop'] - Y['Head'])
    head_scale = float(np.clip(head_scale, 1.0, 1.45))
    segs = segments(Y, 'HeadTop')
    newpos = {}
    for i, n in enumerate(names):
        if n in T:
            newpos[n] = T[n]
        elif n in TWINS:
            newpos[n] = T[TWINS[n]] + (Y[n] - Y[TWINS[n]])
        elif n == 'Pelvis':
            newpos[n] = T['Root'] + (Y['Pelvis'] - Y['Root'])
        elif n == 'C_Buffbone_Glb_Center_Loc':
            newpos[n] = T['Root'] + (Y[n] - Y['Root'])
        elif under_root(i):
            p = Y[n]; best = None
            for a, b in segs:
                ab = Y[b] - Y[a]; t = float(np.clip((p - Y[a]) @ ab / (ab @ ab), 0, 1)); q = Y[a] + t * ab
                dd = np.linalg.norm(p - q)
                if best is None or dd < best[0]:
                    best = (dd, a, b, t, p - q)
            _, a, b, t, off = best
            k = head_scale if a in ('Neck', 'Head') else 1.0
            newpos[n] = T[a] + t * (T[b] - T[a]) + off * k
        else:
            newpos[n] = Y[n]          # beads, ground markers, overhead: unchanged
    # global matrices: Yunara's orientation, custom position
    G2 = []
    for i, n in enumerate(names):
        M = G[i].copy(); M[:3, 3] = newpos[n]; G2.append(M)
    raw = bytearray(open(skl_path, 'rb').read())
    jo = struct.unpack_from('<i', raw, 20)[0]
    retarget = {}
    changed = 0
    for i, n in enumerate(names):
        rec = jo + i * 100
        assert struct.unpack_from('<H', raw, rec + 2)[0] == i
        b_loc = np.array(struct.unpack_from('<3f', raw, rec + 16))
        h = struct.unpack_from('<I', raw, rec + 8)[0]
        p = J[i]['parent']
        if np.allclose(newpos[n], Y[n], atol=1e-6) and (p < 0 or np.allclose(newpos[names[p]], Y[names[p]], atol=1e-6)):
            retarget[str(h)] = {'name': n, 'b': b_loc.tolist(), 'c': b_loc.tolist(), 's': 1.0}
            continue
        loc = G2[i] if p < 0 else np.linalg.inv(G2[p]) @ G2[i]
        c_loc = loc[:3, 3]
        ib = np.linalg.inv(G2[i])
        struct.pack_into('<3f', raw, rec + 16, *c_loc)
        struct.pack_into('<3f', raw, rec + 56, *ib[:3, 3])
        changed += 1
        k = 0.0
        if n in ROOTLIKE:
            s_ = float(T['Root'][1] / Y['Root'][1])
        else:
            lb, lc = np.linalg.norm(b_loc), np.linalg.norm(c_loc)
            s_ = float(lc / lb) if lb > 1.0 else 1.0
            k = STRETCH_LIMIT if (lc > 1.0 and under_root(i)) else 0.0
        retarget[str(h)] = {'name': n, 'b': b_loc.tolist(), 'c': c_loc.tolist(), 's': s_, 'k': k}
    os.makedirs(out_dir, exist_ok=True)
    open(os.path.join(out_dir, f'{name}.skl'), 'wb').write(raw)
    out_j = {'joints': [], 'influences': jd['influences']}
    for i, j in enumerate(J):
        out_j['joints'].append({'name': j['name'], 'parent': j['parent'], 'bind': G2[i].tolist(),
                                'ibind': np.linalg.inv(G2[i]).tolist(), 'pos': newpos[j['name']].tolist()})
    json.dump(out_j, open(os.path.join(out_dir, f'{name}_joints.json'), 'w'))
    json.dump(retarget, open(os.path.join(out_dir, f'{name}_retarget.json'), 'w'), indent=0)
    print(f'custom skeleton: {changed} of {len(names)} joints moved; head offsets x{head_scale:.2f}; '
          f'root scale {T["Root"][1] / Y["Root"][1]:.3f}')


# ------------------------------------------------------------------ animations
def _xf(params, h):
    p = params.get(str(h))
    if p is None:
        return None
    b, c, s, k = np.array(p['b']), np.array(p['c']), p['s'], p.get('k', 0.0)
    if s == 1.0 and np.array_equal(b, c) and not k:
        return None
    lc = float(np.linalg.norm(c))

    def f(t):
        v = c + (t - b) * s
        if k:
            ln = float(np.linalg.norm(v))
            if ln > 1e-6:
                r = ln / lc
                v = v * ((1.0 + k * np.tanh((r - 1.0) / k)) / r)
        return v
    return f


def retarget_uncompressed(raw, params):
    ver = struct.unpack_from('<I', raw, 8)[0]
    tracks, frames = struct.unpack_from('<II', raw, 28)
    off = list(struct.unpack_from('<6i', raw, 40))
    vecs_o, quats_o, frames_o = off[3] + 12, off[4] + 12, off[5] + 12
    vecs = np.frombuffer(raw, '<f4', (quats_o - vecs_o) // 4, vecs_o).reshape(-1, 3).astype(np.float64)
    if ver == 5:
        hashes = np.frombuffer(raw, '<u4', tracks, off[0] + 12)
        fr = np.frombuffer(raw, '<u2', frames * tracks * 3, frames_o).reshape(frames, tracks, 3).copy()
        track_hash = np.broadcast_to(hashes, (frames, tracks))
    else:
        rec = np.frombuffer(raw, np.dtype([('h', '<u4'), ('t', '<u2'), ('s', '<u2'), ('r', '<u2'), ('p', '<u2')]),
                            frames * tracks, frames_o).reshape(frames, tracks).copy()
        fr = np.stack([rec['t'], rec['s'], rec['r']], -1)
        track_hash = rec['h']
    pal, key = [], {}

    def add(v):
        k = tuple(np.round(v, 5))
        if k not in key:
            key[k] = len(pal); pal.append(v)
        return key[k]
    xfs = {}
    newfr = fr.copy()
    for f in range(frames):
        for t in range(tracks):
            h = int(track_hash[f, t])
            if h not in xfs:
                xfs[h] = _xf(params, h)
            tv = vecs[fr[f, t, 0]]
            newfr[f, t, 0] = add(xfs[h](tv) if xfs[h] else tv)
            newfr[f, t, 1] = add(vecs[fr[f, t, 1]])
    if len(pal) > 65535:
        raise ValueError(f'vector palette overflow: {len(pal)}')
    new_vecs = np.array(pal, '<f4').tobytes()
    out = bytearray(raw[:vecs_o]) + new_vecs
    shift = len(new_vecs) - (quats_o - vecs_o)
    out += raw[quats_o:frames_o]                       # quaternions (+ joint hashes in v5) unchanged
    if ver == 5:
        out += newfr.astype('<u2').tobytes()
        tail = raw[frames_o + frames * tracks * 6:]
    else:
        rec2 = rec.copy(); rec2['t'] = newfr[..., 0]; rec2['s'] = newfr[..., 1]
        out += rec2.tobytes()
        tail = raw[frames_o + frames * tracks * 12:]
    out += tail
    for k in (0, 1, 2, 4, 5):                          # offsets that lie behind the vector palette move
        if off[k] > 0 and off[k] + 12 >= quats_o:
            off[k] += shift
    struct.pack_into('<6i', out, 40, *off)
    struct.pack_into('<I', out, 12, len(out) - 12)              # resource size = file size - 12
    return bytes(out), len(pal)


def retarget_compressed(raw, params):
    raw = bytearray(raw)
    tracks, nkeys = struct.unpack_from('<II', raw, 24)
    tmin = np.array(struct.unpack_from('<3f', raw, 68), np.float64); tmax = np.array(struct.unpack_from('<3f', raw, 80), np.float64)
    frames_o, _, hashes_o = struct.unpack_from('<3i', raw, 116)
    hashes = np.frombuffer(bytes(raw), '<u4', tracks, hashes_o + 12)
    keys = np.frombuffer(bytes(raw), np.dtype([('time', '<u2'), ('bits', '<u2'), ('v', '<u2', 3)]), nkeys, frames_o + 12).copy()
    is_t = (keys['bits'] >> 14) == 1
    joint = keys['bits'] & 0x3FFF
    span = tmax - tmin
    val = tmin + span / 65535.0 * keys['v'].astype(np.float64)
    new = val.copy()
    for j in np.unique(joint[is_t]):
        x = _xf(params, int(hashes[j]))
        if x:
            m = is_t & (joint == j)
            new[m] = np.array([x(v) for v in val[m]])
    nmin = np.minimum(tmin, new[is_t].min(0)) if is_t.any() else tmin
    nmax = np.maximum(tmax, new[is_t].max(0)) if is_t.any() else tmax
    nspan = np.where(nmax - nmin > 1e-9, nmax - nmin, 1.0)
    q = np.clip(np.round((new - nmin) / nspan * 65535.0), 0, 65535).astype('<u2')
    keys['v'][is_t] = q[is_t]
    struct.pack_into('<3f', raw, 68, *nmin.astype(np.float32)); struct.pack_into('<3f', raw, 80, *nmax.astype(np.float32))
    raw[frames_o + 12: frames_o + 12 + keys.nbytes] = keys.tobytes()
    return bytes(raw), int(is_t.sum())


def retarget_dir(params_path, src, dst):
    params = json.load(open(params_path))
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(src)):
        raw = open(os.path.join(src, f), 'rb').read()
        if raw[:8] == b'r3d2canm':
            out, n = retarget_compressed(raw, params); kind = 'canm'
        elif raw[:8] == b'r3d2anmd' and struct.unpack_from('<I', raw, 8)[0] in (4, 5):
            out, n = retarget_uncompressed(raw, params); kind = f'v{struct.unpack_from("<I", raw, 8)[0]}'
        else:
            raise SystemExit(f'unknown animation format in {f}')
        open(os.path.join(dst, f), 'wb').write(out)
        print(f'  {f}: {kind:4s} {len(raw):7d} -> {len(out):7d} bytes ({n} {"translation keys" if kind == "canm" else "palette vectors"})')


if __name__ == '__main__':
    if sys.argv[1] == 'skeleton':
        build_skeleton(*sys.argv[2:7])
    elif sys.argv[1] == 'anims':
        retarget_dir(*sys.argv[2:5])
