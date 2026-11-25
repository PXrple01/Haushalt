"""Small builder API for League VFX structures on top of lolbin."""
import copy

import lolbin as L

F = L.Field


# ---------------------------------------------------------------- values
def _ptable(lo_hi):
    if lo_hi is None:
        return L.Struct('VfxProbabilityTableData', [], L.STRUCT)
    lo, hi = lo_hi
    return L.Struct('VfxProbabilityTableData', [
        F('keyTimes', L.LIST, L.List(L.F32, [0.0, 1.0])),
        F('keyValues', L.LIST, L.List(L.F32, [float(lo), float(hi)]))], L.STRUCT)


def vfloat(c, times=None, values=None, rand=None):
    fields = [F('constantValue', L.F32, float(c))]
    if times is not None or rand is not None:
        dyn = []
        if rand is not None:
            dyn.append(F('probabilityTables', L.LIST, L.List(L.STRUCT, [_ptable(rand)])))
        dyn.append(F('times', L.LIST, L.List(L.F32, [float(t) for t in (times or [0.0])])))
        dyn.append(F('values', L.LIST, L.List(L.F32, [float(v) for v in (values or [c])])))
        fields.append(F('dynamics', L.STRUCT, L.Struct('VfxAnimatedFloatVariableData', dyn, L.STRUCT)))
    return L.Struct('ValueFloat', fields, L.EMBED)


def _vec(kind, vt, anim, c, times=None, values=None, rand=None):
    fields = [F('constantValue', vt, tuple(float(x) for x in c))]
    if times is not None or rand is not None:
        dyn = []
        if rand is not None:
            dyn.append(F('probabilityTables', L.LIST, L.List(L.STRUCT, [_ptable(r) for r in rand])))
        dyn.append(F('times', L.LIST, L.List(L.F32, [float(t) for t in (times or [0.0])])))
        dyn.append(F('values', L.LIST, L.List(vt, [tuple(float(x) for x in v) for v in (values or [c])])))
        fields.append(F('dynamics', L.STRUCT, L.Struct(anim, dyn, L.STRUCT)))
    return L.Struct(kind, fields, L.EMBED)


def vvec3(c, times=None, values=None, rand=None):
    return _vec('ValueVector3', L.VEC3, 'VfxAnimatedVector3fVariableData', c, times, values, rand)


def ivec3(c, times=None, values=None, rand=None):
    return _vec('IntegratedValueVector3', L.VEC3, 'VfxAnimatedVector3fVariableData', c, times, values, rand)


def vvec2(c, times=None, values=None, rand=None):
    return _vec('ValueVector2', L.VEC2, 'VfxAnimatedVector2fVariableData', c, times, values, rand)


def vcolor(c, times=None, values=None):
    return _vec('ValueColor', L.VEC4, 'VfxAnimatedColorVariableData', c, times, values)


# ---------------------------------------------------------------- emitters
def emitter(name, texture, *, blend=4, life=1.0, rate=1.0, single=True, emitter_life=None, delay=0.0,
            bind=1.0, pos=(0, 0, 0), scale=(50, 50, 1), scale_curve=None, uniform=True,
            color=(1, 1, 1, 1), color_curve=None, rotation=None, spin=None, velocity=None,
            accel=None, drag=None, spawn_radius=None, mesh=None, ground=False, pass_=100,
            direction_oriented=False, dir_scale=None, local_orientation=False, importance=3,
            backface=False, extra=None, primitive=None):
    """Builds a complete VfxEmitterDefinitionData. Curves: (times, values) over the particle's life."""
    f = [F('emitterName', L.STRING, name),
         F('rate', L.EMBED, vfloat(rate)),
         F('particleLifetime', L.EMBED, vfloat(life)),
         F('lifetime', L.OPTION, L.Option(L.F32, float(emitter_life if emitter_life is not None else (0.1 if single else life)))),
         F('importance', L.U8, importance),
         F('bindWeight', L.EMBED, vfloat(bind)),
         F('blendMode', L.U8, blend),
         F('pass', L.S16, pass_),
         F('miscRenderFlags', L.U8, 1),
         F('alphaRef', L.U8, 0),
         F('texture', L.STRING, texture),
         F('birthColor', L.EMBED, vcolor(color)),
         F('isUniformScale', L.FLAG, 1 if uniform else 0),
         F('isRotationEnabled', L.FLAG, 1)]
    if single:
        f.append(F('isSingleParticle', L.FLAG, 1))
    if delay:
        f.append(F('timeBeforeFirstEmission', L.F32, float(delay)))
    if any(pos):
        f.append(F('EmitterPosition', L.EMBED, vvec3(pos)))
    if isinstance(scale, L.Struct):
        f.append(F('birthScale0', L.EMBED, scale))
    else:
        f.append(F('birthScale0', L.EMBED, vvec3(scale)))
    if scale_curve:
        t, v = scale_curve
        f.append(F('scale0', L.EMBED, vvec3(v[0], t, v)))
    if color_curve:
        t, v = color_curve
        f.append(F('Color', L.EMBED, vcolor(v[0], t, v)))
    if rotation is not None:
        f.append(F('birthRotation0', L.EMBED, rotation if isinstance(rotation, L.Struct) else vvec3(rotation)))
    if spin is not None:
        f.append(F('birthRotationalVelocity0', L.EMBED, spin if isinstance(spin, L.Struct) else vvec3(spin)))
    if velocity is not None:
        f.append(F('birthVelocity', L.EMBED, velocity if isinstance(velocity, L.Struct) else vvec3(velocity)))
    if accel is not None:
        f.append(F('worldAcceleration', L.EMBED, ivec3(accel)))
    if drag is not None:
        f.append(F('drag', L.EMBED, vvec3(drag)))
    if spawn_radius:
        f.append(F('SpawnShape', L.STRUCT, L.Struct('VfxShapeCylinder', [F('radius', L.F32, float(spawn_radius))], L.STRUCT)))
    if primitive is not None:
        f.append(F('primitive', L.STRUCT, primitive))
    if mesh:
        f.append(F('primitive', L.STRUCT, L.Struct('VfxPrimitiveMesh', [
            F('mMesh', L.EMBED, L.Struct('VfxMeshDefinitionData', [F('mSimpleMeshName', L.STRING, mesh)], L.EMBED))], L.STRUCT)))
    if ground:
        f += [F('isGroundLayer', L.FLAG, 1), F('isFollowingTerrain', L.FLAG, 1),
              F('depthBiasFactors', L.VEC2, (-1.0, -50.0)), F('disableBackfaceCull', L.BOOL, True),
              F('primitive', L.STRUCT, L.Struct('VfxPrimitiveArbitraryQuad', [], L.STRUCT))]
    if direction_oriented:
        f.append(F('isDirectionOriented', L.FLAG, 1))
        if dir_scale is not None:
            f.append(F('directionVelocityScale', L.F32, float(dir_scale)))
    if local_orientation:
        f.append(F('isLocalOrientation', L.FLAG, 1))
    if backface and not ground:
        f.append(F('disableBackfaceCull', L.BOOL, True))
    if extra:
        f += extra
    return L.Struct('VfxEmitterDefinitionData', f, L.STRUCT)


# ---------------------------------------------------------------- systems
def system_entry(b, path):
    e = b.entry(path)
    return e.struct if e else None


def emitters_of(sysstruct):
    f = sysstruct.field('complexEmitterDefinitionData')
    return f.value.items if f else []


def find_emitter(sysstruct, name):
    for em in emitters_of(sysstruct):
        if em.get('emitterName') == name:
            return em
    return None


def add_emitters(sysstruct, ems):
    f = sysstruct.field('complexEmitterDefinitionData')
    if f is None:
        sysstruct.fields.append(F('complexEmitterDefinitionData', L.LIST, L.List(L.STRUCT, list(ems))))
    else:
        f.value.items.extend(ems)


def clone_system(b, src_path, new_path, keep_emitters=None):
    src = b.entry(src_path)
    st = copy.deepcopy(src.struct)
    name = new_path.split('/')[-1]
    st.set('particleName', L.STRING, name)
    st.set('particlePath', L.STRING, new_path)
    if st.field('objectPath'):
        st.set('objectPath', L.HASH, L.fnv1a(new_path))
    if keep_emitters is not None:
        f = st.field('complexEmitterDefinitionData')
        f.value.items = [e for e in f.value.items if e.get('emitterName') in keep_emitters]
    b.entries.append(L.Entry(new_path, st))
    return st


def add_resource(b, resolver_path, key, target_path):
    r = b.entry(resolver_path).struct
    m = r.field('resourceMap').value
    m.items.append((L.fnv1a(key), L.fnv1a(target_path)))


def clone_emitter(b, sys_path, name, new_name):
    src = find_emitter(b.entry(sys_path).struct, name)
    em = copy.deepcopy(src)
    em.set('emitterName', L.STRING, new_name)
    return em


def set_curve_color(em, times, values):
    em.set('Color', L.EMBED, vcolor(values[0], times, values))


def submesh_list(names):
    return L.List(L.HASH, [L.fnv1a(n) for n in names])
