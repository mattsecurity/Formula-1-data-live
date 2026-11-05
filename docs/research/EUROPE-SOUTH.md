# Photographic circuit assets: southern Europe and Zandvoort

Checked 2026-11-05. No renderer or production assets changed. Research downloads are outside the repository at `/workspace/research-assets/europe-south/`. Actual image requests, extents, byte sizes and hashes are recorded there in `download-checks.json`, `imola-2022-download-check.json`, and the other `*-check.json` files. All tests used public endpoints without credentials or circumvention.

## Result by circuit

| Circuit | Photographic textured 3D mesh | High-resolution photographic ortho | Readiness |
| --- | --- | --- | --- |
| Monza `it-1922` | No downloadable, licensed photographic mesh verified. Marketplace circuit models are not proof of photogrammetry or reuse rights. | Lombardia AGEA/MASAF 2024 exists at 20 cm, but official distribution terms say consultation only. | No redistributable local photographic asset verified. |
| Imola `it-1953` | No downloadable, licensed photographic mesh verified. | **RER 2022 RGB, 20 cm, CC BY 4.0**, successful circuit sample. | Usable photographic ground imagery. |
| Monaco `mc-1929` | Government/Siradel digital twin is real, but no open mesh download/license verified. | Official SIGM 2020 ortho exists, but item explicitly reserves use to government services and associated applications. | Restricted official asset; not an open-data substitute. |
| Barcelona `es-1991` | No circuit-overlapping, licensed photographic mesh verified. Barcelona city-center meshes do not establish coverage at Montmeló. | **ICGC 2025 RGB, 25 cm, CC BY 4.0**, successful circuit sample. | Usable photographic ground imagery. |
| Madrid `es-2026` | **Actual official photographic 3D Tiles discovered; valid b3dm/glTF tile downloaded**, with mesh and embedded JPEG. Public item has no declared license, capture date or native resolution. | **PNOA July 2023 RGB, 25 cm at center/four-corner metadata samples**, successful circuit sample; IGN/CNIG open reuse terms. | Mesh is technically accessible and geographically relevant; reuse/date/resolution unresolved. Ortho usable; capture metadata verified separately at center and four bbox corners. |
| Zandvoort `nl-1948` | 3DBAG provides genuine surveyed/reconstructed building geometry, **without photographic textures**; actual CityJSON downloaded. No photographic mesh verified. | **PDOK 2025 winter ortho, 5/8 cm product, CC-BY**, successful circuit sample requested at 8 cm/px. | Usable ortho plus optional untextured 3D buildings. |

Ortho imagery is a photograph of the ground and roofs. It supplies neither photographed facades nor a photogrammetric city mesh. It must not be presented as either.

## Circuit extents used

Exact west/south/east/north bounds, EPSG:4326, taken from the checked-in environment datasets rather than city-name searches:

| Circuit | West | South | East | North |
| --- | ---: | ---: | ---: | ---: |
| Monza | 9.272348045 | 45.606018977 | 9.305204955 | 45.637203023 |
| Imola | 11.693867751 | 44.330668977 | 11.733319249 | 44.350893023 |
| Monaco | 7.407539649 | 43.722480577 | 7.444039351 | 43.750995423 |
| Barcelona | 2.244329459 | 41.558347977 | 2.271473541 | 41.580591023 |
| Madrid | -3.633015707 | 40.458438977 | -3.604312293 | 40.486480023 |
| Zandvoort | 4.529174779 | 52.378523977 | 4.562628221 | 52.397650023 |

The ortho tests are 1024×1024 JPEG crops centered at each environment's geographic origin. They demonstrate actual circuit overlap, not complete-bbox delivery. Images were decoded, checked for nonconstant pixels, and visually inspected for Zandvoort, Barcelona and Imola. Production imagery should be fetched in bounded tiles at the source GSD and stitched with preserved georeferencing.

## Madrid: actual textured 3D Tiles, licensing unresolved

Official entry point: <https://gemelodigital.madrid.es/>. It redirects to the city's public Experience Builder app:

<https://experience.arcgis.com/experience/1828d17f34cf441b8875c438df2cca59/page/Modelo-3D-realista>

Its configuration references the official `MODELO_3D_REALISTA_PUBLICO` web scene, item `d8bcbe7422a048a6837dafad300ef2be`. The scene explicitly uses `IntegratedMesh3DTilesLayer` for eight mesh zones. This is an actual mesh service, not an OSM building extrusion or a rendered screenshot.

Public source configuration (downloaded and preserved):

- App JSON: <https://www.arcgis.com/sharing/rest/content/items/1828d17f34cf441b8875c438df2cca59/data?f=json>
- Scene JSON: <https://www.arcgis.com/sharing/rest/content/items/d8bcbe7422a048a6837dafad300ef2be/data?f=json>
- Zone 1 tileset: <https://tiles-eu1.arcgis.com/UrtTdLP2PYSxwtI6/arcgis/rest/services/ZONA1/3DTilesServer/tileset.json>
- Zone 2 tileset: <https://tiles-eu1.arcgis.com/UrtTdLP2PYSxwtI6/arcgis/rest/services/ZONA2/3DTilesServer/tileset.json>
- Zone 3 tileset: <https://tiles-eu1.arcgis.com/UrtTdLP2PYSxwtI6/arcgis/rest/services/ZONA3/3DTilesServer/tileset.json>
- Zone 4 tileset: <https://tiles-eu1.arcgis.com/UrtTdLP2PYSxwtI6/arcgis/rest/services/ZONA4/3DTilesServer/tileset.json>
- Other advertised zones: replace `ZONA4` with `ZONA5`, `ZONA6`, `ZONA7`, or `ZONA8_PRO35_servicio`.

All eight root manifests downloaded successfully. They use 3D Tiles 1.0, ECEF transforms and b3dm content. Transforming the actual content bounding boxes to WGS84 gives overlaps with the circuit bbox for zones 1–4 (some are loose bounds). Zone 1's content bounds cover approximately `[-3.76834,40.47140,-3.57630,40.59933]`, intersecting the northern part of the circuit.

Actual mesh download test:

<https://tiles-eu1.arcgis.com/UrtTdLP2PYSxwtI6/arcgis/rest/services/ZONA1/3DTilesServer/Data/b0.b3dm>

Saved as `madrid-zona1-sample.b3dm`, 10,648 decoded bytes. Valid `b3dm` container; embedded `glTF`; one mesh, one material, one embedded JPEG image; extensions `KHR_draco_mesh_compression` and `KHR_materials_unlit`. The content bounding box includes the circuit origin in horizontal local coordinates. This is a very coarse parent tile, **not the detailed production LOD**. Per-triangle circuit coverage and detailed child tiles have not yet been inspected. Preserve its transform; the geometry is not a circuit-local OBJ.

The official ArcGIS item for Zone 1 is `5ed34381f10f42f7b07ec92c24c01c6f`. Both its `licenseInfo` and the public web scene's `licenseInfo` are empty. The metadata do not establish source photography date or GSD. The city's general reuse terms allow commercial and noncommercial reuse of data subjected to those terms, with source/date attribution, but this research did **not** establish their application to this mesh service. Therefore keep the mesh research-only until applicable terms are documented; public delivery alone is not an explicit reuse license. Do not label it 2024 or centimeter-accurate from a secondary social-media claim.

General reuse terms: <https://datos.madrid.es/pages/condiciones-generales-ayuntamiento-de-madrid>.

Madrid ortho fallback uses <https://www.ign.es/wms-inspire/pnoa-ma>, WMS layer `OI.OrthoimageCoverage`. Actual crop: `es-2026-current-native-sample.jpg`, 181,397 bytes, 1024×1024. Request pixel size was 25 cm on the ground, but **native GSD and capture year for this specific Madrid patch were not established**. Current PNOA is a mosaic of available vintages; do not invent one uniform date. The official capabilities describe the service as PNOA maximum actuality. IGN/CNIG licensing reference: <https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf> (downloaded as `ign-license.pdf`).

## Imola: useful 2022 imagery, not the blank newer layer

Primary catalog: <https://geoportale.regione.emilia-romagna.it/catalogo/dati-cartografici/cartografia-di-base/immagini/layer-10>.

- Product: RER 2022 RGB; 20 cm ortho; CC BY 4.0.
- The region explicitly names Imola/Faenza among the covered pilot areas and dates their survey to **March 2022**: <https://geoportale.regione.emilia-romagna.it/approfondimenti/prodotti-lidar-e-ortofoto>.
- WMS endpoint: <https://servizigis.regione.emilia-romagna.it/wms/rer2022_rgb>.
- Layer `RER2022_RGB`; successful WMS 1.1.1 `GetMap`, EPSG:3857, JPEG.
- Actual file: `it-1953-2022-native-sample.jpg`, 164,125 bytes, 1024×1024, covering 204.8 m on the ground. The photograph visibly includes the circuit, green grandstands, trackside trees and roads.
- The same region also offers 0.5 m bare-earth DTM from the 2022 LiDAR campaign under CC BY 4.0. That is terrain elevation, not a textured mesh.

Important negative tests: `RER2023_24_RGB` returned a valid but entirely black JPEG at the same Imola center, so its broad regional bbox does not prove circuit coverage. Retained in `download-checks.json` as a failed coverage test. AGEA 2023 is a separate product whose catalog says restricted use and public-administration-only full data: <https://geoportale.regione.emilia-romagna.it/catalogo/dati-cartografici/cartografia-di-base/immagini/layer-16>. Do not substitute it as open imagery.

## Barcelona/Montmeló: annual open ortho

Primary product and license: <https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Imatge/Ortofoto-Territorial>.

- ICGC Ortofoto Territorial, annual 2025 RGB coverage, 25 cm pixels; CC BY 4.0.
- WMS: <https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms>.
- Verified layer: `ortofoto_25cm_color_2025`; capabilities also list 2024 and earlier annual layers and provisional 2026 imagery.
- Product formats: per-area JPG, JP2, PDF, TIF and ECW; complete annual coverage GeoPackage/ECW. Tested route is WMS JPEG.
- Actual file: `es-1991-2025-native-sample.jpg`, 228,856 bytes, 1024×1024, 256 m ground width. The photograph visibly includes the circuit, paddock car parks and service buildings.
- License attribution must credit ICGC and identify modifications.

ICGC terrain/DSM and 3D city models must be distinguished from photo-textured meshes. No licensed photographic mesh covering this out-of-city circuit was verified in this pass.

## Zandvoort: very high-resolution open photography and untextured 3D

Primary service explanation and license: <https://www.pdok.nl/introductie/-/article/pdok-luchtfoto-rgb-open->.

- PDOK's annual aerial photography is open for all applications under CC-BY. The page links the applicable license; retain provider attribution.
- Winter 2025 imagery is the **5/8 cm product**: two thirds of the Netherlands at 8 cm, a changing one third at 5 cm. This check does not establish which acquisition GSD applies to Zandvoort; the sample request was 8 cm/px.
- WMS: <https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0>.
- WMTS capabilities: <https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?SERVICE=WMTS&REQUEST=GetCapabilities>.
- Verified layer `2025_orthoHR`; full annual 2024 8 cm layer and current 2026 products also advertised. Fixed-year layers avoid silent date changes.
- Actual file `nl-1948-2025-native-sample.jpg`, 161,002 bytes, 1024×1024, 81.92 m ground width. The actual photograph shows circuit asphalt, lane markings, catch fences, poles and adjacent facilities.
- PDOK serves imagery via WMS/WMTS; the Beeldmateriaal portal handles original bulk deliveries. WMS JPEG is sufficient for properly georeferenced ground textures.

3DBAG official documentation: <https://docs.3dbag.nl/en/> and downloads: <https://3dbag.nl/download>. LoD 1.2, 1.3 and 2.2 are reconstructed from BAG footprints and AHN height measurements; **they are not photographs**. License CC BY 4.0 is explicitly linked by the API collection metadata: <https://api.3dbag.nl/collections/pand>.

Actual keyless download test, RD New/height CRS EPSG:7415:

<https://api.3dbag.nl/collections/pand/items?bbox=96699.91025133904,488202.72820043296,98699.91025133904,490202.72820043296&limit=1>

Saved `zandvoort-3dbag-sample.json`, 5,582 bytes; one CityJSON building `NL.IMBAG.Pand.0473100000000001`, with geometry/vertices, sloped-roof attributes and measured heights. This proves a real Zandvoort-area geometry response, not the photographic appearance requested by the user. Latest downloadable 3D Tiles LoD 2.2 advertised by the official download page: <https://data.3dbag.nl/v20250903/cesium3dtiles/lod22/tileset.json>. API collection metadata advertises an older version; do not silently equate its response with the 2025 bulk release.

## Monza and Monaco: concrete restrictions, not assumed permission

Monza official regional distribution policy: <https://www.geoportale.regione.lombardia.it/consultazione-e-distribuzione>. It explicitly describes AGEA 2012/2015/2018/2021 and MASAF 2024 ortho as **consultation-only**. The 2024 ortho has 20 cm resolution, but public WMS/WMTS visibility does not establish permission to bundle image tiles or derive a downloadable mesh. Regional home: <https://www.geoportale.regione.lombardia.it/home>. A third-party Italy aerial mirror's CC-BY assertion was not accepted over the primary owner's restricted terms. No restricted image payload was downloaded for production use.

Monaco official ortho item metadata:

<https://www.arcgis.com/sharing/rest/content/items/070de523a2af4ef29bef5e7f86c9e917?f=json>

`SIGM 2020 Orthophoto` describes a 2019 ortho updated by 2020 drone surveys around Portier/Casino, with 2015 imagery around the edges. Its partial extent `[[7.4176803,43.7315516],[7.4296048,43.7386856]]` intersects the circuit area. Its license text states: “Fond de plan réservé uniquement à une utilisation par les services du gouvernement princier de Monaco et aux applications associées.” Therefore it was rejected as an open reusable texture source. No imagery payload was extracted.

The government/Siradel digital twin is documented by its producer: <https://www.siradel.com/principality-of-monaco-a-unique-digital-twin-and-digital-services-platform-at-the-service-of-the-territory-transformation/>. It is not an open download/license. An IGN Géoplateforme ortho test at the Monaco center returned HTTP 400; it did not establish substitute coverage or licensing. No open photographic circuit mesh was verified for Monaco.

## Follow-up: bundled whole-environment ground imagery

The four licensed sources now have georeferenced working-LOD JPEGs in `public/orthophotos/`, with exact per-entry extents, resolution, capture details and complete request provenance in `manifest.json`. Madrid PNOA GetFeatureInfo returns `Fecha: 2023-07` and `Resolucion: 0.25` at the center and all four bbox corners. Imola uses the original March 2022 imagery plus licensed RER2023–24 imagery only where the 2022 source declares transparent no-data; their alpha union covers the complete environment bbox. This does not contradict the earlier black-center test of the 2023–24 layer: its coverage complements the older pilot survey rather than replacing it. See `public/orthophotos/README.md` and `scripts/fetch-orthophotos.py` for reproduction and limitations.
