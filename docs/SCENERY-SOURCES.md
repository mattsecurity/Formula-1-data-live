# 3D scenery sources and limitations

## Bundled PBR textures

The following material maps were downloaded from [Poly Haven](https://polyhaven.com/).
Poly Haven publishes these assets under [CC0](https://polyhaven.com/license), permitting
redistribution and modification. These credits record their provenance even though
attribution is not required by CC0.

| Asset | Source | Use |
| --- | --- | --- |
| `asphalt_02` | https://polyhaven.com/a/asphalt_02 | Track asphalt |
| `aerial_grass_rock` | https://polyhaven.com/a/aerial_grass_rock | Grass / natural ground |
| `aerial_beach_01` | https://polyhaven.com/a/aerial_beach_01 | Sand / gravel-like runoff |

Each material includes the original 1024 × 1024 JPEG diffuse (`*-color.jpg`),
OpenGL tangent-space normal (`*-normal.jpg`, Poly Haven `nor_gl`) and roughness
(`*-roughness.jpg`) maps in `public/textures/`. Color and normal files are RGB;
roughness files are grayscale. Individual photographer names and the source
capture's physical dimensions have not been independently verified here; refer
to the linked asset pages for current contributor and capture metadata. The
renderer's texture repetition is a visual scale choice, not a surveyed measure.

The nine images were validated locally with Pillow's JPEG verification. Their
SHA-256 digests are pinned in `public/textures/manifest.json`.

```sh
python3 scripts/fetch-textures.py --check  # offline integrity check
python3 scripts/fetch-textures.py          # restore missing / changed maps
```

Restoration requires `curl` and network access. The script uses the official
`https://api.polyhaven.com/files/{asset}` metadata endpoint to discover the 1K
JPEG download URLs and checks each transfer against the pinned checksum before
replacing a local image. Valid cached files are reused. A changed upstream file
fails verification and requires deliberate review before updating the manifest.
The running app uses bundled files and makes no Poly Haven API requests.

## Accuracy limits

These materials are generic surface scans, not aerial imagery of the circuits.
Repeated grass, asphalt, and sand textures do not establish the actual surface
material, runoff boundaries, kerb paint, or current configuration at a venue.
Procedural buildings, vegetation, barriers, and other fallback objects are
illustrative scenery; they are not a surveyed digital twin. Real landmark
geometry would require independently sourced, licensed models or validated
mapping data, with its own provenance and alignment checks.

OpenStreetMap-derived scenery, where present, carries its separate attribution
and data-license requirements; Poly Haven's CC0 license covers only the material
images listed above.
