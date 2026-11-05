# Photographic 3D source research: Australia and USA

Checked **5 November 2026**. Scope: Albert Park (Melbourne), Miami International Autodrome at Hard Rock Stadium, Circuit of the Americas (Austin), and Las Vegas Strip Circuit. A photographic textured mesh is required; building footprints, height extrusions, terrain imagery and a publicly viewable scene alone do not establish a usable dataset.

## Findings that can drive a decision

| Circuit | Strongest verified photographic mesh | Actual circuit overlap | Access / remaining constraint |
| --- | --- | --- | --- |
| Melbourne / Albert Park | MetroMap / Aerometrex Melbourne February 2025, 7.5 cm source resolution | **Confirmed against supplier AOI polygons: 146/146 circuit outline vertices inside.** | Purchasable custom area in Cesium 3D Tiles, FBX or OBJ. Public calculator returned **AUD 1,199 incl. GST for a 4 km², single-format selection**. Standard terms do **not** authorize a public streaming application; a separate agreement is required. |
| Las Vegas | Aerometrex Las Vegas 2021 photographic mesh | **Supplier explicitly documents its use to build the F1 23 Las Vegas circuit.** Exact full-circuit boundary completeness is not established by that statement alone. | Cesium 3D Tiles, OBJ, FBX, I3S/SLPK. Commercial quote; no public price or open redistribution licence verified. |
| Miami / Hard Rock Stadium | No relevant freely downloadable photographic mesh verified | Advertised Aerometrex Miami 2021 mesh is **downtown / South Beach**, not Miami Gardens. | Nearmap is a possible licensed AOI supplier, but exact stadium survey, date and mesh entitlement need authenticated coverage confirmation. |
| Austin / COTA | No relevant freely downloadable photographic mesh verified | Public Nearmap/Esri Austin sample is a **small downtown block**, outside COTA. | Nearmap is a possible licensed AOI supplier. Exact COTA mesh coverage remains unverified. Public LiDAR is not photographic facade geometry. |

No purchase, account creation, outreach, proprietary tile extraction, or use of another party's API keys was performed. Commercial preview geometry was not downloaded. One nearby **openly licensed Melbourne municipal OBJ tile** was downloaded and inspected; it does not cover the circuit itself.

## Melbourne: public municipal data conclusively misses Albert Park

The [City of Melbourne photomesh catalogue](https://data.melbourne.vic.gov.au/explore/dataset/city-of-melbourne-3d-textured-mesh-photomesh-2020/information/) provides a May 2020 integrated photographic mesh, OBJ/MTL/JPG and SLPK, MGA Zone 55 and AHD. Its live catalogue lists 2 cm GSD. The [DataVic record](https://discover.data.vic.gov.au/dataset/city-of-melbourne-3d-textured-mesh-photomesh-2020) instead lists 7.5 cm; this discrepancy must not be resolved by guessing. Both the live municipal metadata API and DataVic identify **CC BY 4.0**.

The municipal page links to its own OBJ and SLPK applications. Reading the applications' Web Scene definitions exposes their published download-region indexes:

- [OBJ download-region layer](https://services1.arcgis.com/KGdHCCUjGBpOPPac/arcgis/rest/services/Photomesh_2020_OBJ_Grid/FeatureServer/0), **570 tile polygons**, with `Region` and `Download_URL` attributes.
- [SLPK download-region layer](https://services1.arcgis.com/KGdHCCUjGBpOPPac/arcgis/rest/services/Photomesh_2020_SLPK_Regions/FeatureServer/0), **8 region polygons**, with the same download attributes.
- [Municipal metadata API](https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/city-of-melbourne-3d-textured-mesh-photomesh-2020) confirms licence URL, capture description and application links. The records endpoint contains zero rows because this dataset entry links out to the GIS indexes.

Reproducible index query: append `/query?where=1%3D1&outFields=*&outSR=4326&f=geojson` to either layer URL. Full GeoJSON responses are saved outside Git under `/workspace/research-assets/australia-usa/melbourne-obj-index.geojson` and `melbourne-slpk-index.geojson`.

**Coverage test:** geographic circuit points were recovered from `public/environments/au-1953.json`, reversing its documented local equirectangular projection (`111320 × cos(latitude)` east; `111320` north). All **146 circuit vertices fall outside both datasets**, and no circuit segment crosses any index polygon boundary. This establishes that these published regions do not cover the racing line. In particular, the nearby Southbank and Hoddle region names must not be treated as Albert Park coverage.

### Downloaded open sample: nearby context, not a complete circuit model

[OBJ tile E5-20](https://gis-3dmodelcapture-2020.s3.ap-southeast-2.amazonaws.com/photomesh/OBJ/E5-20.zip) is explicitly published by the municipal OBJ index. HTTP download succeeded without authentication:

- Saved to `/workspace/research-assets/australia-usa/E5-20.zip`, outside the repository.
- ZIP size **62,877,538 bytes**; uncompressed **158,362,622 bytes**.
- Contents: **1 OBJ, 1 MTL, 547 JPG textures**; 550 ZIP entries including directory. This is actual textured geometry, not a footprint extrusion.
- SHA-256: `68238158f3af2678f315302d9225e4ff449ce4b98cf8f7b6b4baae365db0cbd2`.
- Approximate nearest circuit-to-tile bounding-box separation: **204 m**; the tile does not overlap the track. This number is an approximate lower-bound screening measurement, not a surveyed clearance.
- Official index feature **ObjectID 562** has WGS84 bounding box **west 144.975304892752, south −37.8463275487277, east 144.978554311601, north −37.8437507875278**. Its exact closed polygon is `[[144.975304892752,-37.8462728865579],[144.975373876448,-37.8437507875278],[144.978554311601,-37.8438054447626],[144.978485436088,-37.8463275487277],[144.975304892752,-37.8462728865579]]`.
- The machine-readable evidence manifest is `/workspace/research-assets/australia-usa/E5-20-manifest.json`; it records source and index URLs, ObjectID, exact polygon, catalogue licence provenance, SHA-256, coordinate ranges and geometry counts. Licence provenance is the municipal catalogue API linked above, rather than an assumed licence inferred from anonymous download access.
- The OBJ contains **253,245 geometric vertices and 492,357 triangular faces**, with 547 image textures. Its coordinate bounds are east **322011.147949–322137.990234**, north **5809308.971924–5809589.971924**, elevation **4.336561–64.882370**, consistent with the catalogue's MGA55/AHD frame. Raw geometry occupies only part of the index cell.
- Direct Three.js OBJ rendering is practical for an individual tile using `OBJLoader` and `MTLLoader`, but this **121.9 MB text OBJ**, hundreds of materials and absolute million-metre coordinates are poor streaming defaults. Rebase OBJ vertex coordinates before Float32 conversion, preserve georeferencing separately, rotate east/north/up into east/up/south, and preferably convert/partition into GLB/3D Tiles for production. A rebased OBJ is prepared outside Git under `extracted/E5-20/preview.obj`; geometry and photographic textures are retained. No browser screenshot was completed in this acquisition pass.
- A sample texture and MTL are extracted under `E5-20-inspection/`. This individual ZIP contains no XML/KML metadata file; retain the index and catalogue for positioning/licence evidence.

Attribution for reuse: City of Melbourne, City of Melbourne 3D Textured Mesh (Photomesh) 2020, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); identify modifications. Do not label this single sample as an Albert Park survey.

## Melbourne: commercial survey that does include Albert Park

[MetroMap Melbourne 2025](https://metromap.com.au/plans/3d-shelf-models/melbourne-standard-resolution-2025/) is a photographic mesh captured February 2025: **777 km²**, **7.5 cm** source resolution and **25 cm RMSE**, offered as Cesium 3D Tiles / FBX / OBJ. The supplier's [coverage image](https://metromap.com.au/images/M0766_Melbourne_SR_2025_AOI_Image.original.jpg) includes the inner city and St Kilda area.

Stronger evidence than the image is available from the public store's actual product catalogue: [GET `/store/get-all-products`](https://metromap.com.au/store/get-all-products). Product **236**, named `Melbourne`, includes a GeoJSON AOI and capture date `28/02/2025`. Point-in-polygon testing places **146/146 Albert Park outline vertices inside this AOI**. The AOI is saved as `/workspace/research-assets/australia-usa/metromap-236-coverage.geojson`; the original response is `metromap-products.json`. No mesh was fetched from preview addresses in that response.

The [3D Store](https://metromap.com.au/plans/custom-data/?product-id=236) exposes a read-only price calculator used by its interface. On the check date:

- [1 km², Cesium format](https://metromap.com.au/cart/custom-3d-price?product_id=236&area_size=1&formats%5B%5D=tiles): JSON `{"price":1100.0}`.
- [4 km², Cesium format](https://metromap.com.au/cart/custom-3d-price?product_id=236&area_size=4&formats%5B%5D=tiles): JSON `{"price":1199.0}`.

The store displays prices inclusive of GST; its linked agreement specifies AUD payments. These are calculator examples for selected area size and one format, **not a project quote or confirmation that 4 km² covers every desired camera view**. No selection was added to a cart or purchased.

**Licence blocker:** the store links to the [Aerometrex Data Licence Agreement](https://metromap.com.au/documents/Aerometrex_Data_Licence_Agreement.pdf), version 1.0 dated 10 March 2021. Its default grant is internal-business use; remote/service-provider access and third-party availability require separate authorization. Do not buy a small-area download assuming it may be published as unrestricted web tiles. A public application / redistribution agreement must explicitly cover the intended use.

Two misleading nearby products were rejected with the same AOI test:

- [Melbourne South, November 2020](https://metromap.com.au/plans/3d-shelf-models/melbourne-south/), product **103**, 211 km², 7.5 cm / 25 cm RMSE: **0/146** Albert Park vertices inside. Its [coverage image](https://metromap.com.au/images/A6414_Melbourne_South_75mm_Nov_MM_AOI.original.jpg) starts around Brighton and extends south, rather than covering Albert Park.
- `Melbourne High Res`, product **34**, March 2021, 6.9 km², 2 cm / 5 cm RMSE: **0/146** inside. Higher resolution alone does not fix geographic coverage.

The [Port Phillip mapping page](https://www.portphillip.vic.gov.au/explore-the-city/travelling-around/using-port-phillip-maps) advertises a development-activity 3D viewer. That is not a published photomesh download or a redistribution licence. No openly licensed Albert Park photomesh endpoint was verified there.

## Las Vegas: verified detailed photographic geometry for the actual F1 context

The [Aerometrex model page](https://www.aerometrex.com/models/las-vegas/) specifies a **November–December 2021** capture, **7.5 km²**, mixed **5 cm / 2 cm / sub-centimetre** detail, **10 cm XYZ RMSE**, NAD83 horizontal / NAVD88 vertical, UTM 11N. Formats include Cesium 3D Tiles, FBX, I3S/SLPK and OBJ. The [published AOI image](https://aerometrex.com/images/US0012_Las_Vegas_5cm_AOI.width-730.jpg) follows the Strip and Koval Lane area.

More directly, the supplier's [F1 23 case study](https://www.aerometrex.com/blog/spatial-data-behind-the-las-vegas-circuit-in-ea-sports-f1-23/) documents delivery of this photographic mesh to Codemasters for the Las Vegas circuit and identifies high-resolution street-level capture of the Venetian. This verifies a relevant detailed source and a real racing-scene use case; it does not transfer EA's rights to this project or establish that a 2021 survey contains later pit buildings, the completed Sphere, or event installations.

The catalogue uses **request a quote**. No public fee, freely licensed tile download, or client embedding permission was verified. A source-specific delivery URL and agreement would be needed. No preview mesh was extracted.

## Miami: downtown coverage is not the Miami Grand Prix

[Aerometrex Miami 2021](https://aerometrex.com/models/miami-3d-model-2cm/) is a genuine photographic model: January–April 2021, **9.1 km²**, **2 cm** GSD, **5 cm XYZ RMSE**, NAD83 / NAVD88, UTM 17N, offered in Cesium 3D Tiles, OBJ, FBX and I3S/SLPK. However its [AOI image](https://aerometrex.com/images/Miami_2cm_AOI.width-730_obnh0N9.jpg) covers downtown and South Beach. Hard Rock Stadium is in Miami Gardens, well north of this area. This source was therefore rejected for the Grand Prix location.

The official [Miami-Dade GIS data service](https://www.miamidade.gov/global/service.page?Mduid_service=ser1468850841882434) describes free open production layers and fee-based requests for aerial TIFFs, LAS/DEM and MrSID imagery. It does not establish a public textured integrated-mesh download. The [county open-data hub](https://opendata.miamidade.gov/) is a valid discovery entry point, but available building footprints or LiDAR are not equivalent to photographic facades. No stadium-area open photomesh was verified.

## Austin: the public Nearmap example is downtown, not COTA

The public [Austin Nearmap Web Scene](https://www.arcgis.com/home/item.html?id=8b532b62d93d497a9d3ad7584e04c0c3) references an actual integrated mesh:

- [Mesh item metadata](https://www.arcgis.com/sharing/rest/content/items/75117adacda54e88a1214313953ffda3?f=json), title `AustinNearMapNewest`, owner `SolutionEngineering`.
- [I3S layer metadata](https://tiles.arcgis.com/tiles/p3UBboyC0NH1uCie/arcgis/rest/services/AustinNearMapNewest/SceneServer/layers/0?f=pjson).
- Published extent: **west −97.7469906, south 30.2630821, east −97.7410801, north 30.2696273**. This is a small downtown rectangle, well outside Circuit of the Americas.
- Item `licenseInfo` and `accessInformation` are null. Public visibility is not a licence to extract and redistribute the model. No content tiles were downloaded.

The [City of Austin open-data portal](https://data.austintexas.gov/) was checked as an official discovery entry point. No downloadable photographic COTA mesh with reuse rights was verified. A [McKim & Creed project page](https://digital.mckimcreed.com/advanced-geomatics---geospatial) explicitly identifies an aerial LiDAR survey of COTA; it is evidence of a survey, not an openly licensed textured mesh, and was not downloaded or treated as one.

## Nearmap: viable procurement route, exact AOIs unverified

Nearmap's [3D products specification](https://help.nearmap.com/kb/articles/85-3d-products) describes photographic textured meshes and Cesium / OBJ / SLPK / 3MX / FBX delivery, with Cesium exports in ECEF. Its [export instructions](https://help.nearmap.com/kb/articles/741-export-3d) require a subscription with 3D export permissions and credits, and cap single exports at 50 km². Its [coverage API documentation](https://developer.nearmap.com/reference/coverage) and [resource-type guide](https://developer.nearmap.com/docs/requesting-resource-types) support checking `3d:mesh` coverage. A top-down imagery survey is not proof of mesh coverage.

No authorized account was available for exact Albert Park / Hard Rock Stadium / COTA / Strip mesh survey checks, so their capture dates, resolution and access price remain unverified. No demo credentials were reused. Offline export rights do not by themselves establish public web distribution rights; obtain the specific permitted application use in the agreement.

## Local evidence inventory

All raw research downloads live outside Git at `/workspace/research-assets/australia-usa/`. Important files are the two Melbourne municipal indexes; municipal catalogue metadata; MetroMap product catalogue, product-236/34/103 AOIs and price responses; commercial coverage images; the Austin item/scene metadata; and the CC BY 4.0 municipal `E5-20.zip` sample. Only this research document is intended as a repository change. The commercial product catalogue and original site HTML are research evidence, not source configuration for the application.
