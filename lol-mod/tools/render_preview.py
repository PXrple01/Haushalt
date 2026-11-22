"""Tiny software rasterizer to preview a .skn in bind pose (for checking the football beads)."""
import sys
import numpy as np
from PIL import Image
import lolskn


def render(skn_path, textures, out, size=(900, 1100), yaw_deg=35, pitch_deg=12, hidden=(), fixed=None):
    s = lolskn.read(skn_path)
    W, H = size
    img = np.zeros((H, W, 3)); img[:] = (0.07, 0.07, 0.11)
    zbuf = np.full((H, W), -1e9)
    yaw, pitch = np.radians(yaw_deg), np.radians(pitch_deg)
    Ry = np.array([[np.cos(yaw), 0, np.sin(yaw)], [0, 1, 0], [-np.sin(yaw), 0, np.cos(yaw)]])
    Rx = np.array([[1, 0, 0], [0, np.cos(pitch), -np.sin(pitch)], [0, np.sin(pitch), np.cos(pitch)]])
    R = Rx @ Ry
    pos = s.verts['pos'] @ R.T
    nrm = s.verts['nrm'] @ R.T
    shown = [m for m in s.submeshes if m['name'] not in hidden]
    allp = np.concatenate([pos[m['vstart']:m['vstart'] + m['vcount']] for m in shown])
    mn, mx = allp.min(0), allp.max(0)
    if fixed:                       # (scale, center_x_units, center_y_units)
        scale, ccx, ccy = fixed
    else:
        scale = min((W * 0.9) / (mx[0] - mn[0]), (H * 0.9) / (mx[1] - mn[1]))
        ccx, ccy = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2
    sx = (pos[:, 0] - ccx) * scale + W / 2
    sy = H / 2 - (pos[:, 1] - ccy) * scale
    light = np.array([-0.4, 0.6, 0.7]); light /= np.linalg.norm(light)
    for m in shown:
        tex = textures.get(m['name'], textures['default'])
        th, tw = tex.shape[:2]
        idx = s.indices[m['istart']:m['istart'] + m['icount']].reshape(-1, 3)
        for a, b, c in idx:
            xs = np.array([sx[a], sx[b], sx[c]]); ys = np.array([sy[a], sy[b], sy[c]])
            x0, x1 = int(max(0, xs.min())), int(min(W - 1, xs.max() + 1))
            y0, y1 = int(max(0, ys.min())), int(min(H - 1, ys.max() + 1))
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-9:
                continue
            w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
            w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            z = w0 * pos[a, 2] + w1 * pos[b, 2] + w2 * pos[c, 2]
            zb = zbuf[y0:y1 + 1, x0:x1 + 1]
            vis = inside & (z > zb)
            if not vis.any():
                continue
            uv = (w0[..., None] * s.verts['uv'][a] + w1[..., None] * s.verts['uv'][b] + w2[..., None] * s.verts['uv'][c])
            u = np.clip((uv[..., 0] % 1.0) * (tw - 1), 0, tw - 1).astype(int)
            v = np.clip((uv[..., 1] % 1.0) * (th - 1), 0, th - 1).astype(int)
            col = tex[v, u, :3]
            n = w0[..., None] * nrm[a] + w1[..., None] * nrm[b] + w2[..., None] * nrm[c]
            n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-9
            shade = 0.55 + 0.45 * np.clip(n @ light, 0, 1)
            rim = np.clip(1 - np.abs(n[..., 2]), 0, 1) ** 3
            col = col * shade[..., None] + rim[..., None] * np.array([0.3, 1.0, 0.5]) * 0.5
            region = img[y0:y1 + 1, x0:x1 + 1]
            region[vis] = col[vis]
            zb[vis] = z[vis]
    if out:
        Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)

    def project(p):
        q = np.asarray(p, float) @ R.T
        return (q[..., 0] - ccx) * scale + W / 2, H / 2 - (q[..., 1] - ccy) * scale
    return img, project, scale


if __name__ == '__main__':
    skn, body_tx, ball_tx, out = sys.argv[1:5]
    body = np.asarray(Image.open(body_tx).convert('RGBA')).astype(float) / 255
    ball = np.asarray(Image.open(ball_tx).convert('RGBA')).astype(float) / 255
    tex = {'default': body}
    for i in range(1, 9):
        tex[f'Bead_{i}'] = ball
    render(skn, tex, out, hidden=('Dragon_Head', 'Tail'))
