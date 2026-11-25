"""Offline preview of League VFX emitters (approximation, for timing/look iteration).

Supports what this mod authors: camera-facing billboards, ground quads, velocity-stretched
particles, static meshes (.scb), spawn cylinders, random tables, curves (scale/colour), drag,
gravity, spin, delays, emitter lifetimes, alpha/additive blending. It is NOT the game renderer."""
import math

import numpy as np
from PIL import Image

import lolbin as L

H = {n: L.fnv1a(n) for n in [
    'emitterName', 'rate', 'particleLifetime', 'lifetime', 'isSingleParticle', 'timeBeforeFirstEmission', 'bindWeight',
    'EmitterPosition', 'birthScale0', 'scale0', 'birthColor', 'Color', 'birthRotation0', 'birthRotationalVelocity0',
    'birthVelocity', 'worldAcceleration', 'drag', 'SpawnShape', 'radius', 'primitive', 'mMesh', 'mSimpleMeshName',
    'texture', 'blendMode', 'isGroundLayer', 'isDirectionOriented', 'directionVelocityScale', 'isUniformScale',
    'constantValue', 'dynamics', 'times', 'values', 'probabilityTables', 'keyTimes', 'keyValues', 'texDiv', 'numFrames',
    'alphaErosionDefinition', 'erosionDriveCurve', 'erosionMapName', 'reflectionDefinition', 'fresnelColor']}
T_PRIM_MESH = L.fnv1a('VfxPrimitiveMesh')
T_PRIM_QUAD = L.fnv1a('VfxPrimitiveArbitraryQuad')


def mesh_samples(pos, tris, cuv, per_unit2=0.5, cap=60000, seed=3):
    """Dense surface points of a mesh (position, uv, face normal) for point-splat rendering."""
    rng = np.random.default_rng(seed)
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    n = np.cross(b - a, c - a); area = np.linalg.norm(n, axis=1) / 2
    n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
    cnt = np.maximum(1, np.round(area * per_unit2)).astype(int)
    if cnt.sum() > cap:
        cnt = np.maximum(1, np.round(cnt * cap / cnt.sum())).astype(int)
    fi = np.repeat(np.arange(len(tris)), cnt)
    r1, r2 = rng.random(len(fi)), rng.random(len(fi))
    s = np.sqrt(r1); w0, w1, w2 = 1 - s, s * (1 - r2), s * r2
    P = w0[:, None] * a[fi] + w1[:, None] * b[fi] + w2[:, None] * c[fi]
    UV = w0[:, None] * cuv[fi, 0] + w1[:, None] * cuv[fi, 1] + w2[:, None] * cuv[fi, 2]
    return P, UV, n[fi]


def euler(deg):
    x, y, z = np.radians(deg[:3])
    Rx = np.array([[1, 0, 0], [0, np.cos(x), -np.sin(x)], [0, np.sin(x), np.cos(x)]])
    Ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
    Rz = np.array([[np.cos(z), -np.sin(z), 0], [np.sin(z), np.cos(z), 0], [0, 0, 1]])
    return Ry @ Rx @ Rz


def _get(s, name, default=None):
    if s is None:
        return default
    f = s.field(H[name])
    return f.value if f is not None else default


class Value:
    """ValueFloat / ValueVector3 / ValueColor with optional curve and random multipliers."""
    def __init__(self, s, default):
        self.const = np.atleast_1d(np.array(_get(s, 'constantValue', default), float))
        self.times = self.vals = None
        self.rand = None
        dyn = _get(s, 'dynamics')
        if dyn is not None:
            t = _get(dyn, 'times'); v = _get(dyn, 'values')
            if t is not None and v is not None and len(t.items):
                self.times = np.array(t.items, float)
                self.vals = np.array([np.atleast_1d(x) for x in v.items], float)
            pt = _get(dyn, 'probabilityTables')
            if pt is not None:
                self.rand = []
                for tab in pt.items:
                    kv = _get(tab, 'keyValues')
                    self.rand.append(None if kv is None else (kv.items[0], kv.items[-1]))

    def sample_birth(self, rng):
        base = self.const.copy() if self.times is None or len(self.times) == 1 and self.vals is not None and False else self.const.copy()
        if self.times is not None and len(self.times) == 1:
            base = self.vals[0].copy()
        if self.rand:
            for i, r in enumerate(self.rand[:len(base)]):
                if r is not None:
                    base[i] *= rng.uniform(r[0], r[1])
        return base

    def at(self, t):
        if self.times is None or len(self.times) < 2:
            return self.const if self.times is None else self.vals[0]
        return np.array([np.interp(t, self.times, self.vals[:, k]) for k in range(self.vals.shape[1])])


class Emitter:
    def __init__(self, em, textures, meshes):
        self.name = _get(em, 'emitterName', '?')
        self.rate = Value(_get(em, 'rate'), 0.0).const[0]
        self.plife = Value(_get(em, 'particleLifetime'), 1.0)
        lt = _get(em, 'lifetime'); self.elife = (lt.value if isinstance(lt, L.Option) and lt.value is not None else None)
        self.single = bool(_get(em, 'isSingleParticle', 0))
        self.delay = _get(em, 'timeBeforeFirstEmission', 0.0) or 0.0
        self.bind = Value(_get(em, 'bindWeight'), 1.0).const[0] if _get(em, 'bindWeight') is not None else 0.0
        self.pos = Value(_get(em, 'EmitterPosition'), (0, 0, 0))
        self.bscale = Value(_get(em, 'birthScale0'), (1, 1, 1))
        self.scale = Value(_get(em, 'scale0'), (1, 1, 1))
        self.bcol = Value(_get(em, 'birthColor'), (1, 1, 1, 1))
        self.col = Value(_get(em, 'Color'), (1, 1, 1, 1))
        self.brot = Value(_get(em, 'birthRotation0'), (0, 0, 0))
        self.spin = Value(_get(em, 'birthRotationalVelocity0'), (0, 0, 0))
        self.vel = Value(_get(em, 'birthVelocity'), (0, 0, 0))
        self.acc = Value(_get(em, 'worldAcceleration'), (0, 0, 0))
        self.drag = Value(_get(em, 'drag'), (0, 0, 0))
        sh = _get(em, 'SpawnShape'); self.spawn_r = _get(sh, 'radius', 0.0) if sh is not None else 0.0
        self.blend = _get(em, 'blendMode', 1)
        self.ground = bool(_get(em, 'isGroundLayer', 0))
        self.dir = bool(_get(em, 'isDirectionOriented', 0)); self.dscale = _get(em, 'directionVelocityScale', 0.0) or 0.0
        self.uniform = bool(_get(em, 'isUniformScale', 0))
        prim = _get(em, 'primitive'); self.mesh = None
        self.flat = isinstance(prim, L.Struct) and prim.type_hash == T_PRIM_QUAD and not self.ground
        if isinstance(prim, L.Struct) and prim.type_hash == T_PRIM_MESH:
            mm = _get(prim, 'mMesh'); self.mesh = meshes.get((_get(mm, 'mSimpleMeshName') or '').lower())
        ero = _get(em, 'alphaErosionDefinition'); self.erosion = None
        if isinstance(ero, L.Struct):
            emap = textures.get((_get(ero, 'erosionMapName') or '').lower())
            if emap is not None:
                self.erosion = (Value(_get(ero, 'erosionDriveCurve'), 0.0), np.asarray(emap.convert('L')).astype(float) / 255)
        refl = _get(em, 'reflectionDefinition')
        self.fresnel = np.array(_get(refl, 'fresnelColor')[:3]) if isinstance(refl, L.Struct) and _get(refl, 'fresnelColor') else None
        tex = (_get(em, 'texture') or '').lower()
        self.tex = textures.get(tex)
        self.particles = []
        self.emitted = 0.0

    def spawn(self, t, rng, origin):
        life = float(self.plife.sample_birth(rng)[0])
        if life <= 0:
            life = 99.0
        off = np.zeros(3)
        if self.spawn_r:
            a = rng.uniform(0, 2 * np.pi); rr = self.spawn_r * math.sqrt(rng.uniform(0, 1))
            off = np.array([math.cos(a) * rr, 0, math.sin(a) * rr])
        p = dict(t0=t, life=life, pos=origin + self.pos.const[:3] + off, vel=self.vel.sample_birth(rng)[:3].astype(float),
                 bscale=self.bscale.sample_birth(rng), bcol=self.bcol.sample_birth(rng), rot=self.brot.sample_birth(rng),
                 spin=self.spin.sample_birth(rng))
        self.particles.append(p)

    def step(self, t, dt, rng, origin):
        start = self.delay
        if t >= start:
            end = start + (self.elife if self.elife is not None else 1e9)
            if self.single:
                if self.emitted < 1 and t >= start:
                    self.spawn(t, rng, origin); self.emitted = 1
            elif t < end:
                self.emitted += self.rate * dt
                while self.emitted >= 1:
                    self.spawn(t, rng, origin); self.emitted -= 1
        acc = self.acc.const[:3]; drag = self.drag.const[:3]
        alive = []
        for p in self.particles:
            age = t - p['t0']
            if age > p['life']:
                continue
            p['vel'] = p['vel'] + acc * dt
            p['vel'] = p['vel'] * np.exp(-drag * dt)
            p['pos'] = p['pos'] + p['vel'] * dt
            alive.append(p)
        self.particles = alive


class Camera:
    def __init__(self, W, H, target, dist=900.0, pitch=56.0, yaw=0.0, fov=32.0):
        self.W, self.H = W, H
        pr, yr = math.radians(pitch), math.radians(yaw)
        fwd = np.array([math.sin(yr) * math.cos(pr) * -1, -math.sin(pr), -math.cos(yr) * math.cos(pr)])
        self.eye = np.asarray(target, float) - fwd * dist
        self.fwd = fwd / np.linalg.norm(fwd)
        self.right = np.cross(self.fwd, np.array([0, 1.0, 0])); self.right /= np.linalg.norm(self.right)
        self.up = np.cross(self.right, self.fwd)
        self.f = (H / 2) / math.tan(math.radians(fov) / 2)

    def project(self, p):
        q = np.asarray(p, float) - self.eye
        z = q @ self.fwd
        return np.stack([self.W / 2 + (q @ self.right) * self.f / z * -1 * -1, self.H / 2 - (q @ self.up) * self.f / z], -1), z


def _sprite(img, rgba, size_px, angle, stretch=None):
    tex = img
    w = max(2, int(size_px[0])); h = max(2, int(size_px[1]))
    im = tex.resize((w, h), Image.BILINEAR)
    if angle:
        im = im.rotate(angle, resample=Image.BILINEAR, expand=True)
    a = np.asarray(im).astype(np.float32) / 255
    a[..., :3] *= rgba[:3]; a[..., 3] *= rgba[3]
    return a


def composite(canvas, spr, cx, cy, additive):
    h, w = spr.shape[:2]
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    H_, W_ = canvas.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W_, x0 + w), min(H_, y0 + h)
    if xa >= xb or ya >= yb:
        return
    s = spr[ya - y0:yb - y0, xa - x0:xb - x0]
    reg = canvas[ya:yb, xa:xb]
    if additive:
        reg += s[..., :3] * s[..., 3:4]
    else:
        reg[:] = reg * (1 - s[..., 3:4]) + s[..., :3] * s[..., 3:4]


def render_mesh(canvas, e, p, age, t, cam):
    """Point-splat a mesh particle: texture alpha x colour, alpha erosion, fresnel rim, additive or alpha."""
    P0, UV, N0 = e.mesh
    sc = p['bscale'][:3] * e.scale.at(age)[:3]
    col = p['bcol'][:4] * e.col.at(age)[:4]
    R = euler(p['rot'][:3] + p['spin'][:3] * (t - p['t0']))
    Pw = (P0 * sc) @ R.T + p['pos']
    Nw = (N0 / np.where(sc == 0, 1, sc)) @ R.T; Nw /= np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-9
    scr, z = cam.project(Pw)
    ok = z > 1
    th, tw = e.tex.shape[:2] if isinstance(e.tex, np.ndarray) else (e.tex.size[1], e.tex.size[0])
    tex = e._texarr if hasattr(e, '_texarr') else np.asarray(e.tex.convert('RGBA')).astype(float) / 255
    e._texarr = tex
    u = np.clip((UV[:, 0] % 1.0) * (tw - 1), 0, tw - 1).astype(int); v = np.clip((UV[:, 1] % 1.0) * (th - 1), 0, th - 1).astype(int)
    texel = tex[v, u]
    inten = texel[:, 3] * col[3]
    rgb = texel[:, :3] * col[:3]
    mask = np.ones(len(P0))
    if e.erosion is not None:
        drive = float(e.erosion[0].at(age)[0]); em = e.erosion[1]
        mv = em[np.clip((UV[:, 1] % 1) * (em.shape[0] - 1), 0, em.shape[0] - 1).astype(int),
                np.clip((UV[:, 0] % 1) * (em.shape[1] - 1), 0, em.shape[1] - 1).astype(int)]
        mask = np.clip((mv - drive) / 0.04 + 0.5, 0, 1)
    out = rgb * inten[:, None]
    if e.fresnel is not None:
        view = cam.eye - Pw; view /= np.linalg.norm(view, axis=1, keepdims=True) + 1e-9
        rim = (1 - np.abs((Nw * view).sum(1))) ** 2.2
        out = out + e.fresnel[None] * rim[:, None] * min(1.0, col[3] * 1.4)
    out *= mask[:, None]
    H, W = canvas.shape[:2]
    xi = np.round(scr[:, 0]).astype(int); yi = np.round(scr[:, 1]).astype(int)
    ok &= (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H) & (mask > 0.01)
    layer = np.zeros((H, W, 3))
    idx = yi[ok] * W + xi[ok]
    for k in range(3):
        flat = layer[..., k].reshape(-1)
        np.maximum.at(flat, idx, out[ok, k])
    if e.blend == 4:
        canvas += layer
    else:
        a = np.clip(layer.max(-1, keepdims=True) * 1.5, 0, 1)
        canvas[:] = canvas * (1 - a) + layer * a


def render_frame(emitters, cam, t, background):
    canvas = background.copy()
    items = []
    for e in emitters:
        for p in e.particles:
            age = (t - p['t0']) / p['life']
            items.append((e, p, age))
    def depth(it):
        return (it[0].ground is False, -float(cam.project(it[1]['pos'])[1]))
    items.sort(key=depth)
    for e, p, age in items:
        if e.tex is None:
            continue
        if e.mesh is not None:
            render_mesh(canvas, e, p, age, t, cam)
            continue
        sc = p['bscale'][:3] * e.scale.at(age)[:3]
        col = p['bcol'][:4] * e.col.at(age)[:4]
        if col[3] <= 0.003:
            continue
        (sx, sy), z = cam.project(p['pos'])
        if z <= 1:
            continue
        px_per_unit = cam.f / z
        if e.ground or e.flat:
            w = 2 * sc[0] * px_per_unit; h = w * abs(math.sin(math.radians(56)))
            spr = _sprite(e.tex, col, (w, h), 0)
        else:
            w = 2 * sc[0] * px_per_unit
            h = w if (e.uniform or sc[1] == 0) else 2 * sc[1] * px_per_unit
            ang = p['rot'][0] + p['spin'][0] * (t - p['t0'])
            if e.dir and np.linalg.norm(p['vel']) > 1:
                v2, _ = cam.project(p['pos'] + p['vel'] * 0.01)
                d = v2 - np.array([sx, sy]); ang = -math.degrees(math.atan2(d[1], d[0])) + 90
                h = max(h, np.linalg.norm(p['vel']) * e.dscale * 2 * sc[0] * px_per_unit + h)
            spr = _sprite(e.tex, col, (w, h), ang)
        composite(canvas, spr, sx, sy, e.blend == 4)
    return np.clip(canvas, 0, 1)
