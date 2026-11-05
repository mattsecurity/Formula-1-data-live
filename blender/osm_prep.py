"""Turn an OpenStreetMap Overpass dump of a circuit into blender/<id>.json.

Usage: python3 blender/osm_prep.py <overpass.json> <out.json> <first-way-id> [exclude-way-id ...]

The F1 lap is chained from the raceway ways tagged importance=international,
starting at <first-way-id> (the start/finish straight). Everything is written in
metres in a local east/north frame with the origin at the start of the lap.
"""
import json
import math
import sys

src, out, first = sys.argv[1], sys.argv[2], int(sys.argv[3])
exclude = {int(a) for a in sys.argv[4:]}
data = json.load(open(src))
els = [e for e in data['elements'] if e['type'] == 'way' and 'geometry' in e]
byid = {e['id']: e for e in els}

lat0 = byid[first]['geometry'][0]['lat']
lon0 = byid[first]['geometry'][0]['lon']
kx = 111320 * math.cos(math.radians(lat0))
ky = 110574


def xy(p):
    return [round((p['lon'] - lon0) * kx, 2), round((p['lat'] - lat0) * ky, 2)]


def key(p):
    return (round(p['lat'], 7), round(p['lon'], 7))


# ---- chain the lap
lapways = [e for e in els if e.get('tags', {}).get('highway') == 'raceway'
           and e['tags'].get('importance') == 'international' and e['id'] not in exclude]
starts = {}
for e in lapways:
    starts.setdefault(key(e['geometry'][0]), []).append(e)
lap = []
cur = byid[first]
used = set()
while cur and cur['id'] not in used:
    used.add(cur['id'])
    g = cur['geometry']
    lap.extend(xy(p) for p in (g if not lap else g[1:]))
    nxt = [e for e in starts.get(key(g[-1]), []) if e['id'] not in used]
    cur = nxt[0] if nxt else None
closed = math.dist(lap[0], lap[-1]) < 1
if closed:
    lap.pop()
L = sum(math.dist(lap[i], lap[(i + 1) % len(lap)]) for i in range(len(lap)))
print(f'lap: {len(used)} ways, {len(lap)} pts, {L:.0f} m, closed={closed}', file=sys.stderr)

# ---- everything else, kept within `radius` of the lap
radius = 450


def near(poly):
    for p in poly[:: max(1, len(poly) // 8)]:
        if min(math.dist(p, q) for q in lap[::4]) < radius:
            return True
    return False


feat = {k: [] for k in ('pit', 'grandstand', 'building', 'forest', 'grass', 'farmland', 'urban', 'sand', 'water', 'road')}
for e in els:
    t = e.get('tags', {})
    poly = [xy(p) for p in e['geometry']]
    isarea = len(poly) > 3 and poly[0] == poly[-1]
    if isarea:
        poly = poly[:-1]
    if not near(poly):
        continue
    if t.get('highway') == 'raceway' and t.get('name') == 'Pit Lane':
        feat['pit'].append(poly)
    elif t.get('building') == 'grandstand' and isarea:
        feat['grandstand'].append(poly)
    elif 'building' in t and isarea:
        lv = t.get('building:levels')
        h = t.get('height')
        try:
            hh = float(h) if h else (float(lv) * 3.2 if lv else None)
        except ValueError:
            hh = None
        feat['building'].append({'pts': poly, 'h': hh, 'kind': t['building']})
    elif isarea and (t.get('landuse') == 'forest' or t.get('natural') in ('wood', 'scrub')):
        feat['forest'].append(poly)
    elif isarea and (t.get('landuse') in ('grass', 'meadow', 'recreation_ground') or t.get('leisure') == 'park'):
        feat['grass'].append(poly)
    elif isarea and t.get('landuse') in ('farmland', 'orchard', 'vineyard', 'farmyard'):
        feat['farmland'].append(poly)
    elif isarea and t.get('landuse') in ('residential', 'industrial', 'commercial', 'retail', 'construction'):
        feat['urban'].append(poly)
    elif isarea and t.get('natural') == 'sand':
        feat['sand'].append(poly)
    elif isarea and t.get('natural') == 'water':
        feat['water'].append(poly)
    elif t.get('highway') in ('service', 'tertiary', 'secondary', 'unclassified', 'residential', 'track') and not isarea:
        feat['road'].append(poly)

for k, v in feat.items():
    print(f'{k}: {len(v)}', file=sys.stderr)
json.dump({'origin': [lat0, lon0], 'lap': lap, **feat}, open(out, 'w'))
