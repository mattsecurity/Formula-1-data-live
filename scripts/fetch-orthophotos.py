"""Bundle openly licensed photographic ground imagery for four F1 circuits.

Requires Python 3 and Pillow. Run: python scripts/fetch-orthophotos.py [--refresh]
Requests bounded WMS tiles, caches responses in /tmp, and stitches a georeferenced
JPEG at a 4096px longest edge. Imagery is 2D photography, not facade/3D mesh data.
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
import urllib.parse
from PIL import Image, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/orthophotos'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'f1-orthophotos-cache'
LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
SOURCES = {
    'nl-1948': {
        'sourceUrl': 'https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0',
        'layer': '2025_orthoHR', 'capture': '2025 winter aerial campaign',
        'attribution': 'Luchtfoto 2025 © Beeldmateriaal / PDOK, CC BY 4.0',
        'licenseEvidenceUrl': 'https://www.pdok.nl/introductie/-/article/pdok-luchtfoto-rgb-open-',
        'nativeResolutionMeters': [0.05, 0.08],
        'nativeResolutionNote': 'National 2025 winter product uses 5 or 8cm; local acquisition GSD is not distinguished by this layer.',
    },
    'es-1991': {
        'sourceUrl': 'https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms',
        'layer': 'ortofoto_25cm_color_2025', 'capture': '2025 aerial campaign',
        'attribution': 'Ortofoto Territorial 2025 © ICGC, CC BY 4.0',
        'licenseEvidenceUrl': 'https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Imatge/Ortofoto-Territorial',
        'nativeResolutionMeters': 0.25,
    },
    'it-1953': {
        'sourceUrl': 'https://servizigis.regione.emilia-romagna.it/wms/rer2022_rgb',
        'layer': 'RER2022_RGB', 'capture': '2022-03 (Imola pilot survey)',
        'attribution': 'Ortofoto RER 2022 © Regione Emilia-Romagna / CGR, CC BY 4.0',
        'licenseEvidenceUrl': 'https://geoportale.regione.emilia-romagna.it/catalogo/dati-cartografici/cartografia-di-base/immagini/layer-10',
        'captureEvidenceUrl': 'https://geoportale.regione.emilia-romagna.it/approfondimenti/prodotti-lidar-e-ortofoto',
        'nativeResolutionMeters': 0.20,
    },
    'es-2026': {
        'showTrackOverlay': True,
        'sourceUrl': 'https://www.ign.es/wms-inspire/pnoa-ma',
        'layer': 'OI.OrthoimageCoverage', 'capture': 'PNOA maximum actuality mosaic; metadata queried during download',
        'attribution': 'PNOA © Instituto Geográfico Nacional de España, CC BY 4.0 scne.es',
        'licenseEvidenceUrl': 'https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf',
        'nativeResolutionMeters': None,
    },
}
IMOLA_COMPLEMENT = {
    'sourceUrl': 'https://servizigis.regione.emilia-romagna.it/wms/rer2023_24_rgb',
    'layer': 'RER2023_24_RGB', 'capture': '2023–24 aerial campaign',
    'attribution': 'Ortofoto RER 2023–24 © Regione Emilia-Romagna, CC BY 4.0',
    'licenseUrl': LICENSE,
    'licenseEvidenceUrl': 'https://geoportale.regione.emilia-romagna.it/catalogo/dati-cartografici/cartografia-di-base/immagini/layer-14',
    'nativeResolutionMeters': 0.20,
}


def download(url, refresh=False):
    CACHE.mkdir(exist_ok=True, parents=True)
    path = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if refresh or not path.exists():
        result = subprocess.run(['curl', '--connect-timeout', '10', '--max-time', '45',
                                 '--compressed', '-LfsS', url], capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.decode().strip())
        path.write_bytes(result.stdout)
    return path.read_bytes(), datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat()


def mercator(lon, lat):
    return [6378137 * math.radians(lon),
            6378137 * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))]


def pnoa_metadata(source, bbox, refresh):
    west, south, east, north = bbox
    points = [[(west+east)/2, (south+north)/2], [west+.0001,south+.0001],
              [east-.0001,south+.0001], [west+.0001,north-.0001], [east-.0001,north-.0001]]
    samples = []
    for lon, lat in points:
        query = {'SERVICE':'WMS', 'VERSION':'1.1.1', 'REQUEST':'GetFeatureInfo',
                 'LAYERS':'OI.MosaicElement', 'QUERY_LAYERS':'OI.MosaicElement',
                 'STYLES':'', 'SRS':'EPSG:4326',
                 'BBOX':f'{lon-.00005},{lat-.00005},{lon+.00005},{lat+.00005}',
                 'WIDTH':100, 'HEIGHT':100, 'X':50, 'Y':50, 'FORMAT':'image/jpeg',
                 'INFO_FORMAT':'application/json', 'FEATURE_COUNT':5}
        url = source['sourceUrl'] + '?' + urllib.parse.urlencode(query)
        raw, _ = download(url, refresh)
        properties = [f['properties'] for f in json.loads(raw).get('features', [])]
        samples.append({'coordinate4326':[lon,lat], 'properties':properties, 'sourceUrl':url})
    return samples


def fetch(cid, source, refresh):
    environment = json.loads((ROOT / 'public/environments' / (cid+'.json')).read_text())
    bbox = environment['coverage']['bbox']
    box = mercator(*bbox[:2]) + mercator(*bbox[2:])
    extent_width, extent_height = box[2]-box[0], box[3]-box[1]
    factor = 4096 / max(extent_width, extent_height)
    width, height = round(extent_width * factor), round(extent_height * factor)
    image = Image.new('RGB', (width,height))
    requests = []
    complement_pixels = 0
    for y in range(0,height,2048):
        for x in range(0,width,2048):
            tile_width, tile_height = min(2048,width-x), min(2048,height-y)
            # Pixel row zero is north. Subextents share the full image pixel grid.
            tile_bbox = [box[0]+extent_width*x/width,
                         box[3]-extent_height*(y+tile_height)/height,
                         box[0]+extent_width*(x+tile_width)/width,
                         box[3]-extent_height*y/height]
            query = {'SERVICE':'WMS', 'VERSION':'1.1.1', 'REQUEST':'GetMap',
                     'LAYERS':source['layer'], 'STYLES':'', 'SRS':'EPSG:3857',
                     'BBOX':','.join(map(str,tile_bbox)), 'WIDTH':tile_width,
                     'HEIGHT':tile_height, 'FORMAT':'image/jpeg'}
            if cid == 'it-1953':
                query.update(FORMAT='image/png',TRANSPARENT='TRUE')
            url = source['sourceUrl'] + '?' + urllib.parse.urlencode(query)
            raw, fetched_at = download(url, refresh)
            tile = Image.open(io.BytesIO(raw)).convert('RGBA' if cid == 'it-1953' else 'RGB')
            if tile.size != (tile_width,tile_height):
                raise RuntimeError(f'{cid}: wrong WMS image dimensions {tile.size}')
            if cid == 'it-1953' and tile.getchannel('A').getextrema()[0] < 255:
                alpha_histogram = tile.getchannel('A').histogram()
                complement_pixels += alpha_histogram[0]
                fallback_query = dict(query,LAYERS=IMOLA_COMPLEMENT['layer'])
                fallback_url = IMOLA_COMPLEMENT['sourceUrl'] + '?' + urllib.parse.urlencode(fallback_query)
                fallback_raw, fallback_at = download(fallback_url,refresh)
                fallback = Image.open(io.BytesIO(fallback_raw)).convert('RGBA')
                if fallback.size != tile.size:
                    raise RuntimeError('Imola complementary image has wrong dimensions')
                tile = Image.alpha_composite(fallback,tile)
                if tile.getchannel('A').getextrema()[0] != 255:
                    raise RuntimeError('Imola source union still leaves uncovered pixels')
                requests.append({'url':fallback_url,'layer':IMOLA_COMPLEMENT['layer'],
                                 'purpose':'fill declared transparent no-data in RER2022',
                                 'bbox3857':tile_bbox,'pixelOffset':[x,y],
                                 'pixels':[tile_width,tile_height],'fetchedAt':fallback_at,
                                 'sha256':hashlib.sha256(fallback_raw).hexdigest()})
            tile = tile.convert('RGB')
            if max(ImageStat.Stat(tile).var) < 1:
                raise RuntimeError(f'{cid}: blank/constant source tile at {x},{y}')
            image.paste(tile,(x,y))
            requests.append({'url':url, 'bbox3857':tile_bbox, 'pixelOffset':[x,y],
                             'layer':source['layer'],
                             'pixels':[tile_width,tile_height], 'fetchedAt':fetched_at,
                             'sha256':hashlib.sha256(raw).hexdigest()})
    record = dict(source)
    if complement_pixels:
        record.update(additionalSources=[IMOLA_COMPLEMENT],
                      capture='2022-03 Imola survey; 2023–24 imagery fills its surrounding no-data',
                      attribution='Ortofoto RER 2022 / 2023–24 © Regione Emilia-Romagna / CGR, CC BY 4.0',
                      complementaryCoverageFraction=complement_pixels/(width*height))
    if cid == 'es-2026':
        samples = pnoa_metadata(source,bbox,refresh)
        record['captureMetadataSamples'] = samples
        dates = sorted({f['Fecha'] for sample in samples for f in sample['properties'] if f.get('Fecha')})
        resolutions = sorted({float(f['Resolucion']) for sample in samples for f in sample['properties'] if f.get('Resolucion')})
        record['capture'] = ', '.join(dates) + ' (verified at center and four bbox corners)' if dates else source['capture']
        record['nativeResolutionMeters'] = resolutions[0] if len(resolutions)==1 else resolutions or None
        record['attribution'] = f"Obra derivada de PNOA {' / '.join(dates)} CC BY 4.0 scne.es (IGN)"
    destination = OUT / (cid+'.jpg')
    image.save(destination,format='JPEG',quality=85,optimize=True,progressive=True)
    # Reject unexpected unfilled borders, and sample all geographic circuit points
    # for no-data. Bright paved surfaces are valid; black near-zero pixels are not.
    outline_samples = []
    origin_lon, origin_lat = environment['origin']
    sx = 111320 * math.cos(math.radians(origin_lat))
    for east_m,north_m in environment['outline']:
        lon,lat = origin_lon+east_m/sx, origin_lat+north_m/111320
        mx,my = mercator(lon,lat)
        px,py = round((mx-box[0])/extent_width*(width-1)), round((box[3]-my)/extent_height*(height-1))
        pixel = image.getpixel((min(width-1,max(0,px)),min(height-1,max(0,py))))
        outline_samples.append(max(pixel) <= 3)
    black_on_outline = sum(outline_samples)/len(outline_samples)
    if black_on_outline > .02:
        raise RuntimeError(f'{cid}: {black_on_outline:.1%} of circuit outline samples have no-data pixels')
    center_lat = (bbox[1]+bbox[3])/2
    resolution_projected = [extent_width/width,extent_height/height]
    record.update(url=f'orthophotos/{cid}.jpg',bbox4326=bbox,bbox3857=box,
                  license='CC-BY-4.0',licenseUrl=LICENSE,pixels=[width,height],
                  projection='EPSG:3857',northUp=True,
                  jpegQuality=85,
                  pixelSize3857Meters=resolution_projected,
                  approximateGroundResolutionMeters=[r*math.cos(math.radians(center_lat)) for r in resolution_projected],
                  description='Foto aerea ortorettificata del circuito e dei dintorni.' if cid != 'es-2026' else 'Foto aerea dell’area di Madrid del luglio 2023, precedente al circuito. Tracciato sovrapposto indicativo.',
                  assetType='photographic ground orthophoto',
                  limitations='2D ground and roof photography; no photographic facades or 3D mesh.',
                  modifications='Cropped to circuit environment bbox; resampled to working LOD; stitched and JPEG recompressed.',
                  bytes=destination.stat().st_size,sha256=hashlib.sha256(destination.read_bytes()).hexdigest(),
                  preparedWith='python scripts/fetch-orthophotos.py',
                  sourceRequests=requests,validation={'circuitOutlineSamples':len(outline_samples),
                  'noDataOutlineFraction':black_on_outline,'allSourceTilesNonconstant':True,
                  'sourceAlphaCoversFullBbox':True if cid=='it-1953' else None})
    print(f'{cid}: {width}x{height}, {record["bytes"]:,} bytes, ground {record["approximateGroundResolutionMeters"][0]:.3f}m/px, no-data circuit {black_on_outline:.1%}',flush=True)
    return cid,record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh',action='store_true',help='bypass source response cache')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True,parents=True)
    circuits = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fetch,cid,source,args.refresh) for cid,source in SOURCES.items()]
        for future in concurrent.futures.as_completed(futures):
            cid,record = future.result()
            circuits[cid] = record
    total = sum(x['bytes'] for x in circuits.values())
    if total > 15_000_000:
        raise RuntimeError(f'Imagery payload exceeds 15MB budget: {total} bytes')
    # Preserve independently supplied sources (e.g. Austria) when regenerating.
    existing_path = OUT/'manifest.json'
    existing = json.loads(existing_path.read_text()).get('circuits',{}) if existing_path.exists() else {}
    for path in OUT.glob('*.source.json'):
        cid = path.name.removesuffix('.source.json')
        if cid not in SOURCES:
            existing[cid] = json.loads(path.read_text())
    combined = {cid:circuits[cid] for cid in SOURCES}
    combined.update({cid:value for cid,value in existing.items() if cid not in SOURCES})
    manifest = {'version':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'circuits':combined,'totalImageBytes':sum(x['bytes'] for x in combined.values()),
                'managedImageBytes':total}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'Complete: {len(circuits)} photographic ground textures, {total:,} bytes',flush=True)
