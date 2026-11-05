# Interlagos and Mexico City: photographic 3D source research

Verified 2026-11-05. This report distinguishes actual circuit coverage from city-wide marketing coverage. No game assets were extracted; no purchases, registrations, or outreach were made. Research binaries and captured source responses are outside the repository at `/workspace/research-assets/latin-america/`.

## Result

| Circuit | Strongest verified source | Access and practical status |
| --- | --- | --- |
| São Paulo / Interlagos | GeoSampa municipal RGB-colored LiDAR, MDS 2017 | Actual circuit tile downloaded and decoded; official portal displays CC BY-SA 4.0. Useful real survey geometry and colors, **point cloud, not textured mesh**. |
| Mexico City / Autódromo Hermanos Rodríguez | VI-grade exact-circuit commercial graphic scenario; independent Sketchfab aerial reconstruction | Commercial model requires quotation and explicit web redistribution/export rights. Photogrammetry exists publicly but its author has disabled downloads and supplied no reuse license. No redistributable photographic mesh verified. |

## Interlagos: verified municipal RGB LiDAR

### Source chain and endpoints

The working official [GeoSampa download portal](https://download.geosampa.prefeitura.sp.gov.br/) serves its public client implementation at [`js/_MapasSBC.js`](https://download.geosampa.prefeitura.sp.gov.br/js/_MapasSBC.js). Its `MDS 2017` download code explicitly links the following municipal resources:

- Colored LAZ: `https://laz-m3dc-pmsp.s3-sa-east-1.amazonaws.com/MDS_color_{SCM}.laz`
- [Official Potree viewer](https://visualizador-laz-web.s3-sa-east-1.amazonaws.com/index.html?scm=3333-454)
- [Live viewer tile bounds](https://visualizador-laz-web.s3-sa-east-1.amazonaws.com/metadata/bb_min_max.json)
- [Official EPT stream metadata](https://ept-m3dc-pmsp.s3-sa-east-1.amazonaws.com/ept.json)
- [Municipal metadata repository](https://github.com/geoinfo-smdu/metadados-MDS)

The viewer declares its author as “Secretaria Municipal de Desenvolvimento Urbano (SMDU) - Prefeitura do Município de São Paulo.” EPT metadata specifies SIRGAS 2000 / UTM zone 23S, **EPSG:31983**, metric XYZ, RGB channels, classifications, LASzip data, and 31,730,305,220 citywide points. Do not load the full city into a replay scene; select local tiles or an EPT spatial subset.

### Circuit footprint proof

Circuit centerline source: [bacinger/f1-circuits, br-1940.geojson](https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/br-1940.geojson), identifying Autódromo José Carlos Pace — Interlagos. Its geographic bounds are longitude **−46.700536 to −46.694033**, latitude **−23.706404 to −23.696978**. Projecting the actual line vertices to EPSG:31983 gives circuit bounds approximately:

- Easting **326622.093–327283.667 m**
- Northing **7377245.502–7378291.175 m**

Intersecting that bounding box plus a 150 m buffer with the **live viewer's** tile bounds identifies these nine candidate tiles, all verified with HTTP HEAD 200:

`3333-424`, `3333-433`, `3333-434`, `3333-452`, `3333-454`, `3333-461`, `3333-462`, `3333-463`, `3333-464`.

These are buffered bounding-box intersections, not claims that every tile contains the racing surface. The complete computed bounds are retained in `interlagos-tiles.json` locally. Important data-quality issue: the GitHub repository's root `bb_min_max.json` repeats the same bounding box for all 5,544 entries; the live viewer copy contains distinct per-tile bounds and was used instead.

### Actual downloaded sample

[Download MDS_color_3333-454.laz](https://laz-m3dc-pmsp.s3-sa-east-1.amazonaws.com/MDS_color_3333-454.laz)

| Property | Verified value |
| --- | --- |
| File size | 26,512,464 bytes |
| SHA-256 | `819393bdd63dcf11d081b96b00851d9421f7917e676aad756242b86c646ff1a1` |
| Decoded points | 5,037,768 |
| LAS point format | 3, with 16-bit RGB |
| Easting extent | 326358.84–326900.81 m |
| Northing extent | 7377024.58–7377611.70 m |
| Z extent | 760.10–1156.27 m; extreme values require outlier filtering |
| LAS header creation date | 2018-06-25; **not** the acquisition date |
| HTTP Last-Modified | 2020-03-24; **not** the acquisition date |
| Acquisition label | Official portal groups this under MDS 2017; exact flight date not independently verified |

The entire file was decoded using `laspy` with `lazrs`, not merely checked for an HTTP response. An orthographic RGB rendering was visually inspected: it clearly contains the **pit building, main straight, Senna S, and adjoining roads**, establishing actual circuit coverage. It is retained at `interlagos-rgb-lidar-tile-preview.png`. A uniformly sampled **100,000-point RGB PLY** is retained at `interlagos-100k-rgb.ply` for review. This PLY has **no faces**, and is not a mesh. Its XYZ coordinates are translated by local origin `(326600, 7377300, 760)` metres in EPSG:31983. Restore that origin before georeferencing.

### License and integration implications

The official download portal HTML includes `rel="license"` links to [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.pt_BR), both in the download-layers panel and the page footer (`divLicenceccbysa`). This is direct portal-level license evidence; the downloaded LAS header does not itself embed a licensing statement. Attribute **Prefeitura do Município de São Paulo / GeoSampa**, retain source and license links, identify adaptations, and distribute adapted survey assets under CC BY-SA 4.0. Do not relabel the data as CC0. Local sample and preview attribution is recorded in `ATTRIBUTION.txt`; file sizes and checksums are in `manifest.json`.

No account, API key, or payment was required. The main `geosampa.prefeitura.sp.gov.br` host presented a human verification challenge; the public download host, official linked S3 resources, and municipal GitHub repository worked normally. No challenge was bypassed.

This is a viable route to **real, colored circuit geometry**. It still needs ground/outlier filtering, coordinate registration, point decimation or reconstruction, and browser performance validation. A point cloud does not provide clean facades, closed geometry, UV textures, race-year signage, or contemporary temporary stands. No claim of a ready-made phototextured digital twin is justified.

## Mexico City: real circuit photogrammetry, unavailable mesh

[Autódromo Hermanos Rodríguez by Matthew Schroyer](https://sketchfab.com/3d-models/autodromo-hermanos-rodriguez-2f4f5e957f334b2faa4f36a4c66ab40f), published **2016-10-29**, is explicitly described as constructed from aerial footage of the 4.3 km race circuit. The [public model API](https://sketchfab.com/v3/models/2f4f5e957f334b2faa4f36a4c66ab40f) returned:

- 293,346 faces and 147,922 vertices; one material.
- `isDownloadable: false`, `downloadCount: 0`, no published reuse license.
- Public [embed endpoint](https://sketchfab.com/models/2f4f5e957f334b2faa4f36a4c66ab40f/embed), which is a hosted viewer rather than a mesh download or a license to extract assets.

This is a strong exact-footprint lead for a future creator-authorized license request, but **not an importable licensed asset today**. No internal viewer resources were extracted. The age also prevents assuming current buildings and grandstand arrangements.

Other exact-circuit models exist: [2022 grandstand map by mayaguillermo](https://sketchfab.com/3d-models/bff265fc512649919b9486acf52a3672), 613,205 faces, and [July 2015 remodeling visualization](https://sketchfab.com/3d-models/e987101ca7a748fc848a16e484e3789a). Both returned downloads disabled and no reuse license. They are references, not authorized integration sources.

The Mexico City open-data CKAN endpoint `https://datos.cdmx.gob.mx/api/3/action/package_search?q=lidar` returned HTTP 503 during verification. The [INEGI map catalogue](https://www.inegi.org.mx/app/mapas/?t=0710000000000000) was reachable, but no exact-circuit phototextured 3D mesh endpoint, flight date, or tile license was established. A reachable city/national catalogue is not evidence of a usable 3D circuit asset.

## Commercial alternative with explicit Mexico circuit coverage

[VI-grade — Autodromo Hermanos Rodriguez](https://www.vi-grade.com/en/solutions/digital-models/racing-circuits/autodromo-hermanos-rodriguez-1071/) is a verified, reachable official product page identifying the exact circuit, length **4300 m**, with eight product images and a “REQUEST INFORMATION” action. Its [racing scenario catalogue](https://www.vi-grade.com/en/solutions/digital-models/racing-circuits/) explicitly offers quotations for graphic scenarios.

- **Cost/account:** commercial quotation; no public price. Their website offers a reserved area requiring registration. No account was created and no quotation was requested.
- **Format/license:** public page does not publish mesh export format, polygon count, scan date, capture resolution, or web redistribution rights. These must be in the actual supplier agreement; a simulator license cannot be assumed to permit shipping GLB assets to every browser.
- **Quality:** supplied as a professional graphic scenario; the site does not establish that this particular circuit uses photographic reconstruction. Treat scan method and visual detail as unverified until the vendor supplies specifications.
- **Download/stream:** no public authorized model endpoint was found; the product page is the actionable procurement endpoint, not a downloadable file.

The catalogue also explicitly lists **Algarve, Hockenheim, Nürburgring GP, Spa-Francorchamps, Spielberg, and Suzuka**, plus other circuits. It does **not** establish all-current-F1 coverage or Interlagos coverage. [VI-WorldSim](https://www.vi-grade.com/en/products/vi-worldsim/) uses Unreal graphics and is available standalone, but this alone does not grant mesh export or redistribution permission.

## Rejected marketplace shortcuts

Sketchfab search returned plausible-looking Interlagos circuit models carrying CC Attribution badges. Provenance disqualifies several:

| Model ID | Evidence | Decision |
| --- | --- | --- |
| `4e5f0ebb2f2b48d289d5f6231c22512b` | “(failed import) Interlagos Circuit 2023 layout”; tags include `ripped`, `asseto-corsa`, `ripped-model` | Exclude game extraction despite CC badge. |
| `83d46c3a6b264cf6b4a0f362a33ff9d1` | “Interlagos, São Paulo”; description “F1 2010” | Exclude game-origin asset. |
| `fb4806a3fea4442995db5dc815d0c361` | “kartrider wkc_r05 brazil” | Exclude game-origin stylized asset. |
| `9d4cd9c5959c42df94d744c576282b47` | 1.8 million faces but zero textures; empty description | No photographic material or reliable source provenance established. |
| `faea464dc7ad42ea8089fdfbec9288c5` | RCC Design “Cartoon Race Track Interlagos”, standard commercial label, downloads disabled | Stylized, not the requested photographic model. |

TurboSquid returned HTTP 403 and CGTrader returned HTTP 202 with an empty body. No specific licensed photographic circuit file or current purchase price could be verified from either during this run.

No universal, publicly downloadable, legitimately licensed all-F1 phototextured circuit pack was verified. The actionable routes are local municipal survey data where available and explicit commercial export/redistribution licensing for the remaining venues; game ownership or a marketplace uploader's license badge is not sufficient provenance.

## Implemented full-circuit survey asset

The nine municipal source tiles listed above have now been downloaded, SHA-256 pinned in `public/surveys/br-1940/sources.json`, decoded and assembled with `scripts/prepare-interlagos-survey.py`. The cropped source region contains the entire circuit bounding box plus a 150 m buffer. Original LAZ files remain cached outside Git in `/workspace/research-assets/latin-america/`.

Published asset: `public/surveys/br-1940/survey.glb`, a glTF **POINTS** primitive with 965,656 measured points, approximately 15.45 MB. It contains no triangle faces and no invented points or facades. Final sampling uses 1.75 m horizontal × 1 m vertical spatial voxels, preserving measured ground, buildings, and vegetation. A broad 700–900 m absolute-height filter excludes gross elevation spikes; the crop already removes the spike previously observed outside the retained region. Classifications 2, 5, 6, 19, and 20 are retained. Source RGB values in a 250,000-point check were exactly multiples of 256; colors are converted from sRGB to normalized linear RGBA8 for correct glTF vertex-color rendering.

Coordinates match the environment data precisely: longitude/latitude origin `[-46.698041865497075, -23.70095316374269]`, local equirectangular east/north metres using `111320*cos(originLatitude)` and `111320` metres per degree, after inverse transformation from EPSG:31983. The GLB axes are east/up/south; up is original measured elevation minus the ground-sample median **762.63 m**. No vertical exaggeration is baked in. The exact transformation, final bounds, source statistics, and coverage results are in `public/surveys/br-1940/metadata.json`.

Coverage was verified at **2,152 samples spaced every 2 m around the complete environment outline**: every sample lies within 5 m of a retained survey point, maximum horizontal nearest-point distance **1.903 m** (median 0.635 m; 95th percentile 1.236 m). This includes the southern loop. Ground-class-only coverage uses 115,206 retained measured ground points: 99.35% of outline samples are within 5 m, with a 9.565 m maximum gap and a 3.896 m 95th percentile. Both all-point and ground-only coverage thresholds are enforced by the build script. A complete offline rebuild reproduced the GLB byte for byte (SHA-256 `e50940b17e6193cb10e1fe9dedb8f57095e073369ce63298385cb80a48dcacbe`). The GLB was parsed using the application's actual Three.js `GLTFLoader`, confirming a `THREE.Points` object with normalized RGBA vertex colors. The source attribution, CC BY-SA 4.0 license, and description of adaptations ship alongside the GLB in `ATTRIBUTION.md`.
