"""Extracts what a custom-skeleton model slot needs from Yunara.wad.client (see fetch_wad.py):
all animation clips (by path hash), the base skeleton and the base animation graph.

  python3 extract_wad.py <Yunara.wad.client> <game dir used by build_mod.py>
"""
import os
import sys

import pyritofile
import xxhash

WANT = ['assets/characters/yunara/skins/base/yunara_base.skl',
        'data/characters/yunara/animations/skin0.bin']


def main(wad_path, dest):
    w = pyritofile.WAD(); w.read(wad_path)
    by_hash = {int(c.hash, 16) if isinstance(c.hash, str) else c.hash: c for c in w.chunks}
    os.makedirs(os.path.join(dest, 'anm'), exist_ok=True)
    with open(wad_path, 'rb') as f:
        bs = pyritofile.stream.BinStream(f)

        def data(c):
            c.read_data(bs); return c.data
        for p in WANT:
            c = by_hash[xxhash.xxh64(p.encode()).intdigest()]
            os.makedirs(os.path.dirname(os.path.join(dest, p)), exist_ok=True)
            open(os.path.join(dest, p), 'wb').write(data(c))
        n = 0
        for h, c in by_hash.items():
            d = data(c)
            if d and d[:8] in (b'r3d2anmd', b'r3d2canm'):
                open(os.path.join(dest, 'anm', f'{h:016x}.anm'), 'wb').write(d); n += 1
            c.data = None
    print(f'skeleton, animation graph and {n} animation clips extracted to {dest}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
