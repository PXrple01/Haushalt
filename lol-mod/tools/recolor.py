"""Step 1: push every effect color of Yunara's base skin into the Flow palette."""
import lolbin as L
from lolassets import flow_rgba

VALUE_COLOR = L.fnv1a('ValueColor')
ANIM_COLOR = L.fnv1a('VfxAnimatedColorVariableData')
REFLECTION = L.fnv1a('VfxReflectionDefinitionData')
H_CONST = L.fnv1a('constantValue')
H_VALUES = L.fnv1a('values')
H_FRESNEL = L.fnv1a('fresnelColor')


def recolor_value(v, t, stats, skip=None, fn=flow_rgba):
    if isinstance(v, L.Struct):
        if skip and skip(v):
            return
        th = v.type_hash
        for f in v.fields:
            if th == VALUE_COLOR and f.hash == H_CONST and f.type == L.VEC4:
                f.value = fn(f.value); stats['const'] += 1
            elif th == ANIM_COLOR and f.hash == H_VALUES and isinstance(f.value, L.List) and f.value.vtype == L.VEC4:
                f.value.items = [fn(c) for c in f.value.items]; stats['anim'] += len(f.value.items)
            elif th == REFLECTION and f.hash == H_FRESNEL and f.type == L.VEC4:
                f.value = fn(f.value); stats['fresnel'] += 1
            else:
                recolor_value(f.value, f.type, stats, skip, fn)
    elif isinstance(v, L.List):
        for x in v.items:
            recolor_value(x, v.vtype, stats, skip, fn)
    elif isinstance(v, L.Map):
        for k, x in v.items:
            recolor_value(x, v.vtype, stats, skip, fn)
    elif isinstance(v, L.Option) and v.value is not None:
        recolor_value(v.value, v.vtype, stats, skip, fn)


def is_q_system(st):
    """Q (flow state) systems get the white-violet palette instead of Flow green."""
    return '_Q_' in str(st.get('particleName') or '')


def recolor_bin(b: L.BinFile, skip_system=None):
    stats = {'const': 0, 'anim': 0, 'fresnel': 0}
    vfx = L.fnv1a('VfxSystemDefinitionData')
    for e in b.entries:
        if e.struct is not None and e.struct.type_hash == vfx and not (skip_system and skip_system(e.struct)):
            recolor_value(e.struct, L.EMBED, stats)
    return stats


# Textures that carry real color (measured: mean saturation > 0.1). Normal maps,
# distortion maps and erosion masks are data, not color, and are left alone.
COLORED_TEXTURES = [
    'yunara_base_q_beamcolorgradmult', 'yunara_base_passive_orb01', 'yunara_base_w_bgswirl',
    'yunaravisdev_grad01', 'yunara_base_w_headdiffuse', 'yunara_skin01_petal', 'yunara_base_tile01',
    'yunara_base_q_orb01', 'yunara_base_ba_orb01', 'yunara_base_trail10', 'yunara_base_spiritguard_recallwater02',
]
