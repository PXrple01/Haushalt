"""Joint data of a League skeleton (.skl): bind matrices, positions, hierarchy, influence table."""
import json
import sys

import numpy as np
import pyritofile


def quat_mat(q):
    x, y, z, w = q.x, q.y, q.z, q.w
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def trs(t, q, s):
    M = np.eye(4)
    M[:3, :3] = quat_mat(q) * np.array([s.x, s.y, s.z])
    M[:3, 3] = [t.x, t.y, t.z]
    return M


def load(path):
    skl = pyritofile.read_skl(path)
    joints = []
    for j in skl.joints:
        ib = trs(j.ibind_translate, j.ibind_rotate, j.ibind_scale)
        bind = np.linalg.inv(ib)
        joints.append(dict(name=j.name, parent=j.parent, bind=bind.tolist(), pos=bind[:3, 3].tolist(), ibind=ib.tolist()))
    return dict(joints=joints, influences=list(skl.influences))


if __name__ == '__main__':
    d = load(sys.argv[1])
    json.dump(d, open(sys.argv[2], 'w'))
    by = {j['name']: i for i, j in enumerate(d['joints'])}
    for n in ['L_Hip', 'L_KneeUpper', 'L_KneeLower', 'L_Foot', 'L_Toe', 'L_Shoulder', 'L_Elbow', 'L_Hand', 'L_Hand_Twist',
              'L_Elbow_Scale', 'L_Shoulder_Scale', 'Breathe', 'Neck', 'Head', 'Jaw', 'Pelvis', 'Spine1', 'Chest', 'L_Clavicle',
              'L_Hip_Snap', 'L_Front_Hip_Helper', 'L_Side_Hip_Helper', 'L_Thumb1', 'L_Index1']:
        j = d['joints'][by[n]]
        p = d['joints'][j['parent']]['name'] if j['parent'] >= 0 else None
        print(f"{n:22s} parent={p:18s} pos={np.round(j['pos'], 1)} infl={by[n] in d['influences']}")
