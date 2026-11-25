"""Checks a .bin against the game's own class schema (LeagueToolkit/lol-meta-classes dump):
every class must exist, every field must belong to the class (or a base class) and carry exactly the type the
game declares; pointers/embeds must point at the declared class or a subclass; containers, maps and options must
use the declared element types. Run it on Riot's original file first: it must report 0 problems there too.

  python3 validate_bin.py <meta dump .json> <file.bin> [more .bin ...]
"""
import collections
import json
import sys

import lolbin as L

NAME = {L.BOOL: 'Bool', L.S8: 'I8', L.U8: 'U8', L.S16: 'I16', L.U16: 'U16', L.S32: 'I32', L.U32: 'U32', L.S64: 'I64',
        L.U64: 'U64', L.F32: 'F32', L.VEC2: 'Vec2', L.VEC3: 'Vec3', L.VEC4: 'Vec4', L.MTX44: 'Mtx44', L.RGBA: 'Color',
        L.STRING: 'String', L.HASH: 'Hash', L.PATH: 'File', L.LIST: 'List', L.LIST2: 'List2', L.STRUCT: 'Pointer',
        L.EMBED: 'Embed', L.LINK: 'Link', L.OPTION: 'Option', L.MAP: 'Map', L.FLAG: 'Flag'}


class Schema:
    def __init__(self, path):
        d = json.load(open(path))
        self.cls = {int(k, 16): v for k, v in d['classes'].items()}
        self.hashers = d.get('hashers', {})

    def chain(self, c):
        out = []
        while c is not None and c in self.cls and c not in out:
            out.append(c)
            b = self.cls[c].get('base')
            c = int(b, 16) if b else None
        return out

    def prop(self, c, fh):
        key = f'0x{fh:08x}'
        for k in self.chain(c):
            p = self.cls[k]['properties'].get(key)
            if p:
                return p
        return None

    def is_a(self, c, want):
        if want is None:
            return True
        return want in self.chain(c) or any(int(s, 16) == want for k in self.chain(c)
                                            for s in self.cls[k].get('secondary_bases', {}) or {})


def check(schema, b, label):
    probs = collections.Counter(); examples = {}

    def bad(kind, where):
        probs[kind] += 1
        examples.setdefault(kind, where)

    def value(t, v, want_vt, other, where):
        nm = NAME.get(t, f'?{t}')
        if want_vt is not None and nm != want_vt:
            bad(f'type {nm} where game expects {want_vt}', where); return
        oc = int(other, 16) if other else None
        if t in (L.STRUCT, L.EMBED):
            if t == L.STRUCT and v.type_hash == 0:
                return
            if v.type_hash not in schema.cls:
                bad('unknown class', f'{where} class 0x{v.type_hash:08x}'); return
            if oc is not None and not schema.is_a(v.type_hash, oc):
                bad('class not compatible with declared class', f'{where}: 0x{v.type_hash:08x} vs 0x{oc:08x}')
            struct_(v, where)

    def struct_(s, where):
        for f in s.fields:
            p = schema.prop(s.type_hash, f.hash)
            w = f'{where}.0x{f.hash:08x}'
            if p is None:
                bad('field not in class', f'{w} (class 0x{s.type_hash:08x})'); continue
            vt = p['value_type']
            nm = NAME.get(f.type, f'?{f.type}')
            if nm != vt:
                bad(f'field type {nm} where game expects {vt}', w); continue
            if f.type in (L.LIST, L.LIST2):
                c = p['container']
                for i, it in enumerate(f.value.items):
                    value(f.value.vtype, it, c['value_type'], p['other_class'], f'{w}[{i}]')
            elif f.type == L.OPTION:
                c = p['container']
                if f.value.value is not None:
                    value(f.value.vtype, f.value.value, c['value_type'], p['other_class'], f'{w}?')
            elif f.type == L.MAP:
                m = p['map']
                if NAME.get(f.value.ktype) != m['key_type']:
                    bad(f'map key {NAME.get(f.value.ktype)} where game expects {m["key_type"]}', w)
                for k, v in f.value.items:
                    value(f.value.vtype, v, m['value_type'], p['other_class'], f'{w}[{k}]')
            elif f.type in (L.STRUCT, L.EMBED):
                value(f.type, f.value, vt, p['other_class'], w)
            elif f.type == L.HASH and p.get('hasher'):
                h = schema.hashers.get(p['hasher'], {})
                if h.get('storage_width', 4) != 4:
                    bad('hash width', w)
    raw = 0
    for e in b.entries:
        if e.struct is None:
            raw += 1; continue                      # kept as raw bytes by lolbin (copied unchanged)
        if e.struct.type_hash not in schema.cls:
            bad('unknown entry class', f'entry 0x{e.path_hash:08x}' if hasattr(e, 'path_hash') else 'entry')
            continue
        struct_(e.struct, f'0x{getattr(e, "path_hash", 0):08x}')
    total = sum(probs.values())
    print(f'{label}: {len(b.entries)} entries ({raw} raw, not checked), {total} problems')
    for k, n in probs.most_common():
        print(f'   {n:5d} x {k}   e.g. {examples[k]}')
    return total


if __name__ == '__main__':
    sch = Schema(sys.argv[1])
    rc = 0
    for p in sys.argv[2:]:
        rc += check(sch, L.read(p), p)
    sys.exit(1 if rc else 0)
