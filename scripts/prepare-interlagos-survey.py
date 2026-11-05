#!/usr/bin/env python3
"""Build a georeferenced RGB LiDAR POINTS GLB; no runtime network requests.

Dependencies: Python 3, numpy, laspy, lazrs, pyproj, scipy, and curl.
  python -m pip install numpy laspy lazrs pyproj scipy
  python scripts/prepare-interlagos-survey.py [--cache /path/to/cache] [--offline]
Source downloads are SHA-256 pinned in public/surveys/br-1940/sources.json.
CC BY-SA 4.0 survey-derived output; this is a point cloud, never a surface mesh.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys

import laspy
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/surveys/br-1940'
MAX_POINTS = 1200000
XY_VOXEL = 1.5
Z_VOXEL = 1.0
BUFFER = 150


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_glb(path, positions, colors):
    position_data = np.asarray(positions, dtype='<f4').tobytes()
    # glTF COLOR_0 is linear. Survey RGB is displayed as sRGB by the official
    # viewer; explicitly remove that transfer function before quantization.
    rgb = colors.astype(np.float32) / 255
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    rgba = np.column_stack([np.rint(linear * 255).astype(np.uint8), np.full(len(colors), 255, dtype=np.uint8)])
    color_data = rgba.tobytes()
    binary = position_data + color_data
    binary += b'\0' * (-len(binary) % 4)
    doc = {
        'asset': {'version': '2.0', 'generator': 'prepare-interlagos-survey.py',
                  'copyright': 'Prefeitura do Município de São Paulo / GeoSampa; adapted under CC BY-SA 4.0'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'Interlagos municipal RGB LiDAR — measured points'}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'COLOR_0': 1}, 'mode': 0}]}],
        'buffers': [{'byteLength': len(binary)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': len(position_data), 'target': 34962},
            {'buffer': 0, 'byteOffset': len(position_data), 'byteLength': len(color_data), 'target': 34962}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3',
             'min': positions.min(axis=0).tolist(), 'max': positions.max(axis=0).tolist()},
            {'bufferView': 1, 'componentType': 5121, 'normalized': True,
             'count': len(positions), 'type': 'VEC4'}],
    }
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * (-len(encoded) % 4)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 12 + 8 + len(encoded) + 8 + len(binary))
                     + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                     + struct.pack('<II', len(binary), 0x004e4942) + binary)


def outline_samples(outline):
    line = np.asarray(outline, dtype=np.float64)
    if not np.array_equal(line[0], line[-1]):
        line = np.concatenate([line, line[:1]])
    lengths = np.sqrt(np.sum(np.diff(line, axis=0) ** 2, axis=1))
    distances = np.concatenate([[0], np.cumsum(lengths)])
    samples = np.arange(0, distances[-1], 2.0)
    return np.stack([np.interp(samples, distances, line[:, 0]),
                     np.interp(samples, distances, line[:, 1])], axis=1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT.parent / 'research-assets/latin-america')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    environment = json.loads((ROOT / 'public/environments/br-1940.json').read_text())
    sources = json.loads((OUT / 'sources.json').read_text())
    origin_lon, origin_lat = environment['origin']
    scale_east = 111320 * math.cos(math.radians(origin_lat))
    scale_north = 111320
    outline = np.asarray(environment['outline'])
    bounds = [outline[:, 0].min() - BUFFER, outline[:, 1].min() - BUFFER,
              outline[:, 0].max() + BUFFER, outline[:, 1].max() + BUFFER]
    inverse = Transformer.from_crs(31983, 4326, always_xy=True)
    reduced = []
    ground_z = []
    statistics = []
    for source in sources:
        path = args.cache / ('MDS_color_' + source['tile'] + '.laz')
        if not path.exists() or digest(path) != source['sha256']:
            if args.offline:
                raise SystemExit(f'Missing or changed source: {path}')
            temporary = path.with_suffix('.part')
            subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                            '--retry', '2', '--connect-timeout', '15', '--max-time', '120',
                            source['url'], '--output', str(temporary)], check=True)
            if digest(temporary) != source['sha256']:
                raise SystemExit(f'Checksum mismatch: {source["tile"]}')
            temporary.replace(path)
        counts = {'tile': source['tile'], 'sourcePoints': 0, 'insideBounds': 0, 'heightRejected': 0,
                  'unclassifiedRejected': 0, 'retainedBeforeGlobalDedup': 0}
        with laspy.open(path) as reader:
            for chunk in reader.chunk_iterator(1000000):
                counts['sourcePoints'] += len(chunk)
                lon, lat = inverse.transform(np.asarray(chunk.x), np.asarray(chunk.y))
                east = (lon - origin_lon) * scale_east
                north = (lat - origin_lat) * scale_north
                height = np.asarray(chunk.z)
                classification = np.asarray(chunk.classification)
                inside = ((east >= bounds[0]) & (east <= bounds[2])
                          & (north >= bounds[1]) & (north <= bounds[3]))
                counts['insideBounds'] += int(inside.sum())
                # Broad absolute bounds remove flight/noise spikes without
                # flattening measured terrain, trees, roofs, or grandstands.
                height_ok = (height >= 700) & (height <= 900)
                counts['heightRejected'] += int((inside & ~height_ok).sum())
                class_ok = np.isin(classification, [2, 5, 6, 19, 20])
                counts['unclassifiedRejected'] += int((inside & height_ok & ~class_ok).sum())
                keep = inside & height_ok & class_ok
                if not keep.any():
                    continue
                # Ground-only reference height; broad sampling bounds memory.
                gz = height[keep & (classification == 2)]
                ground_z.append(gz[::20])
                xyz = np.column_stack([east[keep], height[keep], -north[keep]]).astype(np.float32)
                rgb = (np.column_stack([chunk.red[keep], chunk.green[keep], chunk.blue[keep]])
                       // 256).clip(0, 255).astype(np.uint8)
                grid = np.floor(xyz / [XY_VOXEL, Z_VOXEL, XY_VOXEL]).astype(np.int32)
                _, indices = np.unique(grid, axis=0, return_index=True)
                counts['retainedBeforeGlobalDedup'] += len(indices)
                reduced.append((xyz[indices], rgb[indices], classification[keep][indices] == 2))
        statistics.append(counts)
        print(json.dumps(counts), flush=True)
    positions = np.concatenate([item[0] for item in reduced])
    colors = np.concatenate([item[1] for item in reduced])
    is_ground = np.concatenate([item[2] for item in reduced])
    del reduced
    horizontal_voxel = XY_VOXEL
    while True:
        grid = np.floor(positions / [horizontal_voxel, Z_VOXEL, horizontal_voxel]).astype(np.int32)
        _, indices = np.unique(grid, axis=0, return_index=True)
        if len(indices) <= MAX_POINTS:
            positions, colors, is_ground = positions[indices], colors[indices], is_ground[indices]
            break
        horizontal_voxel += .25
    origin_height = round(float(np.median(np.concatenate(ground_z))), 3)
    positions[:, 1] -= origin_height
    samples = outline_samples(environment['outline'])
    distances, _ = cKDTree(positions[:, [0, 2]]).query(samples * [1, -1])
    ground_distances, _ = cKDTree(positions[is_ground][:, [0, 2]]).query(samples * [1, -1])
    coverage = {'groundOnlyNearestDistanceMetres': {'median': float(np.median(ground_distances)),
                                                          'p95': float(np.percentile(ground_distances, 95)),
                                                          'maximum': float(ground_distances.max()),
                                                          'within5MetresFraction': float((ground_distances <= 5).mean())},
                'retainedGroundPoints': int(is_ground.sum()), 'sampleIntervalMetres': 2, 'samples': len(samples),
                'nearestPointDistanceMetres': {'median': float(np.median(distances)),
                                              'p95': float(np.percentile(distances, 95)),
                                              'maximum': float(distances.max())},
                'within5MetresFraction': float((distances <= 5).mean())}
    if (coverage['within5MetresFraction'] < .99 or distances.max() > 12
            or coverage['groundOnlyNearestDistanceMetres']['within5MetresFraction'] < .99
            or ground_distances.max() > 12):
        raise SystemExit('Incomplete circuit outline coverage: ' + json.dumps(coverage))
    OUT.mkdir(parents=True, exist_ok=True)
    write_glb(OUT / 'survey.glb', positions, colors)
    if (OUT / 'survey.glb').stat().st_size > 20000000:
        raise SystemExit('Survey GLB exceeds 20 MB budget')
    metadata = {
        'version': 1, 'circuitId': 'br-1940', 'kind': 'points', 'url': 'survey.glb',
        'label': 'Interlagos — rilievo LiDAR RGB reale (2017)',
        'pointCount': len(positions), 'bytes': (OUT / 'survey.glb').stat().st_size,
        'sha256': digest(OUT / 'survey.glb'),
        'origin': environment['origin'], 'originElevation': origin_height,
        'sourceCrs': 'EPSG:31983', 'coordinateSystem': 'local east/up/south metres',
        'projection': {'type': 'local-equirectangular', 'eastMetresPerDegree': scale_east,
                       'northMetresPerDegree': scale_north,
                       'formula': 'x=(lon-originLon)*eastMetresPerDegree; y=height-originElevation; z=-(lat-originLat)*northMetresPerDegree'},
        'outline': environment['outline'],
        'bounds': {'min': positions.min(axis=0).tolist(), 'max': positions.max(axis=0).tolist()},
        'source': 'https://download.geosampa.prefeitura.sp.gov.br/',
        'attribution': 'Prefeitura do Município de São Paulo / GeoSampa',
        'license': 'CC-BY-SA-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'licenseEvidence': 'Official portal rel=license links, download-layers panel and divLicenceccbysa footer; LAZ header carries no embedded license.',
        'acquisitionYear': 2017, 'acquisitionDate': None,
        'dateNote': 'Official source grouping MDS 2017; exact flight date unverified. LAS creation2018 and S3 upload2020 are not capture dates.',
        'processing': {'cropBufferMetres': BUFFER, 'horizontalVoxelMetres': horizontal_voxel,
                       'verticalVoxelMetres': Z_VOXEL, 'absoluteHeightRangeMetres': [700, 900],
                       'classifications': [2, 5, 6, 19, 20],
                       'sampling': 'First measured point per spatial voxel; deterministic tile and point order, no generated geometry.',
                       'color': 'Source RGB16 / 256 to sRGB8 (250000-point source sample has all RGB low bytes zero), converted to linear RGBA8 for glTF COLOR_0.',
                       'sourceStatistics': statistics},
        'coverage': coverage,
        'limitations': ['Point cloud, not a photographic surface mesh.',
                       '2017 survey may differ from current buildings, vegetation, and temporary race facilities.',
                       'Nadir survey has occlusion gaps on facades and under roofs; no invented surfaces.',
                       'Absolute survey heights use source datum; apply no unrecorded vertical exaggeration.'],
    }
    (OUT / 'metadata.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'points': len(positions), 'bytes': metadata['bytes'], 'originElevation': origin_height,
                      'bounds': metadata['bounds'], 'coverage': coverage}, indent=2), flush=True)


if __name__ == '__main__':
    main()
