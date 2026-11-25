"""DXT1 (BC1) / DXT5 (BC3) encoder + decoder in numpy and League .tex writer/reader.

Riot ships every texture of the champion as DXT1/DXT5 (format 10/12), so the mod does the same:
opaque images -> DXT1, images with alpha -> DXT5; mip chain stored smallest level first (like Riot).
Encoder: per 4x4 block the colour endpoints lie on the principal axis of the block's colours (inset by
1/16 of the range, as in stb_dxt), every texel takes the nearest of the 4 palette colours; alpha uses the
8-value BC4 ramp between the block's min and max.
"""
import struct

import numpy as np
from PIL import Image

TEX_MAGIC = 0x00584554
DXT1, DXT5, BGRA8 = 10, 12, 20


def _blocks(a):
    """HxWxC uint8 -> (by, bx, 16, C) float32, padded to a multiple of 4 by repeating the edge."""
    h, w = a.shape[:2]
    H, W = (h + 3) // 4 * 4, (w + 3) // 4 * 4
    if (H, W) != (h, w):
        a = np.pad(a, ((0, H - h), (0, W - w), (0, 0)), mode='edge')
    b = a.reshape(H // 4, 4, W // 4, 4, -1).transpose(0, 2, 1, 3, 4).reshape(H // 4, W // 4, 16, -1)
    return b.astype(np.float32)


def _to565(c):
    c = np.clip(np.rint(c), 0, 255)
    return ((np.rint(c[..., 0] * 31 / 255).astype(np.uint32) << 11) | (np.rint(c[..., 1] * 63 / 255).astype(np.uint32) << 5)
            | np.rint(c[..., 2] * 31 / 255).astype(np.uint32))


def _from565(v):
    v = v.astype(np.uint32)
    r, g, b = (v >> 11) & 31, (v >> 5) & 63, v & 31
    return np.stack([(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)], -1).astype(np.float32)


def _color_block(px):
    """px (n,16,3) float -> (n,) uint64 BC1 colour blocks (always 4-colour mode)."""
    mean = px.mean(1)
    c = px - mean[:, None]
    cov = np.einsum('nki,nkj->nij', c, c)
    v = np.ones((len(px), 3), np.float32) / np.sqrt(3)
    for _ in range(8):
        v = np.einsum('nij,nj->ni', cov, v)
        nrm = np.linalg.norm(v, axis=1, keepdims=True)
        v = np.where(nrm > 1e-6, v / np.maximum(nrm, 1e-12), np.array([0.577, 0.577, 0.577], np.float32))
    proj = np.einsum('nki,ni->nk', c, v)
    mn, mx = proj.min(1), proj.max(1)
    inset = (mx - mn) / 16
    e0 = np.clip(mean + v * (mx - inset)[:, None], 0, 255)
    e1 = np.clip(mean + v * (mn + inset)[:, None], 0, 255)
    c0, c1 = _to565(e0), _to565(e1)
    swap = c0 < c1
    c0, c1 = np.where(swap, c1, c0), np.where(swap, c0, c1)
    p0, p1 = _from565(c0), _from565(c1)
    pal = np.stack([p0, p1, (2 * p0 + p1) / 3, (p0 + 2 * p1) / 3], 1)          # (n,4,3)
    d = ((px[:, :, None, :] - pal[:, None, :, :]) ** 2).sum(-1)               # (n,16,4)
    idx = d.argmin(-1).astype(np.uint64)
    idx[c0 == c1] = 0                                                         # equal endpoints: 3-colour mode, stay on c0
    bits = (idx << (2 * np.arange(16, dtype=np.uint64))).sum(1)
    return c0.astype(np.uint64) | (c1.astype(np.uint64) << 16) | (bits << 32)


def _alpha_block(al):
    """al (n,16) float -> (n,) uint64 BC4/BC3 alpha blocks (8-value mode)."""
    a0 = al.max(1).round(); a1 = al.min(1).round()
    t = np.arange(8, dtype=np.float32)
    ramp = np.where(t[None] == 0, a0[:, None], np.where(t[None] == 1, a1[:, None],
                    ((8 - t[None]) * a0[:, None] + (t[None] - 1) * a1[:, None]) / 7))
    idx = np.abs(al[:, :, None] - ramp[:, None, :]).argmin(-1).astype(np.uint64)
    idx[a0 == a1] = 0
    bits = (idx << (3 * np.arange(16, dtype=np.uint64))).sum(1)
    return a0.astype(np.uint64) | (a1.astype(np.uint64) << 8) | (bits << 16)


def encode(rgba, fmt):
    """uint8 HxWx4 -> DXT1/DXT5 bytes for one mip level."""
    b = _blocks(rgba)
    by, bx = b.shape[:2]
    flat = b.reshape(-1, 16, 4)
    col = _color_block(flat[..., :3])
    if fmt == DXT1:
        return col.astype('<u8').tobytes()
    alpha = _alpha_block(flat[..., 3])
    out = np.empty((len(col), 2), '<u8'); out[:, 0] = alpha; out[:, 1] = col
    return out.tobytes()


def decode(data, w, h, fmt):
    """DXT1/DXT5 bytes of one level -> uint8 HxWx4."""
    bx, by = max(1, (w + 3) // 4), max(1, (h + 3) // 4)
    n = bx * by
    if fmt == DXT1:
        col = np.frombuffer(data, '<u8', n); alpha = None
    else:
        q = np.frombuffer(data, '<u8', 2 * n).reshape(n, 2); alpha, col = q[:, 0], q[:, 1]
    c0, c1 = (col & 0xFFFF), ((col >> 16) & 0xFFFF)
    p0, p1 = _from565(c0), _from565(c1)
    four = (c0 > c1) | (fmt == DXT5)
    pal = np.stack([p0, p1, np.where(four[:, None], (2 * p0 + p1) / 3, (p0 + p1) / 2),
                    np.where(four[:, None], (p0 + 2 * p1) / 3, 0)], 1)
    idx = ((col >> 32)[:, None] >> (2 * np.arange(16, dtype=np.uint64))) & 3
    rgb = np.take_along_axis(pal, idx[..., None].astype(np.int64).repeat(3, -1), 1)
    a = np.full((n, 16), 255.0)
    if alpha is not None:
        a0 = (alpha & 0xFF).astype(np.float32); a1 = ((alpha >> 8) & 0xFF).astype(np.float32)
        t = np.arange(8, dtype=np.float32)
        eight = a0 > a1
        ramp = np.where(eight[:, None],
                        np.where(t == 0, a0[:, None], np.where(t == 1, a1[:, None], ((8 - t) * a0[:, None] + (t - 1) * a1[:, None]) / 7)),
                        np.where(t == 0, a0[:, None], np.where(t == 1, a1[:, None],
                                 np.where(t < 6, ((6 - t) * a0[:, None] + (t - 1) * a1[:, None]) / 5, np.where(t == 6, 0, 255)))))
        ai = ((alpha >> 16)[:, None] >> (3 * np.arange(16, dtype=np.uint64))) & 7
        a = np.take_along_axis(ramp, ai.astype(np.int64), 1)
    else:
        a = np.where((~four[:, None]) & (idx == 3), 0.0, 255.0)
    px = np.concatenate([rgb, a[..., None]], -1).reshape(by, bx, 4, 4, 4).transpose(0, 2, 1, 3, 4).reshape(by * 4, bx * 4, 4)
    return np.clip(np.rint(px[:h, :w]), 0, 255).astype(np.uint8)


def tex_bytes(im, mipmaps=True, fmt=None):
    """PIL image -> League .tex (DXT1 if opaque, DXT5 with alpha), mip chain smallest first."""
    im = im.convert('RGBA')
    a = np.asarray(im)
    if fmt is None:
        fmt = DXT1 if a[..., 3].min() == 255 else DXT5
    w, h = im.size
    levels = [a]
    if mipmaps:
        cw, ch = w, h
        while cw > 1 or ch > 1:
            cw, ch = max(1, cw // 2), max(1, ch // 2)
            levels.append(np.asarray(im.resize((cw, ch), Image.LANCZOS)))
    data = b''.join(encode(lv, fmt) for lv in reversed(levels))
    return struct.pack('<IHHBBBB', TEX_MAGIC, w, h, 1, fmt, 0, 1 if mipmaps else 0) + data


def read_tex(data):
    """League .tex bytes -> PIL RGBA image of the top mip level (DXT1, DXT5 or BGRA8)."""
    _, w, h, _, fmt, _, flags = struct.unpack_from('<IHHBBBB', data, 0)
    if fmt == BGRA8:
        top = data[len(data) - w * h * 4:]
        return Image.fromarray(np.frombuffer(top, np.uint8).reshape(h, w, 4)[..., [2, 1, 0, 3]].copy(), 'RGBA')
    bsz = 8 if fmt == DXT1 else 16
    size = max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * bsz
    return Image.fromarray(decode(data[len(data) - size:], w, h, fmt), 'RGBA')
