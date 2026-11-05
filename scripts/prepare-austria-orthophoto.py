"""Download/stitch a bounded, licensed basemap.at aerial image of Red Bull Ring.

Requires Python 3 and Pillow: python -m pip install Pillow
Run: python scripts/prepare-austria-orthophoto.py
Public WMTS data: CC BY 4.0, attribution 'Datenquelle: basemap.at' with a link
to https://basemap.at/. No credentials and no runtime imagery requests needed.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import io
import json
import math
import pathlib
import subprocess
import tempfile

from PIL import Image, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/orthophotos'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'f1-austria-orthophoto-cache'
HALF = math.pi * 6378137
TILE_SIZE = 256
SOURCE_URL = 'https://mapsneu.wien.gv.at/basemap/1.0.0/WMTSCapabilities.xml'
TEMPLATE = 'https://maps.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg'


def project(lon, lat):
    return HALF * lon / 180, 6378137 * math.asinh(math.tan(math.radians(lat)))


def pixel_bounds(bbox, zoom):
    west, south = project(bbox[0], bbox[1])
    east, north = project(bbox[2], bbox[3])
    resolution = 2 * HALF / (TILE_SIZE * 2 ** zoom)
    return [math.floor((west + HALF) / resolution), math.floor((HALF - north) / resolution),
            math.ceil((east + HALF) / resolution), math.ceil((HALF - south) / resolution)]


def fetch_tile(tile, offline=False):
    z, x, y = tile
    url = TEMPLATE.format(z=z, x=x, y=y)
    cached = CACHE / f'{z}-{x}-{y}.jpeg'
    if cached.exists():
        content = cached.read_bytes()
    else:
        if offline:
            raise RuntimeError(f'Missing cached tile: {url}')
        result = subprocess.run(['curl', '-fsSL', '--retry', '2', '--retry-delay', '1', '--max-time', '30', url], capture_output=True)
        if result.returncode:
            raise RuntimeError(f'{url}: {result.stderr.decode().strip()}')
        content = result.stdout
        # Do not cache an XML service error or an incomplete JPEG.
        with Image.open(io.BytesIO(content)) as image:
            if image.size != (TILE_SIZE, TILE_SIZE):
                raise RuntimeError(f'Invalid tile size for {url}: {image.size}')
            image.load()
        CACHE.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(content)
    return tile, content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Use existing tile cache only')
    parser.add_argument('--max-size', type=int, default=4096)
    parser.add_argument('--quality', type=int, default=85)
    args = parser.parse_args()
    if not 256 <= args.max_size <= 4096 or not 40 <= args.quality <= 95:
        parser.error('max-size must be 256–4096; quality must be 40–95')
    env = json.loads((ROOT / 'public/environments/at-1969.json').read_text())
    bbox = env['coverage']['bbox']
    zoom = 0
    for candidate in range(1, 20):
        b = pixel_bounds(bbox, candidate)
        if max(b[2] - b[0], b[3] - b[1]) > args.max_size:
            break
        zoom = candidate
    left, top, right, bottom = pixel_bounds(bbox, zoom)
    min_x, min_y = left // TILE_SIZE, top // TILE_SIZE
    max_x, max_y = (right - 1) // TILE_SIZE, (bottom - 1) // TILE_SIZE
    tiles = [(zoom, x, y) for y in range(min_y, max_y + 1) for x in range(min_x, max_x + 1)]
    print(f'Fetching {len(tiles)} public WMTS tiles at zoom {zoom}; output {right-left}×{bottom-top}', flush=True)
    mosaic = Image.new('RGB', ((max_x - min_x + 1) * TILE_SIZE, (max_y - min_y + 1) * TILE_SIZE))
    # Four concurrent requests keep this small bounded AOI gentle on shared WMTS.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fetch_tile, tile, args.offline) for tile in tiles]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            (_, x, y), content = future.result()
            with Image.open(io.BytesIO(content)) as image:
                mosaic.paste(image.convert('RGB'), ((x-min_x)*TILE_SIZE, (y-min_y)*TILE_SIZE))
            if index % 25 == 0 or index == len(tiles):
                print(f'{index}/{len(tiles)} tiles', flush=True)
    image = mosaic.crop((left-min_x*TILE_SIZE, top-min_y*TILE_SIZE, right-min_x*TILE_SIZE, bottom-min_y*TILE_SIZE))
    if max(ImageStat.Stat(image).var) < 25:
        raise RuntimeError('Downloaded mosaic appears blank; refusing to publish it')
    resolution = 2 * HALF / (TILE_SIZE * 2 ** zoom)
    bounds = [left*resolution-HALF, HALF-bottom*resolution, right*resolution-HALF, HALF-top*resolution]
    # Georeferencing covers every circuit vertex and the complete OSM scenery AOI.
    origin_lon, origin_lat = env['origin']
    scale_x = 111320 * math.cos(math.radians(origin_lat))
    for x, y in env['outline']:
        east, north = project(origin_lon+x/scale_x, origin_lat+y/111320)
        if not bounds[0] <= east <= bounds[2] or not bounds[1] <= north <= bounds[3]:
            raise RuntimeError('Orthophoto does not cover the complete circuit outline')
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / 'at-1969.jpg'
    image.save(target, quality=args.quality, optimize=True, progressive=True)
    if target.stat().st_size > 5_000_000:
        raise RuntimeError('Output exceeds 5 MB; rerun with a lower JPEG quality')
    metadata = {
        'url': 'orthophotos/at-1969.jpg',
        'bbox3857': bounds,
        'attribution': 'Datenquelle: basemap.at (CC BY 4.0)',
        'attributionUrl': 'https://basemap.at/',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'sourceUrl': SOURCE_URL,
        'capture': '2022 labels embedded in source imagery. Regional flight metadata at circuit centre: 2022-07-20 (2022260_Zeltweg); exact mosaic-wide acquisition dates are not separately verified.',
        'description': f'Actual aerial orthophotography of the complete Red Bull Ring environment extent; 2D photographed ground, not a photographic 3D mesh. Provider year labels retained. Product-wide source maximum pixel size 29 cm (15 cm in selected regions); this bounded replay texture is sampled at WMTS zoom {zoom}.',
        'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'width': image.width, 'height': image.height,
        'pixels': [image.width, image.height],
        'projection': 'EPSG:3857', 'northUp': True,
        'license': 'CC-BY-4.0',
        'licenseEvidenceUrl': 'https://basemap.at/#nutzungsbedingungen',
        'bbox4326Requested': bbox,
        'tileTemplate': TEMPLATE,
        'tileRange': {'zoom': zoom, 'minX': min_x, 'maxX': max_x, 'minY': min_y, 'maxY': max_y},
        'metresPerPixel3857': resolution,
        'approximateGroundResolutionMeters': [resolution*math.cos(math.radians(origin_lat))]*2,
        'modifications': 'Bounded WMTS tile mosaic cropped to the environment extent and JPEG recompressed; embedded provider year labels preserved.',
        'validation': {'circuitOutlineSamples': len(env['outline']), 'completeEnvironmentExtent': True, 'nonconstantImage': True},
        'bytes': target.stat().st_size,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'preparedWith': 'python scripts/prepare-austria-orthophoto.py',
    }
    (OUT / 'at-1969.source.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'Wrote {target.relative_to(ROOT)}, {image.width}×{image.height}, {target.stat().st_size:,} bytes', flush=True)


if __name__ == '__main__':
    main()
