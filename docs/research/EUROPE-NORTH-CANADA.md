# Circuit-specific photographic 3D data: northern Europe and Canada

Checked 2026-11-05. This is a source and coverage audit, not a claim that a
photographic mesh has been installed. A photograph draped on a terrain grid
does not supply photographed building façades or a volumetric tree canopy.

| Circuit | Best verified source | Exact circuit coverage evidence | Availability for this project |
|---|---|---|---|
| Silverstone | Bluesky MetroVista is a genuine photo-textured mesh product; national aerial photographs and photogrammetric LOD1–3 building models are separate products | Published MetroVista city list does **not** include Silverstone; no off-the-shelf circuit mesh verified | Bespoke capture/quotation is offered. No public price or circuit download established. Do not describe the national building-model catalogue as an existing textured Silverstone mesh |
| Spa-Francorchamps | Wallonie **2024 aerial orthophoto**, 25 cm; separate LiDAR terrain/surface rasters | Downloaded and visually inspected a bbox image containing the complete circuit | Working unauthenticated JPEG export. **2D aerial fallback**, not a photomesh. Service access terms verified; underlying raster redistribution license still needs dataset-level confirmation |
| Red Bull Ring | basemap.at **aerial orthophoto**, nationwide advertised maximum pixel size 29 cm, selected regions 15 cm; separate Styrian 1 m ALS elevation products | Downloaded a tile inside the actual circuit; Styrian metadata point query returns flight block `2022260_Zeltweg`, acquisition 2022-07-20 | Working unauthenticated WMTS JPEG and explicit **CC BY 4.0** terms. **2D aerial fallback**, not a photomesh |
| Hungaroring | Official Lechner GeoShop is a national geospatial data procurement lead | No downloadable photographic 3D mesh covering the circuit was verified | No usable open circuit mesh, date, resolution, price, or licensed download established. The GeoShop SPA is not evidence of circuit coverage. Do not substitute Budapest-city coverage for Mogyoród |
| Circuit Gilles-Villeneuve | Montréal **2016 and 2020 photo-textured LOD2 buildings**, CityGML/3DM/GDB; public Esri I3S derivative of 2016 buildings | 2016 I3S service extent contains the circuit bbox; node `15535` overlaps the island area and advertises geometry plus JPEG textures. This confirms a nearby textured model, not exhaustive building coverage around the entire lap | Original city catalogue is **CC BY 4.0**. Original asset downloads returned proxy `403 RBAC: access denied` in this environment; no bypass attempted. Esri-hosted derivative explicitly carries Esri Master License terms, so it is not an unrestricted downloadable replacement |

## Geographic checks

Circuit-only boxes, excluding scenery margins, reconstructed from this
repository's geographic outlines. Coordinates are `[west, south, east, north]`.

| Circuit | Geographic box |
|---|---|
| Silverstone | `[-1.0242860, 52.0635130, -1.0092640, 52.0789360]` |
| Spa | `[5.9596020, 50.4276780, 5.9775599, 50.4462170]` |
| Red Bull Ring | `[14.7540689, 47.2192840, 14.7706480, 47.2263880]` |
| Hungaroring | `[19.2423260, 47.5775710, 19.2566090, 47.5884740]` |
| Montréal | `[-73.5299400, 45.4970600, -73.5219490, 45.5142980]` |

## Montréal: real photo-textured buildings, with a coverage and delivery caveat

Official catalogue/API:

- [2020 photo-textured LOD2 buildings](https://donnees.montreal.ca/dataset/batiments-3d-2020-maquette-lod2-avec-textures).
- [2016 photo-textured LOD2 buildings](https://donnees.montreal.ca/dataset/batiment-3d-2016-maquette-citygml-lod2-avec-textures2).
- [Catalogue search JSON](https://donnees.montreal.ca/api/3/action/package_search?q=3d&rows=50).
- Original data license: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The catalogue describes photogrammetrically reconstructed roofs, with walls
extrapolated from roofs to the terrain and three metres below ground. Aerial
photographs are projected onto roofs and walls. Roof accuracy is stated as
±30–40 cm; walls are extrapolated. This is materially better than generic
footprint extrusion, but it is **not** a dense all-surface photogrammetric mesh.
It excludes a promise of detailed grandstands, temporary paddocks, trees or
2026 circuit construction.

The 2020 dataset covers selected boroughs: Côte-des-Neiges–Notre-Dame-de-Grâce,
Outremont and Ville-Marie. Île Notre-Dame is in Ville-Marie, but administrative
membership alone does not establish building coverage. The original tile index
and downloadable building geometries must establish that before integration.

Spatial reference: NAD83 CSRS (98), MTM zone 8; vertical reference C-GVD28.
Acquisition: aerial photographs from 2020 or 2016, depending on dataset.
The 2020 metadata publication date in 2026 must not be mistaken for acquisition.

Exact original downloads provided by the city catalogue:

- 2020 Ville-Marie CityGML tiles 13–18:
  `https://donnees.montreal.ca/dataset/79029901-8e40-4f7b-8aca-a2f10abde023/resource/f472fbe4-566f-428a-8072-1343b1fe5a89/download/vm_2020_gml_13_18.zip`
- 2016 Ville-Marie CityGML tiles 10–18:
  `https://donnees.montreal.ca/dataset/5eabd047-872e-425a-bbc2-3669e732a132/resource/a0c45e78-4092-4575-b9f3-486c13df2f33/download/vm_2016_gml_10_18.zip`
- 2016 tile index DWG:
  `https://donnees.montreal.ca/dataset/5eabd047-872e-425a-bbc2-3669e732a132/resource/367b54eb-7201-4d74-b952-5fd17c31a5bc/download/index-maquette-2016.dwg`

These are candidate tile groups, **not verified island tile assignments**.
The tested original 2009 DXF index returned `403 RBAC: access denied` from the
execution network proxy. No alternate credential or proxy route was used.

A separate, publicly inspectable Esri derivative provides useful evidence:

- [2016 service item metadata](https://www.arcgis.com/sharing/rest/content/items/48e3923ce6a347bd86ba5a08c5d6dffd?f=json).
- [I3S layer metadata](https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Buildings_Montreal_2016/SceneServer/layers/0?f=pjson).
- [Island-area node metadata](https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Buildings_Montreal_2016/SceneServer/layers/0/nodes/15535?f=json).

The service is `3DObject` with triangle geometry, UVs and JPEG/DDS textures.
Extent: `[-73.67582865,45.43576436,-73.52074156,45.54141593]`.
Node 15535 has centre `[-73.53023438,45.50835868]`, bounding-sphere radius
1663.69 m, geometry and texture references. Its item names City of Montréal,
Esri Canada and Esri as credits and explicitly specifies Esri Master License
Agreement terms. Inspecting these public metadata documents does not establish
permission to extract and redistribute the hosted mesh.

## Spa: verified circuit aerial imagery, no verified photographic mesh

- [2024 orthophoto service catalogue](https://geoportail.wallonie.be/catalogue/38cb73b9-def6-43bd-a96f-f5d7a487e697.html): describes 25 cm orthorectified/mosaicked summer 2024 imagery, partial Wallonia coverage.
- [ArcGIS REST metadata](https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE/ORTHO_2024/MapServer?f=pjson).
- [Exact verified circuit JPEG export](https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE/ORTHO_2024/MapServer/export?bbox=5.955,50.423,5.982,50.447&bboxSR=4326&imageSR=3857&size=1024,1024&format=jpg&f=image).
- [SPW web-service access terms](https://geoportail.wallonie.be/files/documents/ConditionsSPW/LicServicesSPW.pdf), version 1.1, 2016-08-03.

The export was downloaded successfully as a genuine 1024×1024 JPEG and visually
checked against the entire circuit. At this overview size its displayed ground
sampling is coarser than the source's 25 cm. It is a proof of coverage, not a
full-resolution asset ready for a close helicopter camera.

SPW's service terms permit free access/use by any user (article 3), but article
5 §2 says copied/distributed data must comply with the underlying data license.
The service record alone does not establish that underlying raster license;
do not label the sample CC BY merely because it is publicly viewable. Service
metadata credits `SPW 2025`; the imagery campaign is 2024.

The [official relief service listing](https://geoservices.wallonie.be/arcgis/rest/services/RELIEF?f=pjson)
includes `WALLONIE_MNT_2021_2022` and `WALLONIE_MNS_2021_2022`, as well as older
2013–2014 products. These are terrain/surface products, not photo-textured
building meshes. The inspected official image/relief service directories did
not provide an integrated photomesh for Spa. This is a bounded search result,
not proof that no separately licensed survey exists.

## Red Bull Ring: licensed aerial fallback and precise acquisition metadata

- [basemap.at product descriptions and usage terms](https://basemap.at/).
- [WMTS capabilities](https://mapsneu.wien.gv.at/basemap/1.0.0/WMTSCapabilities.xml).
- [Verified circuit tile, zoom 18](https://maps.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/18/91963/141821.jpeg).

Layer: `bmaporthofoto30cm`; format JPEG; matrix set `google3857` (EPSG:3857).
The product page advertises maximum pixel size 29 cm nationwide, 15 cm in some
regions. This is a product-wide specification, not a verified 15 cm claim for
Spielberg. The layer bounding box covers all of Austria and contains the full
Red Bull Ring. The downloaded 256×256 tile lies within the circuit bbox and
visually shows the actual infield/track area.

License is explicitly **CC BY 4.0**, free for commercial and private uses, with
credit `Datenquelle: basemap.at` or `Grundkarte: basemap.at`, linking the name to
the site. The provider also documents offline ESRI Compact Cache/MBTiles
delivery; a country-wide bulk download is unnecessary for this small area.

[Exact Styrian acquisition-metadata query](https://gis.stmk.gv.at/arcgis/rest/services/OGD/OrthophotosSteiermark_Metadaten/MapServer/1/query?geometry=14.7620433333,47.2233725926&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=pjson)
returns block `2022260_Zeltweg`, tile `5624-63`, producer `FMM Ges.m.b.H.`,
year 2022, timestamp `1658275200000` (2022-07-20 UTC), and RGB/CIR GeoTIFF path
attributes. These are metadata for the regional source; the displayed
basemap.at tile does not carry its own acquisition date. Do not automatically
equate a basemap release date with a photograph date.

The [Styrian OGD service directory](https://gis.stmk.gv.at/arcgis/rest/services/OGD?f=pjson)
also exposes 1 m ALS ground/surface height layers. No photo-textured Spielberg
photomesh was established by these listings. Combining the aerial with ALS
would create a photographed terrain surface, not recover photographed façades.

## Silverstone: legitimate paid products, no verified stocked circuit mesh

- [Bluesky MetroVista mesh models](https://bluesky-world.com/metrovista-mesh-models/).
- [Bluesky photogrammetric building models](https://bluesky-world.com/3d-building-models/).
- [Bluesky aerial photography](https://bluesky-world.com/aerial-photography/).
- [Commercial catalogue](https://www.blueskymapshop.com/).

MetroVista is a genuine photographic 3D product combining oblique/nadir imagery
and simultaneous LiDAR. Published specifications: 5 cm imagery/obliques,
16–100 LiDAR points/m², OSGB1936, formats including OBJ and FBX. The advertised
captured locations are Birmingham, Bournemouth, Brighton, Bristol, Cambridge,
Cardiff, Derby, Doncaster, Eastbourne, Edinburgh, Glasgow, Leicester, Liverpool,
London, Manchester, Newcastle, Norwich, Nottingham, Oxford, Southend and York.
Silverstone is not listed. Therefore national availability of another Bluesky
product is **not evidence that a stocked Silverstone MetroVista mesh exists**.

The provider offers bespoke capture. Access is commercial licensing/quotation;
no verified public price for a circuit mesh was found, and no purchase or
outreach was made. A specific circuit quote and rights covering an interactive
redistributed web replay would be needed. The separate national LOD1–3 product
is described as wireframe/block models supplied primarily as DWG; it should not
be represented as the same photo-textured product.

Environment Agency LiDAR is a possible geometry lead, not photographic façade
imagery. A usable Silverstone-specific official LiDAR/aerial download and its
acquisition date were not verified in this audit. No claim is made that a
national service listing proves all circuit pixels are covered.

## Hungaroring: unresolved, with no invented substitute

The official [Lechner GeoShop](https://geoshop.hu/) is reachable and identifies
Lechner as the operator; it is a JavaScript procurement portal. A photographic
3D mesh, a circuit-overlapping licensed orthophoto download, current acquisition
date, resolution, and public price were **not established** in this pass.
Client-side application configuration was not used to obtain or repurpose API
credentials. No private account, purchase or outreach was attempted.

Budapest-city model availability would not prove coverage: the circuit is near
Mogyoród, northeast of the city, at approximately 19.2508° E, 47.5827° N.
The correct next procurement question is coverage of the explicit circuit box
above, not availability of an unspecified Budapest model.

The official [3D Magyarország programme page](https://lechnerkozpont.hu/oldal/3d-magyarorszag)
was also checked. It describes a multi-system digital construction/planning
infrastructure programme, including models of selected state-owned buildings
and architectural plan catalogues. The programme's name is not evidence of a
downloadable nationwide photographic mesh or coverage of Hungaroring.

## Local proof files

`research-assets/` is excluded from Git. `europe-north-canada-manifest.json`
records exact request URLs, dimensions, source/terms status and SHA-256 hashes.
Only the basemap.at proof has an explicitly verified open data license here.
The Spa image is a service-access/coverage proof pending underlying-data license
verification. Catalogue/scene metadata is evidence, not an installed asset.
