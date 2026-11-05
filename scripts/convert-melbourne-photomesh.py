#!/usr/bin/env python3
"""Convert the licensed municipal E5-20 OBJ into a georeferenced, atlased GLB.

Offline dependencies: numpy, Pillow, pyproj, rectpack. Supply an extracted source
directory and output directory. Original geometry is retained; textures are
resampled to at most 384 px, packed with gutters, and encoded as JPEG atlases.
No proprietary material or downloaded decoder is required by the resulting GLB.
"""
import argparse
import hashlib
import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer
from rectpack import newPacker


def convert(source: Path, destination: Path):
    destination.mkdir(parents=True, exist_ok=True)
    origin = [144.97036026712328, -37.845938767123286]
    atlas_size, max_texture, gutter = 4096, 384, 3
    materials = {}
    active = None
    for line in (source / 'E5-20.mtl').read_text().splitlines():
        if line.startswith('newmtl '):
            active = line.split()[1]
        elif line.startswith('map_Kd '):
            materials[active] = line.split(maxsplit=1)[1]
    names = sorted(materials)
    material_id = {name: i for i, name in enumerate(names)}
    sizes = []
    packer = newPacker(rotation=False)
    for i, name in enumerate(names):
        with Image.open(source / materials[name]) as im:
            scale = min(1, max_texture / max(im.size))
            size = tuple(max(1, round(n * scale)) for n in im.size)
        sizes.append(size)
        packer.add_rect(size[0] + gutter * 2, size[1] + gutter * 2, rid=i)
    packer.add_bin(atlas_size, atlas_size, count=20)
    packer.pack()
    rectangles = packer.rect_list()
    assert len(rectangles) == len(names), 'Every source image must be packed'
    placement = {rid: (b, x + gutter, y + gutter, sizes[rid][0], sizes[rid][1])
                 for b, x, y, w, h, rid in rectangles}
    atlas_count = max(p[0] for p in placement.values()) + 1
    atlas_jpegs = []
    for b in range(atlas_count):
        canvas = Image.new('RGB', (atlas_size, atlas_size))
        for rid, (which, x, y, w, h) in placement.items():
            if which != b:
                continue
            with Image.open(source / materials[names[rid]]) as image:
                image = image.convert('RGB').resize((w, h), Image.Resampling.LANCZOS)
            # Extend border pixels, preventing black seams with mipmapping.
            border = Image.new('RGB', (w + 2*gutter, h + 2*gutter))
            border.paste(image, (gutter, gutter))
            border.paste(image.crop((0, 0, w, 1)).resize((w, gutter)), (gutter, 0))
            border.paste(image.crop((0, h-1, w, h)).resize((w, gutter)), (gutter, h+gutter))
            border.paste(border.crop((gutter, 0, gutter+1, h+2*gutter)).resize((gutter, h+2*gutter)), (0, 0))
            border.paste(border.crop((w+gutter-1, 0, w+gutter, h+2*gutter)).resize((gutter, h+2*gutter)), (w+gutter, 0))
            canvas.paste(border, (x-gutter, y-gutter))
        encoded = io.BytesIO()
        canvas.save(encoded, format='JPEG', quality=84, optimize=True, subsampling=2)
        atlas_jpegs.append(encoded.getvalue())
    print(f'Packed {len(names)} textures into {atlas_count} atlases', flush=True)

    vertices, texcoords, face_vertices, face_uvs, face_materials = [], [], [], [], []
    active_id = None
    with (source / 'E5-20.obj').open() as f:
        for line in f:
            if line.startswith('v '):
                vertices.append(tuple(map(float, line.split()[1:4])))
            elif line.startswith('vt '):
                texcoords.append(tuple(map(float, line.split()[1:3])))
            elif line.startswith('usemtl '):
                active_id = material_id[line.split()[1]]
            elif line.startswith('f '):
                corners = [c.split('/') for c in line.split()[1:]]
                assert len(corners) == 3 and active_id is not None
                face_vertices.append([int(c[0])-1 for c in corners])
                face_uvs.append([int(c[1])-1 for c in corners])
                face_materials.append(active_id)
    vertices = np.array(vertices, dtype=np.float64)
    source_bounds = [vertices.min(axis=0).tolist(), vertices.max(axis=0).tolist()]
    # The official index identifies EPSG:7855 (GDA2020 / MGA zone 55).
    # The environment uses a documented
    # equirectangular map, not a rotated UTM tangent frame; match it exactly.
    transform = Transformer.from_crs('EPSG:7855', 'EPSG:4326', always_xy=True)
    lon, lat = transform.transform(vertices[:, 0], vertices[:, 1])
    local = np.column_stack(((lon-origin[0])*111320*math.cos(math.radians(origin[1])),
                             vertices[:, 2], -(lat-origin[1])*111320))
    minimum, maximum = local.min(axis=0), local.max(axis=0)
    extent = maximum - minimum
    quantized = np.rint((local-minimum) / extent * 65535).astype('<u2')
    restored = quantized.astype(np.float64) / 65535 * extent + minimum
    max_error = float(np.linalg.norm(restored-local, axis=1).max())
    face_vertices = np.asarray(face_vertices, dtype=np.int32)
    face_uvs = np.asarray(face_uvs, dtype=np.int32)
    face_materials = np.asarray(face_materials, dtype=np.int32)
    texcoords = np.asarray(texcoords, dtype=np.float64)
    invalid_uvs = ~np.isfinite(texcoords).all(axis=1)
    invalid_uv_count = int(invalid_uvs.sum())
    # CloudCompare's export has a small number of literal NaN UVs. They have
    # no meaningful source image coordinate; retain geometry with a fixed UV.
    texcoords[invalid_uvs] = 0.5
    assert texcoords.min() >= -1e-6 and texcoords.max() <= 1.000001
    print(f'{len(vertices)} vertices; {len(face_vertices)} triangles; local bounds {minimum} / {maximum}', flush=True)

    doc = {'asset': {'version': '2.0', 'generator': 'Pitwall municipal photomesh converter',
                     'copyright': 'City of Melbourne — CC BY 4.0'},
           'extensionsUsed': ['KHR_mesh_quantization', 'KHR_materials_unlit'],
           'extensionsRequired': ['KHR_mesh_quantization'],
           'scene': 0, 'scenes': [{'nodes': [0]}],
           'nodes': [{'name': 'City of Melbourne Photomesh 2020 E5-20 — nearby context',
                      'mesh': 0, 'translation': minimum.tolist(), 'scale': extent.tolist()}],
           'meshes': [{'primitives': []}], 'materials': [], 'textures': [], 'images': [],
           'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
           'accessors': [], 'bufferViews': [], 'buffers': [{}]}
    blob = bytearray()

    def view(data, target=None):
        while len(blob) % 4:
            blob.append(0)
        definition = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)}
        if target:
            definition['target'] = target
        idx = len(doc['bufferViews'])
        doc['bufferViews'].append(definition)
        blob.extend(data)
        return idx

    def accessor(data, component, shape, normalized=False):
        definition = {'bufferView': view(data.tobytes(), 34963 if shape == 'SCALAR' else 34962),
                      'componentType': component, 'count': len(data), 'type': shape}
        if normalized:
            definition['normalized'] = True
        if shape == 'VEC3':
            definition['min'] = data.min(axis=0).tolist()
            definition['max'] = data.max(axis=0).tolist()
        doc['accessors'].append(definition)
        return len(doc['accessors'])-1

    # Separate geometry only at atlas boundaries, reducing 547 source material
    # groups to a handful of draws. Position+UV welding is lossless after the
    # stated quantization; triangle count/order within each atlas is retained.
    material_bins = np.array([placement[i][0] for i in range(len(names))])
    output_vertices = 0
    for b in range(atlas_count):
        selected = material_bins[face_materials] == b
        ids = face_materials[selected].repeat(3)
        pos = quantized[face_vertices[selected].ravel()]
        uv = texcoords[face_uvs[selected].ravel()].copy()
        coords = np.array([placement[i][1:] for i in ids])
        uv[:, 0] = (coords[:, 0] + uv[:, 0]*coords[:, 2])/atlas_size
        uv[:, 1] = (coords[:, 1] + (1-uv[:, 1])*coords[:, 3])/atlas_size
        uv = np.rint(uv*65535).astype('<u2')
        combined = np.column_stack((pos, uv)).astype('<u2')
        welded, indices = np.unique(combined, axis=0, return_inverse=True)
        output_vertices += len(welded)
        # Six-byte positions need an eight-byte vertex stride for glTF's
        # four-byte attribute alignment. UVs are in their own packed stream.
        padded_pos = np.zeros((len(welded), 4), dtype='<u2')
        padded_pos[:, :3] = welded[:, :3]
        pos_view = view(padded_pos.tobytes(), 34962)
        doc['bufferViews'][pos_view]['byteStride'] = 8
        pos_accessor = len(doc['accessors'])
        doc['accessors'].append({'bufferView': pos_view, 'componentType': 5123,
                                 'count': len(welded), 'type': 'VEC3', 'normalized': True,
                                 'min': welded[:, :3].min(axis=0).tolist(),
                                 'max': welded[:, :3].max(axis=0).tolist()})
        uv_accessor = accessor(welded[:, 3:].copy(), 5123, 'VEC2', normalized=True)
        index_accessor = accessor(indices.astype('<u4'), 5125, 'SCALAR')
        doc['meshes'][0]['primitives'].append({'attributes': {'POSITION': pos_accessor, 'TEXCOORD_0': uv_accessor},
                                             'indices': index_accessor, 'material': b})
        doc['images'].append({'bufferView': view(atlas_jpegs[b]), 'mimeType': 'image/jpeg'})
        doc['textures'].append({'sampler': 0, 'source': b})
        doc['materials'].append({'name': f'Photographic atlas {b+1}', 'doubleSided': True,
                                 'pbrMetallicRoughness': {'baseColorTexture': {'index': b},
                                                          'metallicFactor': 0, 'roughnessFactor': 1},
                                 'extensions': {'KHR_materials_unlit': {}}})

    while len(blob) % 4:
        blob.append(0)
    doc['buffers'][0]['byteLength'] = len(blob)
    metadata = json.dumps(doc, separators=(',', ':'), ensure_ascii=True).encode()
    metadata += b' ' * (-len(metadata) % 4)
    glb = struct.pack('<III', 0x46546c67, 2, 12+8+len(metadata)+8+len(blob))
    glb += struct.pack('<II', len(metadata), 0x4e4f534a)+metadata
    glb += struct.pack('<II', len(blob), 0x004e4942)+blob
    output = destination / 'context.glb'
    output.write_bytes(glb)
    source_manifest = source.parents[1] / 'E5-20-manifest.json'
    if not source_manifest.exists():
        source_manifest = destination / 'manifest.json'
    manifest = json.loads(source_manifest.read_text())
    manifest.update({'assetUrl': '/surveys/au-1953/context.glb', 'format': 'glTF 2.0 GLB',
                     'kind': 'texturedMesh', 'origin': origin, 'axes': 'x east, y up, z south',
                     'units': 'metres', 'verticalDatum': 'AHD', 'altitudeOffsetMetres': 0,
                     'sourceCrs': 'EPSG:7855 (GDA2020 / MGA zone 55), per official OBJ tile index',
                     'sourceCrsEvidenceUrl': 'https://services1.arcgis.com/KGdHCCUjGBpOPPac/arcgis/rest/services/Photomesh_2020_OBJ_Grid/FeatureServer/0?f=json',
                     'projection': 'x=(lon-originLon)*111320*cos(originLat); z=-(lat-originLat)*111320; y=AHD elevation',
                     'localBounds': {'min': minimum.tolist(), 'max': maximum.tolist()},
                     'sourceVertexBounds': source_bounds, 'triangles': len(face_vertices),
                     'outputVertices': output_vertices, 'drawCalls': atlas_count,
                     'atlasSize': atlas_size, 'textureMaxDimension': max_texture,
                     'atlasCount': atlas_count, 'textureJpegQuality': 84,
                     'textureJpegChromaSubsampling': '4:2:0',
                     'sourceNonfiniteUvCount': invalid_uv_count,
                     'maximumGeometryQuantizationErrorMetres': max_error,
                     'geometryPrecisionNote': 'Submillimetre source slivers can collapse under uint16 position quantization; all source triangle entries are retained.',
                     'assetBytes': len(glb), 'assetSha256': hashlib.sha256(glb).hexdigest(),
                     'modifications': 'Reprojected MGA55 to geographic then environment local frame; preserved all triangles; positions and UVs quantized to uint16; source NaN UVs assigned image centre; photographic textures downsampled to max 384px, atlased with gutters and JPEG reencoded; unlit photographic materials.',
                     'coverageNotice': 'Nearby context sample only. E5-20 does not intersect the Albert Park racing line.'})
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (destination / 'ATTRIBUTION.txt').write_text(
        'City of Melbourne, City of Melbourne 3D Textured Mesh (Photomesh) 2020, tile E5-20.\n'
        'Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).\n'
        'https://creativecommons.org/licenses/by/4.0/\n'
        'Source: https://data.melbourne.vic.gov.au/explore/dataset/city-of-melbourne-3d-textured-mesh-photomesh-2020/\n'
        'Modifications: georeferenced local conversion, geometry/UV quantization, photographic texture resampling and atlasing.\n'
        'Nearby Melbourne context only; this tile does not cover the Albert Park circuit.\n')
    print(json.dumps({k: manifest[k] for k in ['assetBytes', 'assetSha256', 'triangles', 'outputVertices', 'drawCalls', 'localBounds', 'maximumGeometryQuantizationErrorMetres']}, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    convert(args.source, args.destination)
