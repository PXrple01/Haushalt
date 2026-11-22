"""Downloads one champion WAD (e.g. Yunara.wad.client) straight from Riot's patch CDN.

Only the chunks of that single file are fetched (HTTP range requests on the bundles).
Uses the manifest parser from CommunityDragon's cdtb (path given as 2nd argument).
Usage: python3 fetch_wad.py <output.wad.client> <cdtb_dir> [Champion]
"""
import json
import sys
import urllib.request

import pyzstd

out, cdtb_dir = sys.argv[1], sys.argv[2]
champ = sys.argv[3] if len(sys.argv) > 3 else 'Yunara'
sys.path.insert(0, cdtb_dir)
from cdtb.patcher import PatcherManifest  # noqa: E402

UA = {'User-Agent': 'Mozilla/5.0'}


def get(url, rng=None):
    h = dict(UA)
    if rng:
        h['Range'] = f'bytes={rng[0]}-{rng[1]}'
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=120) as r:
        return r.read()


vs = json.loads(get('https://sieve.services.riotcdn.net/api/v1/products/lol/version-sets/EUW1?q[platform]=windows&q[published]=true'))
rel = vs['releases'][-1]
murl = rel['download']['url'].replace('.secure.', '.')
print('game version:', rel.get('release', {}).get('labels', {}).get('riot:artifact_version_id', {}).get('values', ['?'])[0])
import io
man = PatcherManifest()
man.parse_rman(io.BytesIO(get(murl)))
name = [n for n in man.files if n.lower() == f'data/final/champions/{champ.lower()}.wad.client'][0]
f = man.files[name]
print(name, f.size, 'bytes in', len(f.chunks), 'chunks')
data = bytearray()
for c in f.chunks:
    raw = get(f'https://lol.dyn.riotcdn.net/channels/public/bundles/{c.bundle.bundle_id:016X}.bundle', (c.offset, c.offset + c.size - 1))
    data += pyzstd.decompress(raw)
assert len(data) == f.size
open(out, 'wb').write(data)
print('saved', out)
