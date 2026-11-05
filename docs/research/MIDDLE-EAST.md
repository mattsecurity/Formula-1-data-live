# Textured 3D circuit assets: Middle East and Caucasus

Checked **2026-11-05**. Scope: Bahrain/Sakhir, Jeddah, Lusail, Yas Marina and Baku. “Verified” below means that the public catalogue or API was inspected; it does **not** mean a paid model was purchased or its geometry independently surveyed. No purchases, account creation, outreach, restricted downloads or viewer extraction were performed.

## Result

There are concrete, commercially listed textured venue models for **Bahrain, Jeddah and Yas Marina**. None of the five has a verified, openly downloadable, whole-circuit photographic mesh with clean provenance in this search. The most promising official service is Abu Dhabi's textured I3S city model, but its reuse licence and actual Yas circuit content remain unverified. Baku has genuine downloadable photogrammetry of individual heritage details, not the whole race environment.

| Circuit | Best concrete source | Kind and exact coverage | Price / access | Usability now |
|---|---|---|---|---|
| Bahrain / Sakhir | [The Bahrain International Circuit — clickshop3d, CGTrader](https://www.cgtrader.com/3d-models/exterior/other/the-bahrain-international-circuit) | Seller-authored textured circuit scene; named Bahrain venue, not a photogrammetric survey. 63,219 polygons / 97,634 vertices. No acquisition date, accuracy tolerance or surrounding-area boundary supplied. | **US$29** displayed; account and purchase; Royalty Free License. | Strong paid candidate. FBX about 141 MB, OBJ about 142 MB, Blender about 160 MB, MAX, DAE, 3DS, Unity package, textures. No paid files downloaded. |
| Jeddah | [The Jeddah Street Circuit Saudi Arabia — 3d-apxumekmop, CGTrader](https://www.cgtrader.com/3d-models/architectural/other/the-jeddah-street-circuit-saudi-arabia) | Textured Jeddah Corniche venue scene, manually authored in MAX/Blender according to seller. Circuit-specific; no survey accuracy, layout year or geographic crop stated. | **US$22** displayed; account and purchase; **Royalty Free License (no AI)**. | Strong paid candidate. FBX about 105 MB, OBJ about 104 MB, Blender about 111 MB, MAX, DAE, Unity package and image textures. No paid files downloaded. |
| Lusail | [Lusail F1 — AmanitaCZ, TurboSquid 2328969](https://www.turbosquid.com/3d-models/lusail-international-circuit-f1-simple-3d-model-2328969) | **Road mesh only**: main circuit, two pit lanes and alternate routes, grid and sector lines; 8,941 polygons and 4K diffuse map. Buildings, grandstands and surrounding city are expressly absent from the described contents. | **US$19** displayed; account and purchase; Standard licence with **Editorial Uses Only** restriction. | Partial asset, insufficient for a photographic environment. FBX, OBJ/MTL, DAE, native CZB and texture. |
| Yas Marina | [Yas Marina F1 Circuit — AlphaGroup, RenderHub](https://www.renderhub.com/alphagroup/yas-marina-circuit-3d-model) | Textured/PBR venue model; 367,787 polygons, 291,016 vertices. Published August 2022, but track configuration not explicitly guaranteed. Preview backgrounds/scenes excluded. Not marked as a 3D scan. | **US$94.99** displayed; account and purchase; Extended Use **IP Restricted / Editorial Use Only**. | Concrete textured candidate; FBX, OBJ, 3DS, SKP; advertised download 27.3 MB. Need assess current layout and licence suitability. |
| Baku | [Baku — Anyscape / 3D City Models, ArtStation](https://www.artstation.com/marketplace/p/jr5NN/baku-3d-city-model) | City GIS scene and 1 m satellite ground imagery. **Buildings have no textures assigned**. Not a photographic mesh or race-furniture model. Full 6 km lap coverage must be checked against the purchased crop. | [Direct vendor](https://anyscape.io/3d-city-models/baku/) quotes from **US$99**; 1 km² evaluation sample advertised. Full asset requires order; no order submitted. | Geographic fallback only. MAX, FBX, OBJ, BLEND, GLB/glTF and other formats advertised; named format availability varies by package. |

Prices are catalogue observations, not offers or purchases. Marketplace labels do not establish that arbitrary third-party game assets have been licensed. None of these paid candidates is cleared for adding standalone model files to this public repository.

## More detailed Yas Marina options

- [Sarv3D777 — TurboSquid 2463727](https://www.turbosquid.com/3d-models/3d-yas-marina-circuit-model-2463727): **US$349**, published September 2025; seller describes the track, runoffs, kerbs, grandstands and surrounding environment with day/night lighting, real-world scale and image textures. Maya, Blender, FBX and OBJ. Standard licence, **Editorial Uses Only**; account/purchase required. This is a stronger stated environment scope than a road-only model. The catalogue's polygon and vertex counts both read **1**, so those statistics are unusable; real mesh complexity, layout and accuracy need review before purchase. No file downloaded.
- [almishal — TurboSquid 1540186](https://www.turbosquid.com/3d-models/3d-yas-marina-circuit-1540186): **US$250**, 549,571 polygons; MAX 2017/V-Ray, FBX, OBJ and 3DS, textures and UVs. Published April **2020**, so it cannot be assumed to match the 2021 redesign. Describes detailed track and grandstands including yachts. Standard licence, **Editorial Uses Only**; account/purchase required. Useful older-layout reference, not an immediately correct 2023+ replay scene.

## Official GIS: Abu Dhabi textured 3D objects

Public metadata returned HTTP 200 without credentials:

- [SceneServer](https://arcgis.sdi.abudhabi.ae/agshost/rest/services/Hosted/abu_dhabi_3d_city_model/SceneServer?f=pjson)
- [Layer 0 metadata](https://arcgis.sdi.abudhabi.ae/agshost/rest/services/Hosted/abu_dhabi_3d_city_model/SceneServer/layers/0?f=pjson)
- [Official portal item and licence metadata](https://arcgis.sdi.abudhabi.ae/portal/sharing/rest/content/items/1a83d67b4ac24411bd37a20c93c74156?f=pjson)

This is an **I3S 1.6 `3DObject`** scene layer, with triangle geometry, UV coordinates and **JPEG/DDS texture encodings**. It is not merely an extruded footprint FeatureServer. The advertised geographic extent is longitude **54.2920–55.0313**, latitude **24.2083–24.8667**, which contains Yas Marina. That proves bounding-box overlap, **not** that all circuit buildings or the road surface exist within the model. The portal item is public and advertises about **2.28 GB**; its `licenseInfo`, `accessInformation` and description are null. Service capabilities are `View` and `Query`, with no verified bulk model export.

**Decision:** valuable official textured-geometry lead, not an open-licence download. Only metadata was saved; no geometry, texture tiles or proprietary-viewer resources were crawled. Per-building coverage, date, export permission and licence need establishing before integration.

## Real research data at Yas Marina: A2RL Vmax

[TUM/KIT project page](https://tum-avs.github.io/A2RL_Dataset_website/) documents data captured at Yas Marina during the **2024** autonomous race: 297 scenes, 305,531 LiDAR point clouds and 28,791 annotated frames. This is real track sensing, **not** a ready-made textured 3D model.

The [actual Hugging Face dataset](https://huggingface.co/datasets/a2rl-vmax/a2rl-vmax) is **CC BY-NC 4.0**, approximately **67 GB**, published in Parquet with exporters for nuScenes/OpenPCDet point-cloud layouts. It requires a Hugging Face account, access-condition acceptance and authentication; unauthenticated README-file access returned **401** even though the public catalogue/tree is readable. No access request or download was made.

The current dataset card expressly says that point clouds are in vehicle coordinates and supplied `ego_pose` is identity; raw GNSS/INS streams exist, but no localization trajectory is supplied. Combining scans into a static scene therefore needs additional registration, and the stated streams do not provide a photographic textured mesh. It is a potential noncommercial reconstruction research input, not a drop-in asset.

## Lusail: survey-quality claim with professional access restrictions

[OHW Solutions — Lusail 2026 for Assetto Corsa](https://www.ohwsolutions.com/tracks/assetto-corsa/lusail/) advertises a 2026 circuit based on Q2 2026 LiDAR and a detailed simulator environment. **No public OBJ/FBX/GLB export, source-cloud download, geographic crop, standalone-model licence or fixed price is offered.** Access is by paid quote, restricted to verified motorsport teams, accredited professional drivers and driver academies; the page expressly excludes hobbyists, free trials and hobbyist pricing. Its unusual “14 Pt/mm” density and direct point-cloud tyre-contact claims were not independently validated.

**Decision:** a professional simulator licensing lead with real circuit scope, not an available public dataset or a model that can currently be used in this web app. No enquiry submitted.

## Baku: genuine photogrammetry, narrowly scoped

[Mehelle/Ajam Media Collective's acquisition account](https://www.mehelle.org/single-post/introducing-3d-models) explains that the project used its own **Polycam photogrammetry**, documenting details around Baku. This establishes a clearer acquisition source than anonymous circuit reuploads.

A concrete model is [the entrance to the Palace of Happiness](https://sketchfab.com/3d-models/the-baku-palace-of-happiness-wedding-palace-ac84f15f244e4c9bb949e3885e01e410). The [public Sketchfab metadata](https://api.sketchfab.com/v3/models/ac84f15f244e4c9bb949e3885e01e410) confirms **249,374 triangles**, 125,375 vertices, `isDownloadable: true`, **CC BY 4.0**, and explicitly describes an **entrance**, not the full palace or the circuit. The building is near the Old City environment; this asset cannot fill the complete Baku lap. Archive formats and file bytes were not verified because authenticated Sketchfab download access is required. No viewer extraction attempted.

[Topoqraf's Baku city/terrain service](https://www.topoqraf.az/en/services/3d-modelling/terrain-and-city-3d-model) describes drone-derived textured meshes, dense point clouds, orthophotos and DSMs, but provides **no existing Baku F1 circuit dataset, downloadable file, reuse licence or price**. It is a bespoke service, not a discovered asset; no outreach performed.

## Rejected or lower-detail sources

- **Ripped circuit models despite CC labels:** [Bahrain — Tyler_Dave](https://sketchfab.com/3d-models/bahrain-international-circuit-e93b0a1892c44efebbe0a92bf1ff479d) and [Yas Marina 2021 — Tyler_Dave](https://sketchfab.com/3d-models/yas-marina-circuit-abu-dhabi-2021-layout-c41b4e19912b4d79886bcd8d7d2536af). Public metadata says CC BY 4.0 / downloadable, but both tag themselves **`Ripped`, `ripped-model`, `asseto-corsa`**. **Excluded; no meshes downloaded.** Their face counts are 536,630 and 932,543 respectively; high polygon counts do not resolve provenance.
- [Nukedrop Jeddah 2024](https://www.overtake.gg/downloads/jeddah-street-circuit-f1-2024-night-race.40825/) is an authored detailed environment, but its own terms limit use to Assetto Corsa, personal/nonprofessional use and forbid modifications. Registration is required to download. **Excluded from conversion into this app.**
- [Lusail 2025 on OverTake](https://www.overtake.gg/downloads/lusail-international-circuit-2025.81364/) is a 49.2 MB rFactor listing with F1 25 tags and no demonstrated reusable-source licence. Registration required. **Not treated as cleared model content.**
- [Bahrain 70 km](https://www.artstation.com/marketplace/p/w2Xw6/bahrain-70km), [Jeddah 120 km](https://www.artstation.com/marketplace/p/2KYYa/jeddah-saudi-arabia-120km), [Lusail 20 km](https://www.artstation.com/marketplace/p/MOqnV/lusail-qatar-20km) and [Baku 50 km](https://www.artstation.com/marketplace/p/Rearw/baku-azerbaijan-50km), TurboCG: GIS city models, with satellite/map ground textures, rather than documented photographed facade meshes. Some listings explicitly allow generated building shapes and set up the satellite texture only in Cinema 4D. Circuit crop and detail are not guaranteed by the city name. These do not meet the requested photographic environment standard.
- [Open Heritage 3D — Al Balad Sami Office](https://openheritage3d.org/project.php?id=zd5x-jm42): real Jeddah photogrammetry, but in **Al Balad**, not the Corniche F1 circuit. Its email-mediated download does not solve circuit coverage.
- STL/3MF circuit outlines, printed relief maps, seating-viewer products and 2D orthophotos were not counted as textured circuit meshes.

## Evidence retained locally

Only public JSON metadata was saved under **`/workspace/research-assets/middle-east/`**, outside the repository: Abu Dhabi scene/layer/item, Sketchfab metadata for the rejected circuit models and Mehelle, and the A2RL public file-tree response. These are evidence records, not usable meshes. **No verified open full-circuit mesh was downloaded or added to the app.**
