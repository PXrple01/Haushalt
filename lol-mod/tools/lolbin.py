"""Minimal reader/writer for League of Legends .bin property files (PROP v3).

Built for this mod project because pyritofile cannot read current bins.
Values:
  basic types -> python values (tuples for vectors)
  HASH/LINK   -> int (FNV1a 32-bit)
  PATH        -> int (xxh64)
  STRUCT/EMBED-> Struct(type_hash, [Field...], kind)
  LIST/LIST2  -> List(vtype, [values], kind)
  OPTION      -> Option(vtype, value_or_None)
  MAP         -> Map(ktype, vtype, [(k, v), ...])
"""
import struct
import xxhash

EMPTY, BOOL, S8, U8, S16, U16, S32, U32, S64, U64, F32, VEC2, VEC3, VEC4, MTX44, RGBA, STRING, HASH, PATH = range(19)
LIST, LIST2, STRUCT, EMBED, LINK, OPTION, MAP, FLAG = range(0x80, 0x88)

_FMT = {BOOL: '<?', S8: '<b', U8: '<B', S16: '<h', U16: '<H', S32: '<i', U32: '<I', S64: '<q', U64: '<Q',
        F32: '<f', VEC2: '<2f', VEC3: '<3f', VEC4: '<4f', MTX44: '<16f', RGBA: '<4B', HASH: '<I', PATH: '<Q',
        LINK: '<I', FLAG: '<B', EMPTY: '<3H'}


def fnv1a(s: str) -> int:
    h = 0x811c9dc5
    for b in s.lower().encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h


def xxh64(s: str) -> int:
    return xxhash.xxh64(s.lower().encode('utf-8')).intdigest()


class Field:
    __slots__ = ('hash', 'type', 'value')

    def __init__(self, h, t, v):
        self.hash = fnv1a(h) if isinstance(h, str) else h
        self.type = t
        self.value = v


class Struct:
    __slots__ = ('type_hash', 'fields', 'kind')

    def __init__(self, type_hash, fields, kind=STRUCT):
        self.type_hash = fnv1a(type_hash) if isinstance(type_hash, str) else type_hash
        self.fields = fields
        self.kind = kind

    # helpers -----------------------------------------------------------
    def field(self, name):
        h = fnv1a(name) if isinstance(name, str) else name
        for f in self.fields:
            if f.hash == h:
                return f
        return None

    def get(self, name, default=None):
        f = self.field(name)
        return f.value if f is not None else default

    def set(self, name, ftype, value):
        f = self.field(name)
        if f is None:
            self.fields.append(Field(name, ftype, value))
        else:
            f.type, f.value = ftype, value

    def remove(self, name):
        h = fnv1a(name)
        self.fields = [f for f in self.fields if f.hash != h]

    def is_type(self, name):
        return self.type_hash == fnv1a(name)


class List:
    __slots__ = ('vtype', 'items', 'kind')

    def __init__(self, vtype, items, kind=LIST):
        self.vtype, self.items, self.kind = vtype, items, kind


class Option:
    __slots__ = ('vtype', 'value')

    def __init__(self, vtype, value):
        self.vtype, self.value = vtype, value


class Map:
    __slots__ = ('ktype', 'vtype', 'items')

    def __init__(self, ktype, vtype, items):
        self.ktype, self.vtype, self.items = ktype, vtype, items


class Entry:
    """One top-level object. If it could not be parsed, `raw` keeps its bytes
    (everything after the size field) and `type_hash` its class hash."""
    __slots__ = ('path_hash', 'struct', 'raw', 'type_hash')

    def __init__(self, path_hash, struct_, raw=None, type_hash=None):
        self.path_hash = fnv1a(path_hash) if isinstance(path_hash, str) else path_hash
        self.struct = struct_
        self.raw = raw
        self.type_hash = struct_.type_hash if struct_ is not None else type_hash


class BinFile:
    def __init__(self):
        self.version = 3
        self.links = []
        self.entries = []   # list[Entry]
        self.is_patch = False
        self.patch_header = b''
        self.patches_raw = b''

    def entry(self, path):
        h = fnv1a(path) if isinstance(path, str) else path
        for e in self.entries:
            if e.path_hash == h:
                return e
        return None


# ---------------------------------------------------------------- reading
class _R:
    def __init__(self, data):
        self.d, self.p = data, 0

    def fmt(self, f):
        v = struct.unpack_from(f, self.d, self.p)
        self.p += struct.calcsize(f)
        return v

    def value(self, t):
        if t in _FMT:
            v = self.fmt(_FMT[t])
            return v if len(v) > 1 else v[0]
        if t == STRING:
            n, = self.fmt('<H')
            s = self.d[self.p:self.p + n].decode('utf-8')
            self.p += n
            return s
        if t in (LIST, LIST2):
            vt, _size, count = self.fmt('<BII')
            return List(vt, [self.value(vt) for _ in range(count)], t)
        if t == STRUCT:
            th, = self.fmt('<I')
            if th == 0:
                return Struct(0, [], STRUCT)
            _size, count = self.fmt('<IH')
            return Struct(th, [self.field() for _ in range(count)], STRUCT)
        if t == EMBED:
            th, _size, count = self.fmt('<IIH')
            return Struct(th, [self.field() for _ in range(count)], EMBED)
        if t == OPTION:
            vt, count = self.fmt('<BB')
            return Option(vt, self.value(vt) if count else None)
        if t == MAP:
            kt, vt, _size, count = self.fmt('<BBII')
            return Map(kt, vt, [(self.value(kt), self.value(vt)) for _ in range(count)])
        raise ValueError(f'unknown bin type {t} at {self.p}')

    def field(self):
        h, t = self.fmt('<IB')
        return Field(h, t, self.value(t))


def read(path_or_bytes):
    data = path_or_bytes if isinstance(path_or_bytes, (bytes, bytearray)) else open(path_or_bytes, 'rb').read()
    r = _R(data)
    b = BinFile()
    magic = data[:4]
    if magic == b'PTCH':
        b.is_patch = True
        b.patch_header = data[4:12]
        r.p = 12
        magic = data[12:16]
    assert magic == b'PROP', magic
    r.p += 4
    b.version, = r.fmt('<I')
    if b.version >= 2:
        n, = r.fmt('<I')
        for _ in range(n):
            b.links.append(r.value(STRING))
    n, = r.fmt('<I')
    types = r.fmt(f'<{n}I') if n else ()
    for i in range(n):
        start = r.p
        size, h, count = r.fmt('<IIH')
        end = start + 4 + size
        try:
            fields = [r.field() for _ in range(count)]
            if r.p != end:
                raise ValueError('size mismatch')
            b.entries.append(Entry(h, Struct(types[i], fields, EMBED)))
        except (ValueError, struct.error):
            # unknown/new encoding: keep the bytes untouched
            b.entries.append(Entry(h, None, raw=data[start + 4:end], type_hash=types[i]))
            r.p = end
    b.patches_raw = data[r.p:]
    return b


# ---------------------------------------------------------------- writing
def _wvalue(t, v):
    if t in _FMT:
        f = _FMT[t]
        return struct.pack(f, *v) if isinstance(v, (tuple, list)) else struct.pack(f, v)
    if t == STRING:
        s = v.encode('utf-8')
        return struct.pack('<H', len(s)) + s
    if t in (LIST, LIST2):
        body = b''.join(_wvalue(v.vtype, x) for x in v.items)
        return struct.pack('<BII', v.vtype, 4 + len(body), len(v.items)) + body
    if t == STRUCT:
        if v.type_hash == 0:
            return struct.pack('<I', 0)
        body = b''.join(_wfield(f) for f in v.fields)
        return struct.pack('<IIH', v.type_hash, 2 + len(body), len(v.fields)) + body
    if t == EMBED:
        body = b''.join(_wfield(f) for f in v.fields)
        return struct.pack('<IIH', v.type_hash, 2 + len(body), len(v.fields)) + body
    if t == OPTION:
        if v.value is None:
            return struct.pack('<BB', v.vtype, 0)
        return struct.pack('<BB', v.vtype, 1) + _wvalue(v.vtype, v.value)
    if t == MAP:
        body = b''.join(_wvalue(v.ktype, k) + _wvalue(v.vtype, x) for k, x in v.items)
        return struct.pack('<BBII', v.ktype, v.vtype, 4 + len(body), len(v.items)) + body
    raise ValueError(f'cannot write type {t}')


def _wfield(f):
    return struct.pack('<IB', f.hash, f.type) + _wvalue(f.type, f.value)


def write(b: BinFile, path=None):
    out = bytearray()
    if b.is_patch:
        out += b'PTCH' + b.patch_header
    out += b'PROP' + struct.pack('<I', b.version)
    if b.version >= 2:
        out += struct.pack('<I', len(b.links))
        for l in b.links:
            out += _wvalue(STRING, l)
    out += struct.pack('<I', len(b.entries))
    for e in b.entries:
        out += struct.pack('<I', e.type_hash if e.struct is None else e.struct.type_hash)
    for e in b.entries:
        if e.struct is None:
            out += struct.pack('<I', len(e.raw)) + e.raw
            continue
        body = b''.join(_wfield(f) for f in e.struct.fields)
        out += struct.pack('<IIH', 4 + 2 + len(body), e.path_hash, len(e.struct.fields)) + body
    out += b.patches_raw
    data = bytes(out)
    if path:
        open(path, 'wb').write(data)
    return data
