"""Build compact geographic DEM grids from public Mapzen/Tilezen elevation tiles.

Run: python scripts/fetch-terrain.py [--offline] [circuit-id ...]
The browser uses the resulting JSON only; tile downloads happen at build time.
Source HGT samples are signed, big-endian metres, north-to-south row order.
See public/terrain/README.md and upstream attribution for contributing datasets.
"""
import argparse
import array
import datetime
import functools
import gzip
import hashlib
import json
import math
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/terrain'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'f1-terrain-cache'
ENV_CACHE = pathlib.Path(tempfile.gettempdir()) / 'f1-environments-cache'
IDS = ['bh-2002', 'sa-2021', 'au-1953', 'jp-1962', 'cn-2004', 'us-2022', 'it-1953', 'mc-1929', 'es-2026', 'es-1991', 'ca-1978', 'at-1969', 'gb-1948', 'hu-1986', 'be-1925', 'nl-1948', 'it-1922', 'az-2016', 'sg-2008', 'us-2012', 'mx-1962', 'br-1940', 'us-2023', 'qa-2004', 'ae-2009']
BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/skadi'
ATTRIBUTION_URL = 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md'
VOID = -32768


def download(url, filename, offline=False):
    if filename.exists():
        return filename.read_bytes()
    if offline:
        raise RuntimeError(f'Not cached: {url}')
    result = subprocess.run(['curl', '--retry', '2', '--retry-delay', '2', '--max-time', '90', '-fsSL', url], capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode().strip())
    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_bytes(result.stdout)
    return result.stdout


def outline(cid, offline=False):
    """Reuse the exact environment outline/projection when already available."""
    existing = ROOT / f'public/environments/{cid}.json'
    source = f'https://github.com/bacinger/f1-circuits/blob/master/circuits/{cid}.geojson'
    if existing.exists():
        env = json.loads(existing.read_text())
        lon, lat = env['origin']
        sx = 111320 * math.cos(math.radians(lat))
        geographic = [[lon + x / sx, lat + y / 111320] for x, y in env['outline']]
        return env['origin'], env['outline'], geographic, source
    url = f'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/{cid}.geojson'
    hashed = hashlib.sha256(url.encode()).hexdigest()
    previous = ENV_CACHE / hashed
    raw = json.loads(previous.read_bytes() if previous.exists() else download(url, CACHE / hashed, offline))
    line = raw['features'][0]['geometry']['coordinates']
    lon = sum(p[0] for p in line) / len(line)
    lat = sum(p[1] for p in line) / len(line)
    sx = 111320 * math.cos(math.radians(lat))
    local = [[round((p[0] - lon) * sx, 2), round((p[1] - lat) * 111320, 2)] for p in line]
    return [lon, lat], local, line, source


def tile_name(south, west):
    return f'{"N" if south >= 0 else "S"}{abs(south):02d}{"E" if west >= 0 else "W"}{abs(west):03d}'


def tile_url(south, west):
    name = tile_name(south, west)
    return f'{BASE}/{name[:3]}/{name}.hgt.gz'


@functools.lru_cache(maxsize=4)
def load_tile(south, west, offline=False):
    name = tile_name(south, west)
    compressed = download(tile_url(south, west), CACHE / f'{name}.hgt.gz', offline)
    data = gzip.decompress(compressed)
    size = math.isqrt(len(data) // 2)
    if len(data) != size * size * 2 or size not in (1201, 3601):
        raise RuntimeError(f'Unexpected HGT dimensions for {name}: {len(data)} bytes')
    values = array.array('h')
    values.frombytes(data)
    if sys.byteorder == 'little':
        values.byteswap()
    return values, size


def sample(lon, lat, offline=False):
    south, west = math.floor(lat), math.floor(lon)
    values, size = load_tile(south, west, offline)
    col = min(size - 1, max(0, (lon - west) * (size - 1)))
    row = min(size - 1, max(0, (south + 1 - lat) * (size - 1)))
    x, y = min(math.floor(col), size - 2), min(math.floor(row), size - 2)
    tx, ty = col - x, row - y
    weighted = weight = 0.0
    for dx, dy, w in [(0, 0, (1-tx)*(1-ty)), (1, 0, tx*(1-ty)), (0, 1, (1-tx)*ty), (1, 1, tx*ty)]:
        h = values[(y + dy) * size + x + dx]
        if h != VOID and w > 0:
            weighted += h * w
            weight += w
    # Preserve true missing data rather than inventing a height or replacing it
    # with sea level. Rendering can fall back to measured track relief there.
    return round(weighted / weight, 1) if weight else None


def bounds(geographic, margin, latitude):
    dy = margin / 111320
    dx = margin / (111320 * math.cos(math.radians(latitude)))
    return [min(p[0] for p in geographic) - dx, min(p[1] for p in geographic) - dy,
            max(p[0] for p in geographic) + dx, max(p[1] for p in geographic) + dy]


def required_tiles(bbox):
    west, south, east, north = bbox
    return [(lat, lon) for lat in range(math.floor(south), math.floor(north) + 1)
            for lon in range(math.floor(west), math.floor(east) + 1)]


def build(cid, args):
    origin, local, geographic, outline_source = outline(cid, args.offline)
    bbox = bounds(geographic, args.margin, origin[1])
    tiles = required_tiles(bbox)
    if args.list_tiles:
        for south, west in tiles:
            print(tile_url(south, west))
        return
    target = OUT / f'{cid}.json'
    if target.exists() and not args.refresh:
        print(f'{cid}: already present', flush=True)
        return
    west, south, east, north = bbox
    heights = [sample(west + (east-west) * col / (args.size-1), north - (north-south) * row / (args.size-1), args.offline)
               for row in range(args.size) for col in range(args.size)]
    valid = [h for h in heights if h is not None]
    if not valid:
        raise RuntimeError(f'{cid}: no valid DEM samples in requested extent')
    result = {
        'version': 1, 'circuitId': cid, 'origin': origin, 'outline': local,
        'bbox': bbox, 'width': args.size, 'height': args.size,
        'heights': heights, 'units': 'metres', 'rowOrder': 'north-to-south',
        'source': 'Mapzen / Tilezen elevation tiles',
        'sourceTiles': [tile_url(lat, lon) for lat, lon in tiles],
        'attribution': 'Mapzen terrain tiles, derived from contributing elevation datasets; see attribution URL',
        'attributionUrl': ATTRIBUTION_URL,
        'license': 'Multiple source licenses; see attributionUrl',
        'outlineSource': outline_source, 'outlineLicense': 'MIT',
        'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sampling': {'method': 'bilinear', 'marginMetres': args.margin, 'voidValue': None},
        'stats': {'min': min(valid), 'max': max(valid), 'noData': len(heights)-len(valid)},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, separators=(',', ':'), allow_nan=False) + '\n')
    print(f'{cid}: {args.size}×{args.size}, {min(valid):.1f}…{max(valid):.1f} m, {len(heights)-len(valid)} voids', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('circuits', nargs='*', choices=IDS)
    parser.add_argument('--offline', action='store_true', help='Require downloaded tile/outline caches; never make network requests')
    parser.add_argument('--refresh', action='store_true', help='Rebuild output grids using the cached source tiles')
    parser.add_argument('--list-tiles', action='store_true', help='Print source tile URLs without downloading elevation')
    parser.add_argument('--size', type=int, default=65)
    parser.add_argument('--margin', type=float, default=1100)
    args = parser.parse_args()
    if args.size < 2 or args.margin < 0:
        parser.error('size must be at least 2 and margin cannot be negative')
    failures = []
    for cid in args.circuits or IDS:
        try:
            build(cid, args)
        except Exception as exc:
            print(f'{cid}: {exc}', file=sys.stderr, flush=True)
            failures.append(cid)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
