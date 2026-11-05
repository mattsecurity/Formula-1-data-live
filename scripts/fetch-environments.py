"""Fetch real OSM surroundings for the circuits supported by findCircuit.

Run: python scripts/fetch-environments.py [--refresh] [circuit-id ...]
Network requests are build-time only. OSM data is © OpenStreetMap contributors,
ODbL 1.0. Geographic circuit outlines come from bacinger/f1-circuits (MIT).
Only mapped footprints, land cover, roads and coastlines become scene geometry.
"""
import argparse
import datetime
import hashlib
import json
import math
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/environments'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'f1-environments-cache'
IDS = ['bh-2002','sa-2021','au-1953','jp-1962','cn-2004','us-2022','it-1953','mc-1929','es-2026','es-1991','ca-1978','at-1969','gb-1948','hu-1986','be-1925','nl-1948','it-1922','az-2016','sg-2008','us-2012','mx-1962','br-1940','us-2023','qa-2004','ae-2009']


def download(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if cache.exists():
        return cache.read_bytes()
    proc = subprocess.run(['curl','--connect-timeout','10','--max-time','35','-fsSL',url], capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode().strip())
    cache.write_bytes(proc.stdout)
    time.sleep(0.3)
    return proc.stdout


def tags(element):
    return {t.attrib['k']: t.attrib['v'] for t in element.findall('tag')}


def kind_of(t):
    if (t.get('building', 'no') != 'no' or t.get('building:part', 'no') != 'no'
            or t.get('leisure') in ('bleachers','grandstand') or t.get('amenity') == 'grandstand'):
        return 'building'
    if t.get('barrier') in ('fence','guard_rail','wall','retaining_wall'):
        return 'barrier'
    if t.get('natural') == 'water' or t.get('waterway') in ('riverbank', 'dock') or t.get('landuse') in ('reservoir', 'basin'):
        return 'water'
    if t.get('highway') in ('motorway','trunk','primary','secondary','tertiary','unclassified','residential','service','pedestrian','footway','path','cycleway','raceway'):
        return 'road'
    if t.get('natural') in ('wood','scrub','grassland','heath') or t.get('landuse') in ('forest','grass','recreation_ground','meadow','village_green') or t.get('leisure') in ('park','garden','pitch','golf_course'):
        return 'vegetation'
    return None


def circuit_role(t):
    """Only explicit motorsport facilities or recognizable stand/pit names."""
    facility = {'grandstand','grandstands','bleachers','pit','pits','pit_building','pit_garage','paddock'}
    if any(t.get(key) in facility for key in ('building','building:part','leisure','amenity','motorsport')):
        return 'circuit'
    if t.get('sport') in ('motor','motorsport','motor_racing','karting'):
        return 'circuit'
    name = ' '.join(t.get(key,'') for key in ('name','name:en','description'))
    if re.search(r'\b(grandstands?|bleachers|tribun[ae]s?|paddock|pit(?:s|[ _-]+(?:building|garages?|complex)))\b',name,re.I):
        return 'circuit'
    return None


def height_of(t):
    value = t.get('height', '')
    match = re.fullmatch(r'\s*([\d.]+)\s*(m|metres|meters|ft|feet|\')?\s*', value)
    if match:
        result = float(match[1]) * (0.3048 if match[2] in ('ft','feet',"'") else 1)
        return round(result, 2) if 0 < result < 1000 else None
    try:
        result = float(t['building:levels']) * 3.2
        return round(result, 2) if 0 < result < 1000 else None
    except (KeyError, ValueError):
        return None


def map_elements(bbox, depth=0):
    """The OSM map API caps dense requests at 50k nodes. Split and merge tiles."""
    url = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(f'{v:.7f}' for v in bbox)
    try:
        return list(ET.fromstring(download(url)))
    except RuntimeError as exc:
        if depth >= 5 or '400' not in str(exc):
            raise
    west, south, east, north = bbox
    if (east-west) * math.cos(math.radians((south+north)/2)) > north-south:
        mid = (west+east)/2
        boxes = [(west,south,mid,north),(mid,south,east,north)]
    else:
        mid = (south+north)/2
        boxes = [(west,south,east,mid),(west,mid,east,north)]
    return [e for box in boxes for e in map_elements(box, depth+1)]


def join_rings(chains):
    """Join undirected OSM member ways, discarding incomplete rings."""
    pending = [list(c) for c in chains if len(c) > 1]
    rings = []
    while pending:
        chain = pending.pop()
        while chain[0] != chain[-1]:
            found = False
            for i, other in enumerate(pending):
                if chain[-1] == other[0]: chain.extend(other[1:])
                elif chain[-1] == other[-1]: chain.extend(other[-2::-1])
                elif chain[0] == other[-1]: chain = other[:-1] + chain
                elif chain[0] == other[0]: chain = other[:0:-1] + chain
                else: continue
                pending.pop(i)
                found = True
                break
            if not found:
                break
        if chain[0] == chain[-1] and len(chain) >= 4:
            rings.append(chain)
    return rings


def contains(ring, point):
    x, y = point
    result = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0]) * (y-a[1]) / (b[1]-a[1]) + a[0]:
            result = not result
    return result


def clip_ring(points, box):
    """Clip large park/water polygons to the scene's mapped rectangle."""
    ring = points[:-1] if points[0] == points[-1] else points[:]
    for axis, limit, direction in ((0,box[0],1),(0,box[2],-1),(1,box[1],1),(1,box[3],-1)):
        output = []
        if not ring: break
        previous = ring[-1]
        for current in ring:
            inside = direction*(current[axis]-limit) >= 0
            was_inside = direction*(previous[axis]-limit) >= 0
            if inside != was_inside:
                ratio = (limit-previous[axis])/(current[axis]-previous[axis])
                output.append([round(previous[0]+ratio*(current[0]-previous[0]),2),round(previous[1]+ratio*(current[1]-previous[1]),2)])
            if inside: output.append(current)
            previous = current
        ring = output
    if len(ring) < 3: return []
    return ring + [ring[0]]


def coastline_water(coastlines, box):
    """Close directed OSM coasts on the map boundary; OSM keeps land on left.

    The rectangle is merely a clipping boundary. Every interior water/land edge
    comes from the mapped coastline, including islands, rather than a synthetic
    sea placed according to the circuit's name or an invented orientation.
    """
    xmin, ymin, xmax, ymax = box
    width, height = xmax-xmin, ymax-ymin
    perimeter = 2*(width+height)

    def segment(a, b):
        dx, dy = b[0]-a[0], b[1]-a[1]
        low, high = 0., 1.
        for p, q in ((-dx,a[0]-xmin),(dx,xmax-a[0]),(-dy,a[1]-ymin),(dy,ymax-a[1])):
            if p == 0:
                if q < 0: return None
            elif p < 0: low = max(low,q/p)
            else: high = min(high,q/p)
        if low >= high: return None
        return [[round(a[0]+t*dx,2),round(a[1]+t*dy,2)] for t in (low,high)]

    parts = []
    for line in coastlines:
        current = []
        for a, b in zip(line,line[1:]):
            clipped = segment(a,b)
            if not clipped:
                if current: parts.append(current)
                current = []
            elif current and current[-1] == clipped[0]: current.append(clipped[1])
            else:
                if current: parts.append(current)
                current = clipped
        if current: parts.append(current)
    # Ways carry coastline direction. Join without reversing their orientation.
    changed = True
    while changed:
        changed = False
        for i, a in enumerate(parts):
            found = next((j for j,b in enumerate(parts) if j != i and a[-1] == b[0]),None)
            if found is not None:
                parts[i] = a + parts[found][1:]
                parts.pop(found)
                changed = True
                break

    def boundary(p):
        if abs(p[0]-xmin)<.03: return p[1]-ymin
        if abs(p[1]-ymax)<.03: return height+p[0]-xmin
        if abs(p[0]-xmax)<.03: return height+width+ymax-p[1]
        if abs(p[1]-ymin)<.03: return 2*height+width+xmax-p[0]
        return None

    closed = [p for p in parts if p[0] == p[-1]]
    opens = [p for p in parts if p[0] != p[-1] and boundary(p[0]) is not None and boundary(p[-1]) is not None]
    corners = [(0.,[xmin,ymin]),(height,[xmin,ymax]),(height+width,[xmax,ymax]),(2*height+width,[xmax,ymin])]
    water = []
    remaining = list(range(len(opens)))
    while remaining:
        first = remaining.pop()
        ring = opens[first][:]
        while True:
            end = boundary(ring[-1])
            choices = remaining + [first]
            target = min(choices,key=lambda i:(boundary(opens[i][0])-end)%perimeter)
            distance = (boundary(opens[target][0])-end)%perimeter
            between = sorted(((value-end)%perimeter,p) for value,p in corners if 0 < (value-end)%perimeter < distance)
            ring.extend(p for _,p in between)
            ring.append(opens[target][0])
            if target == first: break
            remaining.remove(target)
            ring.extend(opens[target][1:])
        water.append(ring)
    # A fully enclosed, counterclockwise coast is an island: subtract it from sea.
    islands = [p for p in closed if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:])) > 0]
    if islands and not opens:
        water.append([[xmin,ymin],[xmin,ymax],[xmax,ymax],[xmax,ymin],[xmin,ymin]])
    return [(ring,[p for p in islands if contains(ring,p[0])]) for ring in water]


def run(cid, refresh=False):
    dest = OUT / (cid+'.json')
    if dest.exists() and not refresh:
        return
    raw = json.loads(download(f'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/{cid}.geojson'))
    line = raw['features'][0]['geometry']['coordinates']
    lon = sum(p[0] for p in line)/len(line)
    lat = sum(p[1] for p in line)/len(line)
    sx = 111320*math.cos(math.radians(lat))
    sy = 111320
    def point(x, y): return [round((x-lon)*sx,2),round((y-lat)*sy,2)]
    margin = 1100 if cid in ('sg-2008','mc-1929','az-2016','us-2023') else 650
    bbox = [min(p[0] for p in line)-margin/sx,min(p[1] for p in line)-margin/sy,max(p[0] for p in line)+margin/sx,max(p[1] for p in line)+margin/sy]
    bounds = point(bbox[0],bbox[1]) + point(bbox[2],bbox[3])
    entities = {(e.tag,e.attrib.get('id')):e for e in map_elements(bbox) if e.tag in ('node','way','relation')}
    relations = [e for (typ,_),e in entities.items() if typ == 'relation' and tags(e).get('type') == 'multipolygon' and kind_of(tags(e))]
    # Map responses may contain only some members of a multipolygon. Fetch the
    # complete relation so lakes, parks, building courtyards and islands survive.
    for relation in relations:
        members = [m.attrib['ref'] for m in relation.findall('member') if m.attrib['type'] == 'way']
        if any(('way', ref) not in entities for ref in members):
            try:
                full = ET.fromstring(download(f"https://api.openstreetmap.org/api/0.6/relation/{relation.attrib['id']}/full"))
                entities.update({(e.tag,e.attrib.get('id')):e for e in full if e.tag in ('node','way')})
            except RuntimeError as exc:
                print(f"{cid}: incomplete relation {relation.attrib['id']}: {exc}", file=sys.stderr, flush=True)
    nodes = {key[1]:point(float(e.attrib['lon']),float(e.attrib['lat'])) for key,e in entities.items() if key[0] == 'node'}
    ways = {key[1]:e for key,e in entities.items() if key[0] == 'way'}
    def refs(way): return [e.attrib['ref'] for e in way.findall('nd')]
    def geometry(chain): return [nodes[n] for n in chain] if all(n in nodes for n in chain) else []
    def feature(identifier, t, points, holes=None):
        kind = kind_of(t)
        # Buildings keep complete real footprints; extensive land cover is clipped.
        if kind in ('water','vegetation'):
            points = clip_ring(points,bounds)
            holes = [p for h in holes or [] if (p := clip_ring(h,bounds))]
        if len(points) < (2 if kind in ('road','barrier') else 4): return None
        out = {'id':identifier,'kind':kind,'points':points,'height':height_of(t),'name':t.get('name'),'type':t.get('building:part',t.get('building',t.get('barrier',t.get('natural',t.get('leisure',t.get('landuse',t.get('highway',t.get('waterway'))))))))}
        if holes: out['holes'] = holes
        if kind == 'building' and circuit_role(t): out['role'] = 'circuit'
        for field,keys in {'color':('building:colour','building:color','colour','color'),'roofColor':('roof:colour','roof:color'),'roofMaterial':('roof:material',)}.items():
            value = next((t[key] for key in keys if t.get(key)),None)
            if value: out[field] = value
        return out
    features = []
    represented = set()
    incomplete = []
    for relation in relations:
        t = tags(relation)
        members = [m for m in relation.findall('member') if m.attrib['type'] == 'way']
        outer_chains = [refs(ways[m.attrib['ref']]) for m in members if m.attrib.get('role','') in ('','outer') and m.attrib['ref'] in ways]
        inner_chains = [refs(ways[m.attrib['ref']]) for m in members if m.attrib.get('role') == 'inner' and m.attrib['ref'] in ways]
        outers = join_rings(outer_chains)
        inners = join_rings(inner_chains)
        outer_points = [geometry(c) for c in outers]
        inner_points = [geometry(c) for c in inners]
        if (not outers or any(m.attrib['ref'] not in ways for m in members)
                or sum(len(c)-1 for c in outers+inners) != sum(len(c)-1 for c in outer_chains+inner_chains)
                or any(not points for points in outer_points+inner_points)):
            incomplete.append(int(relation.attrib['id']))
        for index, points in enumerate(outer_points):
            if not points: continue
            holes = [h for h in inner_points if h and contains(points,h[0])]
            item = feature(f"relation/{relation.attrib['id']}/{index}",t,points,holes)
            if item: features.append(item)
        if outers: represented.update(m.attrib['ref'] for m in members)
    for identifier, way in ways.items():
        if identifier in represented: continue
        t = tags(way)
        kind = kind_of(t)
        if not kind: continue
        chain = refs(way)
        points = geometry(chain)
        if not points or (kind not in ('road','barrier') and chain[0] != chain[-1]): continue
        item = feature(int(identifier),t,points)
        if item: features.append(item)
    coasts = [(identifier,geometry(refs(way))) for identifier,way in ways.items() if tags(way).get('natural') == 'coastline']
    for index,(points,holes) in enumerate(coastline_water([p for _,p in coasts if p],bounds)):
        item = {'id':f'coastline/{cid}/{index}','kind':'water','points':points,'height':None,'name':None,'type':'sea','sourceWayIds':[int(identifier) for identifier,_ in coasts]}
        if holes: item['holes'] = holes
        features.append(item)
    result = {'version':1,'circuitId':cid,'origin':[lon,lat],'outline':[point(*p[:2]) for p in line],'features':features,'source':'https://www.openstreetmap.org/copyright','license':'ODbL-1.0','outlineSource':f'https://github.com/bacinger/f1-circuits/blob/master/circuits/{cid}.geojson','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'coverage':{'bbox':bbox,'incompleteRelations':incomplete}}
    OUT.mkdir(exist_ok=True,parents=True)
    dest.write_text(json.dumps(result,separators=(',',':')))
    counts = {kind:sum(f['kind']==kind for f in features) for kind in ('building','water','vegetation','road','barrier')}
    print(cid,counts, 'incomplete relations:',len(incomplete),flush=True)


def write_report():
    rows = []
    for cid in IDS:
        path = OUT / (cid+'.json')
        if not path.exists():
            rows.append(f'| {cid} | Missing | | | | | | |')
            continue
        data = json.loads(path.read_text())
        features = data['features']
        counts = [sum(f['kind']==kind for f in features) for kind in ('building','water','vegetation','road','barrier')]
        holes = sum(bool(f.get('holes')) for f in features)
        facilities = sum(f.get('role') == 'circuit' for f in features)
        rows.append(f"| {cid} | {' | '.join(map(str,counts))} | {facilities} | {holes} |")
    text = '''# Circuit surroundings data

These files bundle real mapped surroundings for the 25 circuits supported by the
replay. They are fetched at build time; viewing a replay needs no map API key or
runtime map request. Regenerate with `python scripts/fetch-environments.py --refresh`.
The downloader caches source responses in the system temporary directory; remove
`f1-environments-cache` there to request a newer map snapshot.

## Sources and attribution

- Map geometry: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Source data is downloaded
  from the public OSM map API. Dense bounding boxes are subdivided and merged by
  OSM entity ID. Incomplete multipolygons are completed through the relation API.
- Geographic circuit outlines: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits),
  MIT license, under `circuits/<circuit ID>.geojson`. Datasets record their local
  origin and download timestamp; refreshed files also include the outline URL.
- The JSON files are a derived OSM database distributed under ODbL 1.0. Retain the
  map attribution and license when redistributing these files or their map views.

## Geometry and limits

Coordinates are `[east, north]` meters relative to each file's `[longitude, latitude]`
origin, using a local equirectangular projection. Road lines, building footprints,
water, parks, pitches and other vegetation follow their OSM geometry.
Mapped fence, guard rail, wall and retaining wall ways use `kind: barrier` and
their original line geometry. Buildings with explicit grandstand, bleacher, pit,
paddock or motorsport facility tags or recognizable names use `role: circuit`.
Mapped building and roof colors and roof materials are preserved when present.
Multipolygon islands and courtyards use `holes`. Original way IDs remain numeric; multipolygon
IDs use `relation/<OSM ID>/<outer ring index>`. Sea polygons follow directed OSM
coastlines and close on the dataset bounding rectangle; `sourceWayIds` identifies
the original coast ways. Extensive land-cover polygons are clipped to that rectangle.

OSM coverage varies: absence of a feature means it was not mapped under the queried
tags, not that no feature exists. Parks and vegetation are mapped land-cover areas,
not surveyed individual trees. Building height is the tagged height where available,
or tagged floor count multiplied by 3.2 meters; unknown height remains `null`.
There are no surveyed facade textures, building models or ground elevations here.
Projection, source-outline age and alignment with telemetry can affect apparent
placement. The source outline for Madrid can predate construction of the circuit.
`coverage.incompleteRelations` records any multipolygon that could not be assembled.
The fetch timestamp is not an assertion that every mapped feature is up to date.

## Included features

| Circuit | Buildings | Water | Vegetation | Road lines | Barriers | Circuit facilities | Features with holes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
'''
    OUT.mkdir(exist_ok=True,parents=True)
    (OUT / 'README.md').write_text(text+'\n'.join(rows)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--report-only',action='store_true',help='write dataset coverage README without network access')
    parser.add_argument('circuits',nargs='*',choices=IDS)
    args = parser.parse_args()
    if args.report_only:
        write_report()
        sys.exit(0)
    failed = []
    for cid in args.circuits or IDS:
        try:
            run(cid,args.refresh)
        except Exception as exc:
            failed.append(cid)
            print(cid,str(exc),flush=True)
    write_report()
    if failed:
        print('Missing: '+', '.join(failed))
        sys.exit(1)
