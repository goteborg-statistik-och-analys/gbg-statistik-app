"""Build a small SVG-path asset from SCB's thematic boundaries, using stdlib only.
Usage: python tools/build-sweden-map.py path/to/shape_svenska_260225.zip
"""
import hashlib
import io
import json
import struct
import sys
import zipfile
from pathlib import Path

raw = Path(sys.argv[1]).read_bytes()
outer = zipfile.ZipFile(io.BytesIO(raw))
archive = zipfile.ZipFile(io.BytesIO(outer.read('Kommun_Sweref99TM.zip')))
dbf = archive.read('Kommun_Sweref99TM.dbf')
count, header, record = struct.unpack_from('<IHH', dbf, 4)
fields = [(dbf[i:i+11].split(b'\0')[0].decode(), dbf[i+16]) for i in range(32, header-1, 32)]
rows = []
for i in range(count):
    offset = header+i*record
    assert dbf[offset:offset+1] == b' '
    offset += 1
    row = {}
    for name, size in fields:
        row[name] = dbf[offset:offset+size].decode('cp1252').strip()
        offset += size
    rows.append(row)
shp = archive.read('Kommun_Sweref99TM.shp')
assert struct.unpack_from('<I', shp, 32)[0] == 5, 'Expected Polygon shape'
xmin, ymin, xmax, ymax = struct.unpack_from('<4d', shp, 36)
scale = 760 / (ymax-ymin)
features, offset = [], 100
for row in rows:
    length = struct.unpack_from('>I', shp, offset+4)[0]*2
    shape = shp[offset+8:offset+8+length]
    assert struct.unpack_from('<I', shape)[0] == 5
    parts, points = struct.unpack_from('<II', shape, 36)
    starts = list(struct.unpack_from('<'+'I'*parts, shape, 44))+[points]
    coords = [struct.unpack_from('<dd', shape, 44+4*parts+16*i) for i in range(points)]
    path = ''.join('M'+'L'.join(f'{20+(x-xmin)*scale:.2f},{20+(ymax-y)*scale:.2f}' for x,y in coords[a:b])+'Z' for a,b in zip(starts, starts[1:]))
    features.append({'code': row['KnKod'], 'name': row['KnNamn'], 'path': path})
    offset += 8+length
assert len(features) == len({f['code'] for f in features}) == 290
asset = {'source':'SCB, digitala gränser för tematisk statistik', 'url':'https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/digitala-granser/', 'archive':'https://www.scb.se/contentassets/3443fea3fa6640f7a57ea15d9a372d33/shape_svenska_260225.zip', 'sha256':hashlib.sha256(raw).hexdigest(), 'license':'CC0', 'crs':'EPSG:3006', 'note':'Förenklade tematiska gränser, inte för geografisk analys. Arkivversion 260225; avser inte ett verifierat gränsår.', 'width':round(40+(xmax-xmin)*scale,2), 'height':800, 'features':features}
Path('data/sweden-municipalities-map.json').write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'Built {len(features)} municipalities')
