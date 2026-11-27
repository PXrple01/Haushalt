"""Extracts what a custom-skeleton model slot needs from Yunara.wad.client (see fetch_wad.py):
all animation clips (by path hash), the base skeleton, the base animation graph and the bin with her contextual
actions (CAC: voice lines on kills ..., extended by multikill_fx.py).

  python3 extract_wad.py <Yunara.wad.client> <game dir used by build_mod.py>
"""
import os
import sys

import pyritofile
import xxhash

CAC_BIN = ('data/characters/yunara/yunara_multi_skins_root_skins_skin0_skins_skin1_skins_skin10_skins_skin11_skins_skin12_'
           'skins_skin13_skins_skin14_skins_skin15_skins_skin16_skins_skin2_skins_skin3_skins_skin4_skins_skin5_skins_skin6_'
           'skins_skin7_skins_skin8_skins_skin9.bin')       # holds Yunara's contextual actions (kill VO rules ...)
WANT = ['assets/characters/yunara/skins/base/yunara_base.skl',
        'data/characters/yunara/animations/skin0.bin', CAC_BIN]


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
