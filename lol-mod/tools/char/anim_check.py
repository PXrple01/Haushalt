"""Control run for every animation clip on the striker (exact poses from tools/ltk_pose_dump):
  twist  - swing/twist decomposition of hip, knee and ankle relative to the bind pose (a real knee is a hinge:
           more than a few degrees of knee twist shows up as a twisted shin)
  mesh   - per triangle: folds (normal turned against its bone), collapse (< 30 % area), blow-up (> 250 % area),
           per body region; the worst frame of each clip is what to look at
  python3 anim_check.py twist|mesh <work dir: built.skl, clipnames.json, poses_ours/>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np, posebin
from animtest import Skeleton
SP = sys.argv[2]
skb = Skeleton(f'{SP}/built.skl', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'build', 'meshy_striker_joints.json'))
names = [j.name for j in skb.skl.joints]
I = lambda n: names.index(n)
def twist(Gp, Gc, Bp, Bc, axis):
    """twist (deg) of child relative to parent about `axis` (child-local), relative to the bind pose"""
    rel = Gp[:3, :3].T @ Gc[:3, :3]; relb = Bp[:3, :3].T @ Bc[:3, :3]
    D = relb.T @ rel
    # rotation matrix -> quaternion
    w = np.sqrt(max(0, 1 + D[0, 0] + D[1, 1] + D[2, 2])) / 2
    v = np.array([D[2, 1] - D[1, 2], D[0, 2] - D[2, 0], D[1, 0] - D[0, 1]]) / (4 * w + 1e-12)
    a = axis / np.linalg.norm(axis)
    return np.degrees(2 * np.arctan2(v @ a, w))
def leg(sk, G, s):
    B = sk.bind; L = sk.local_bind
    h, kl, f, t, pel = I(f'{s}_Hip'), I(f'{s}_KneeLower'), I(f'{s}_Foot'), I(f'{s}_Toe'), I('Pelvis')
    shin_ax = L[f][:3, 3]; thigh_ax = L[I(f'{s}_KneeUpper')][:3, 3] if np.linalg.norm(L[I(f'{s}_KneeUpper')][:3, 3]) > 1 else L[kl][:3, 3]
    knee = twist(G[h], G[kl], B[h], B[kl], shin_ax)
    # ankle: twist of the foot about the shin axis, expressed in the foot frame
    ax_f = (B[f][:3, :3].T @ B[kl][:3, :3]) @ shin_ax
    ankle = twist(G[kl], G[f], B[kl], B[f], ax_f)
    hip = twist(G[pel], G[h], B[pel], B[h], L[I(f'{s}_KneeUpper')][:3, 3])
    return hip, knee, ankle
def run_twist():
    clips = json.load(open(f'{SP}/clipnames.json'))
    out = []
    for k, v in clips.items():
        if not v['anm'] or not os.path.exists(f"{SP}/poses_ours/{v['anm']}.pose"): continue
        c = posebin.PoseClip(f"{SP}/poses_ours/{v['anm']}.pose")
        w = {'hip': (0, 0, ''), 'knee': (0, 0, ''), 'ankle': (0, 0, '')}
        for fr in range(c.n):
            G = posebin.globals_at(skb, c, fr)
            for s in 'LR':
                for key, val in zip(('hip', 'knee', 'ankle'), leg(skb, G, s)):
                    if abs(val) > abs(w[key][0]): w[key] = (val, fr, s)
        out.append((v['name'] or k, v['anm'], c.n, w))
    for name, anm, n, w in sorted(out, key=lambda r: -max(abs(r[3]['knee'][0]), abs(r[3]['ankle'][0]))):
        print(f'{name:22s} {anm} n={n:3d} ' + '  '.join(f'{k}={v[0]:+.0f}@{v[1]}{v[2]}' for k, v in w.items()))


def run_mesh():
    sk = skb
    
    from animtest import Skeleton
    SP = sys.argv[1]
    d = np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets_src', 'char', 'meshy_striker_rigged.npz'))
    P0 = d['pos'].astype(float); T = d['tris'].astype(int); infl = d['infl'].astype(int); w = d['w'].astype(float)
    dom = infl[np.arange(len(P0)), w.argmax(1)]
    jn = np.array([names[sk.infl[i]] if hasattr(sk, 'infl') and len(sk.infl) > i else '' for i in dom])
    def region(n):
        for key, r in (('Knee', 'leg'), ('Foot', 'leg'), ('Toe', 'leg'), ('Hip', 'leg'), ('Elbow', 'arm'), ('Shoulder', 'arm'), ('Hand', 'arm'),
                       ('Finger', 'hand'), ('Thumb', 'hand'), ('Index', 'hand'), ('Pinky', 'hand'), ('Ring', 'hand'), ('Middle', 'hand'), ('Head', 'head'), ('Neck', 'head')):
            if key in n: return r
        return 'torso'
    treg = np.array([region(n) for n in jn[T[:, 0]]])
    def areas_normals(P):
        n = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); a = np.linalg.norm(n, axis=1) / 2
        return a, n / (2 * a[:, None] + 1e-12)
    a0, n0 = areas_normals(P0)
    ok = a0 > 1e-3
    clips = json.load(open(f'{SP}/clipnames.json'))
    B = sk.bind
    res = []
    for k, v in clips.items():
        if not v['anm'] or not os.path.exists(f"{SP}/poses_ours/{v['anm']}.pose"): continue
        c = posebin.PoseClip(f"{SP}/poses_ours/{v['anm']}.pose")
        worst = {}
        for fr in range(0, c.n, 2):
            G = posebin.globals_at(sk, c, fr)
            P = sk.skin(P0, infl, w, G)
            a, n = areas_normals(P)
            # normal carried by the dominant joint of the triangle's first vertex
            j = dom[T[:, 0]]
            Mj = np.einsum('nij,njk->nik', G[sk.infl[j]][:, :3, :3] if hasattr(sk, 'infl') else G[j][:, :3, :3], np.linalg.inv(B[sk.infl[j]][:, :3, :3]))
            nc = np.einsum('nij,nj->ni', Mj, n0)
            fold = ok & ((n * nc).sum(1) < -0.5)
            col = ok & (a / np.maximum(a0, 1e-9) < 0.3)
            blow = ok & (a / np.maximum(a0, 1e-9) > 2.5)
            for r in ('leg', 'arm', 'hand', 'torso', 'head'):
                m = treg == r
                score = int(fold[m].sum() * 3 + col[m].sum() + blow[m].sum())
                if score > worst.get(r, (0,))[0]:
                    worst[r] = (score, fr, int(fold[m].sum()), int(col[m].sum()), int(blow[m].sum()))
        res.append((v['name'] or k, v['anm'], worst))
    json.dump(res, open(f'{SP}/anim_check_mesh.json', 'w'))
    for name, anm, wst in sorted(res, key=lambda r: -max([x[0] for x in r[2].values()] + [0]))[:30]:
        print(f'{name:22s} {anm} ' + '  '.join(f'{r}:{v[0]}@{v[1]}(f{v[2]} c{v[3]} b{v[4]})' for r, v in wst.items() if v[0] > 0))

if __name__ == '__main__':
    run_twist() if sys.argv[1] == 'twist' else run_mesh()
