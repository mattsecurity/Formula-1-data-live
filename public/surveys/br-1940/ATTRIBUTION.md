# Interlagos RGB LiDAR survey

Source: **Prefeitura do Município de São Paulo / GeoSampa**, municipal MDS 2017 survey.

- Official portal: https://download.geosampa.prefeitura.sp.gov.br/
- Official client linking the source downloads: https://download.geosampa.prefeitura.sp.gov.br/js/_MapasSBC.js
- Official point-cloud viewer: https://visualizador-laz-web.s3-sa-east-1.amazonaws.com/index.html?scm=3333-454
- Original tiles and SHA-256 checksums: [sources.json](sources.json)
- License: **Creative Commons Attribution-ShareAlike 4.0 International**, https://creativecommons.org/licenses/by-sa/4.0/

The official portal links this license in its download-layers panel and footer (`rel="license"`, `divLicenceccbysa`). The LAS header contains no separate license statement. No endorsement by the municipality is implied.

`survey.glb` is an adaptation of the survey: local geographic crop, gross height/noise filtering, deterministic spatial sampling, coordinate transformation, and RGB transfer-function conversion. This adapted survey asset is distributed under **CC BY-SA 4.0**, with source attribution and this description of changes retained. This asset license does not change the license of independent application code.

This is a **measured RGB point cloud**, not a surface mesh or a reconstruction of current race facilities. There are no generated facade surfaces or inferred points. The source is grouped as MDS 2017 by GeoSampa; the exact flight date is unverified. LAS file creation in 2018 and upload in 2020 are not acquisition dates.

`metadata.json` records the local origin, coordinate formula, elevation offset, exact retained bounds, sampling parameters, and outline coverage checks. XYZ is **east/up/south in metres**, with the longitude/latitude origin and equirectangular transform taken from `public/environments/br-1940.json`. Source CRS is SIRGAS 2000 / UTM 23S (EPSG:31983). No vertical exaggeration is baked into the point cloud. Vertex colors are normalized linear RGBA8, converted from the source RGB as displayed by the municipal viewer.

Rebuild (Python 3, curl; install numpy, laspy, lazrs, pyproj, scipy):

```sh
python scripts/prepare-interlagos-survey.py
python scripts/prepare-interlagos-survey.py --offline
```

Original LAZ files are cached in `../research-assets/latin-america/` outside the repository, or in the directory selected by `--cache`. Each input is checked against its pinned checksum before processing. The application loads only the local GLB and metadata; it does not query GeoSampa or download raw LAZ data at runtime.
