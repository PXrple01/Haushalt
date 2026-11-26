"""Checks a built .fantome before it goes to the player:
  1. WAD: entries sorted by path hash, every xxh3 checksum matches its data
  2. every .bin parses and re-serialises byte-identically
  3. schema: classes/fields/types against the game's class dump (validate_bin.py)
  4. "proven" combos: every (class, field, value type) we write must also appear in at least one Riot bin of the
     reference set (Riot's own Yunara bins + any extra Riot bins given) - anything new is listed

  python3 check_package.py <file.fantome> <meta dump .json> <riot bin or dir> [more riot bins/dirs ...]
"""
import collections
import glob
import io
import os
import struct
import sys
import zipfile

import xxhash

import lolbin as L
import validate_bin as VB


def wad_entries(data):
    assert data[:2] == b'RW', 'not a WAD'
    n = struct.unpack_from('<I', data, 268)[0]
    out, last = [], -1
    problems = []
    for k in range(n):
        h, off, csize, size, typ, _, _, chk = struct.unpack_from('<QIIIBBHQ', data, 272 + 32 * k)
        if h <= last:
            problems.append(f'entry {k} not sorted')
        last = h
        d = data[off:off + csize]
        if xxhash.xxh3_64(d).intdigest() != chk:
            problems.append(f'entry {h:016x} checksum')
        out.append((h, d))
    return out, problems


def combos(v, acc, cls=None):
    if isinstance(v, L.Struct):
        for f in v.fields:
            acc.add((v.type_hash, f.hash, f.type))
            combos(f.value, acc, v.type_hash)
    elif isinstance(v, L.List):
        for x in v.items:
            combos(x, acc)
    elif isinstance(v, L.Option):
        if v.value is not None:
            combos(v.value, acc)
    elif isinstance(v, L.Map):
        for _, x in v.items:
            combos(x, acc)
    return acc


def bin_combos(b):
    acc = set()
    for e in b.entries:
        if e.struct is not None:
            acc.add(('entry', e.struct.type_hash))
            combos(e.struct, acc)
    return acc


def main():
    fant, dump = sys.argv[1], sys.argv[2]
    refs = []
    for r in sys.argv[3:]:
        refs += sorted(glob.glob(os.path.join(r, '**', '*.bin'), recursive=True)) if os.path.isdir(r) else [r]
    z = zipfile.ZipFile(fant)
    wad = z.read([n for n in z.namelist() if n.startswith('WAD/')][0])
    ents, probs = wad_entries(wad)
    print(f'WAD: {len(ents)} entries, {len(probs)} problems', probs[:5])
    schema = VB.Schema(dump)
    proven = set()
    for r in refs:
        try:
            proven |= bin_combos(L.read(r))
        except Exception as ex:                                       # noqa: BLE001
            print('  (reference not readable:', os.path.basename(r), ex, ')')
    print(f'reference: {len(refs)} Riot bins, {len(proven)} class/field/type combos')
    names = {}
    hp = os.environ.get('BIN_HASHES')
    if hp:
        for fn in ('hashes.binfields.txt', 'hashes.bintypes.txt'):
            for line in open(os.path.join(hp, fn)):
                h, _, n = line.strip().partition(' ')
                if n:
                    names[int(h, 16)] = n
    nm = lambda h: names.get(h, f'{h:08x}')
    bad = 0
    for h, d in ents:
        if d[:4] not in (b'PROP', b'PTCH'):
            continue
        b = L.read(d)
        again = L.write(b)
        same = again == d
        res = VB.check(schema, b, f'{h:016x}')
        new = sorted(bin_combos(b) - proven, key=str)
        print(f'bin {h:016x}: {len(b.entries)} entries, re-serialise {"identical" if same else "DIFFERENT"}, '
              f'schema problems {sum(res.values()) if isinstance(res, collections.Counter) else res}, '
              f'new combos vs Riot: {len(new)}')
        for c in new:
            print('    NEW', nm(c[1]) if c[0] == 'entry' else f'{nm(c[0])}.{nm(c[1])} ({VB.NAME.get(c[2], c[2])})')
        bad += (not same) + len(new)
    return bad


if __name__ == '__main__':
    main()
