"""Helpers for textures (.tex), static meshes (.scb) and the Flow color palette."""
import colorsys
import struct

import numpy as np
from PIL import Image

# ------------------------------------------------------------------ palette
# Flow green: every colored value is pushed into deep emerald (140-155 deg)
# or bright green (115-135 deg). Neutral greys/whites stay neutral so cores keep their punch.
def flow_hue(h_deg):
    if 150 <= h_deg < 248:          # cyan / blue family -> deep emerald
        return 140 + (h_deg - 150) / 98 * 15
    if 248 <= h_deg < 345:          # purple / magenta family -> bright green
        return 115 + (h_deg - 248) / 97 * 20
    return 125                      # warm colors -> green accent


def flow_rgb(r, g, b):
    mx = max(r, g, b)
    scale = mx if mx > 1.0 else 1.0           # keep HDR intensity
    r, g, b = r / scale, g / scale, b / scale
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    w = _smoothstep(0.04, 0.22, s)        # 0 = neutral (kept), 1 = fully remapped
    h2 = flow_hue(h * 360) / 360
    s2 = min(1.0, s * 1.25 + 0.10)
    v2 = v * 0.90
    r2, g2, b2 = colorsys.hsv_to_rgb(h2, s2, v2)
    mix = lambda a, b_: a * (1 - w) + b_ * w
    return mix(r, r2) * scale, mix(g, g2) * scale, mix(b, b2) * scale


def _smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def flow_rgba(c):
    r, g, b = flow_rgb(*c[:3])
    return (r, g, b) + tuple(c[3:])


def flow_image(im: Image.Image) -> Image.Image:
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255
    rgb = a[..., :3]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    # vectorised hsv
    hsv = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).convert('HSV')).astype(np.float32)
    h = hsv[..., 0] / 255 * 360
    h2 = np.where((h >= 150) & (h < 248), 140 + (h - 150) / 98 * 15,
         np.where((h >= 248) & (h < 345), 115 + (h - 248) / 97 * 20, 125))
    s2 = np.clip(s * 1.25 + 0.10, 0, 1)
    v2 = mx * 0.90
    out = np.stack([h2 / 360 * 255, s2 * 255, v2 * 255], -1).astype(np.uint8)
    rgb2 = np.asarray(Image.fromarray(out, 'HSV').convert('RGB')).astype(np.float32) / 255
    t = np.clip((s - 0.04) / (0.22 - 0.04), 0, 1)
    w = (t * t * (3 - 2 * t))[..., None]
    rgb_final = rgb * (1 - w) + rgb2 * w
    res = np.concatenate([rgb_final, a[..., 3:]], -1)
    return Image.fromarray((np.clip(res, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


# ------------------------------------------------------------------ .tex
TEX_BGRA8 = 20


def write_tex(im: Image.Image, path, mipmaps=True):
    """Uncompressed BGRA8 .tex (with mip chain stored smallest first)."""
    im = im.convert('RGBA')
    w, h = im.size
    levels = [im]
    if mipmaps:
        cw, ch = w, h
        while cw > 1 or ch > 1:
            cw, ch = max(1, cw // 2), max(1, ch // 2)
            levels.append(im.resize((cw, ch), Image.LANCZOS))
    data = b''
    for lv in reversed(levels):
        arr = np.asarray(lv)
        data += arr[..., [2, 1, 0, 3]].tobytes()
    head = struct.pack('<IHHBBBB', 0x00584554, w, h, 1, TEX_BGRA8, 0, 1 if mipmaps else 0)
    with open(path, 'wb') as f:
        f.write(head + data)


def read_tex_bgra8(path):
    d = open(path, 'rb').read()
    _, w, h, _, fmt, _, mip = struct.unpack_from('<IHHBBBB', d, 0)
    assert fmt == TEX_BGRA8
    top = d[-w * h * 4:]
    arr = np.frombuffer(top, np.uint8).reshape(h, w, 4)[..., [2, 1, 0, 3]]
    return Image.fromarray(arr.copy(), 'RGBA')


# ------------------------------------------------------------------ .scb
def write_scb(path, name, positions, indices, uvs, material='lambert1', colors=None):
    """Static mesh, binary .scb v3.2 (positions per vertex, uvs per face corner)."""
    positions = np.asarray(positions, np.float32)
    indices = np.asarray(indices, np.uint32).reshape(-1, 3)
    uvs = np.asarray(uvs, np.float32).reshape(-1, 3, 2)
    flags = 0
    out = bytearray()
    out += b'r3d2Mesh'
    out += struct.pack('<HH', 3, 2)
    out += name.encode('ascii')[:128].ljust(128, b'\0')
    out += struct.pack('<III', len(positions), len(indices), flags)
    mn, mx = positions.min(0), positions.max(0)
    out += struct.pack('<6f', *mn, *mx)
    out += struct.pack('<I', 1 if colors is not None else 0)  # vertex type: 1 = has vertex colors
    out += positions.tobytes()
    if colors is not None:
        out += np.asarray(colors, np.uint8).reshape(-1, 4).tobytes()  # BGRA
    central = (mn + mx) / 2
    out += struct.pack('<3f', *central)
    mat = material.encode('ascii')[:64].ljust(64, b'\0')
    for tri, uv in zip(indices, uvs):
        out += struct.pack('<3I', *tri)
        out += mat
        out += struct.pack('<6f', uv[0][0], uv[1][0], uv[2][0], uv[0][1], uv[1][1], uv[2][1])
    with open(path, 'wb') as f:
        f.write(out)
