# Singapore and nearby Asian circuits: detailed model research

Checked 5 November 2026. Prices below are displayed USD prices, not purchases.
No model archive was acquired or integrated. Public catalogue pages, public
Sketchfab metadata and selected public preview images were inspected.

## Result

There are purchasable textured models of identifiable Marina Bay landmarks and
a vendor advertising an actual Marina Bay Sands drone reconstruction. There is
also a large city “scan” marketplace package, but its capture provenance and
precise coverage remain unverified. This research did **not** establish a freely
downloadable, redistributable photographic city mesh covering the entire F1
circuit. It also did not establish such a mesh for Shanghai International
Circuit or Suzuka. No claim about all 25 circuit environments follows from these
findings.

The circuit and city marketplace packages are recorded separately in
[MARKETPLACE-AUDIT.md](MARKETPLACE-AUDIT.md). In particular, Alpha92's circuit
listing excludes preview backgrounds, and TurboCG's city listing does not
establish the original image/model rights.

## Concrete named landmark candidates

These are authored architectural models advertised as textured, not verified
photogrammetry. Their named real-world locations establish relevance to the
Marina Bay view, but their model files have not been inspected or georeferenced.
No listing below promises a complete circuit neighbourhood.

| Model / seller page | Coverage relevant to the circuit | Listed deliverable and detail | Price / access / date |
| --- | --- | --- | --- |
| [Singapore Marina Bay Sands MBS — blushoes](https://free3d.com/3d-model/singapore-marina-bay-sands-mbs-2711.html) | Sands resort across the bay, including Shoppes and ArtScience Museum; skyline visible from the circuit, not the north-shore street network | FBX 45 MB, OBJ 69 MB, MAX, texture ZIP 142 MB; 422,000 polygons; UV mapped. Background and sky in previews excluded. Texture pixel dimensions unspecified. | $339; **Editorial Only**. Added 2023-01-28, updated 2023-02-08; no capture date. Purchase/account required. |
| [Realistic Marina Bay Sands — egyqueen](https://www.turbosquid.com/3d-models/realistic-marina-bay-sands-3d-model-1266552) | Same named landmark; not a city district | MAX 2013 / V-Ray, FBX, OBJ; 45,017 polygons, textured and UV mapped; texture dimensions unspecified | $99; **Editorial Only**. Published 2018-03-18; no survey date. Purchase required. |
| [The Flyer SG — junmedina](https://free3d.com/3d-model/the-flyer-sg-9526.html) | Singapore Flyer beside the eastern circuit/pit area | FBX 21 MB, OBJ 9 MB, MAX and associated materials; 71,502 polygons; UV mapped/textured. Preview renderer V-Ray 1.5; texture dimensions unspecified. | $179; **Editorial Only**. Added 2020-09-28, updated 2022-02-12; purchase required. |
| [Esplanade — eknaruto](https://free3d.com/3d-model/esplanade-5519.html) | Esplanade theatres immediately beside the circuit's waterfront sector | FBX, `images.zip`; listing reports 3 MB, 50,000 polygons, textures and UV mapping. Texture dimensions unspecified. | $50; **Editorial Only**. Added 2021-11-12, updated 2025-07-22; purchase required. |

“Editorial Only” needs an explicit fit with the eventual product and delivery
method; a race-related subject does not itself settle that question. None of
these listings authorizes putting its raw model in a public Git repository.
Rendered preview appearance is not proof that exported FBX materials reproduce
that appearance in Three.js.

## Photographic capture and city coverage leads

- [Future Elements Technology's own demonstration page](https://www.mtouchmap.com/video.html)
  explicitly describes drone oblique photography of **Marina Bay Sands** in its
  “Global Visual Effects Rendering System / Dynamic Vehicle Simulation” demo.
  This is a concrete named capture lead, unlike a generic service advertisement.
  However, no acquisition date, texture resolution, coverage polygon, file
  download, delivery format, price or redistribution licence is published there.
  The page does not prove the entire street circuit is included or establish
  that the company owns the underlying survey. It remains a potential licensed
  source, not an acquired asset. No enquiry was sent.
- [Tiki3D gallery](https://tiki3d.com/gallery/) and the creator's
  [Esplanade reconstruction post](https://www.linkedin.com/posts/jacky-xu-88a75814a_3dmodeling-digitalisation-geospatial-activity-7387058885586722816-iupT)
  describe aerial-image reconstruction using TikiSplat/3D Gaussian splatting.
  The post identifies Esplanade and discusses a future ambition to reconstruct
  the whole bay: it is not evidence that a whole-bay asset already exists.
  No reusable download, licence, price, capture date or texture-resolution
  specification was verified.
- [TurboCG Singapore 3D Scan City](https://www.artstation.com/marketplace/p/M3gmo/singapore-3d-scan-city-3d-model)
  is the strongest off-the-shelf city-size *listing* found: FBX 3.2 GB compressed,
  texture ZIP 4.7 GB and up-to-16K images. See the marketplace audit for prices
  and licence limits. The public preview image URLs were tested but returned
  HTTP 403 in this environment; their actual Marina Bay coverage could not be
  independently visually confirmed. No geographic bounds or capture source is
  given in the listing. Do not describe it as verified full-circuit coverage.

## SLA / OneMap: actual access boundary

[OneMap 3D](https://www.onemap3d.gov.sg/) is a viewer, and the
[official OneMap API documentation](https://www.onemap.gov.sg/apidocs/) did not
establish a documented open phototextured-mesh export API for this use.
[NUS Urban Analytics Lab's Singapore data guide](https://ual.sg/project/open-urban-data-singapore/),
updated 8 April 2026, explicitly says the OneMap 3D data cannot be downloaded
and is therefore not open data. This is independent academic evidence, not a
substitute for a contract with SLA. The guide's open HDB models are CityJSON/OBJ
building models, not the requested photographic Marina Bay environment.

SLA's [GeoWorks licensed-data page](https://geoworks.sla.gov.sg/sla-products/licensed-data/)
returned HTTP 502 during verification. Consequently no exact price, export
format, commercial-web redistribution grant or Marina Bay coverage package was
verified. A visible building in OneMap does not establish permission to extract
its viewer payload. Unofficial OneMap scraping/export tools were not used.

## Free model checks: useful exclusions

Public metadata was checked through `https://api.sketchfab.com/v3/models/{uid}`.
The API returned HTTP 200 JSON for the entries below. An unauthenticated call to
the documented `/download` endpoint for model
`7f71bb6e887d48058bff9cff538315ee` returned **HTTP 401**, with “Authentication
credentials were not provided.” Metadata availability therefore did not supply
a model archive. No viewer mesh payload was extracted.

| Entry | Verified observation | Decision |
| --- | --- | --- |
| [Singapore Office Skyscraper [FREE] — 99.Miles](https://sketchfab.com/3d-models/singapore-office-skyscraper-free-2305f0fe03ba44229a1f768dcb48bd8f) | CC BY 4.0; 26,396 faces, 13 textures; 2023-07-07. Author calls it an art test of a downtown Singapore office. | Actual building identity/location unverified. Do not place it as a real Marina Bay building. |
| [Marina Bay Sands — karinkakravchenko](https://sketchfab.com/3d-models/marina-bay-sands-4a394733cd65462ea4d1a44196e12cb8) | CC BY 4.0; 8,771,038 faces, **zero textures**. Public preview visibly stylized. | Reject for photographic detail despite the polygon count. |
| [Singapore — jack.simmons](https://sketchfab.com/3d-models/singapore-eab2e61c23f2453e93aa58d5561c11b2) | CC BY 4.0; 1,218,736 faces, one texture. Preview shows grey extruded blocks. | Reject as a solution to the requested photographic city. |
| [Merlion — adm360vr](https://sketchfab.com/3d-models/merlion-7f71bb6e887d48058bff9cff538315ee) | CC BY 4.0; one texture. Preview is a scanned **plush toy**, not Merlion Park's statue. | Reject geographic relevance. |
| [National Gallery Singapore Model (Exterior) — mr.mushi](https://sketchfab.com/3d-models/national-gallery-singapore-model-exterior-60a12d69f41f499eb52f51ef2ba7c27d) | CC BY-NC-SA 4.0; 202,102 faces, two textures. Preview shows an incomplete scan with a cut base; title identifies a “Model”. | Not established as an actual full-size exterior survey; noncommercial restriction also applies. |
| [Empress Place Underpass — mr.mushi](https://sketchfab.com/3d-models/empress-place-underpass-3ce5deab5de84fa0bf0744a8e3ed75fb) | CC BY-NC-SA 4.0; 87,200 faces, one texture; published 2021-09-13. Author supplies location **1.28768, 103.85272**, below Anderson Bridge. | Concrete local scan near the circuit, but only an underpass and restricted to noncommercial use. It cannot supply an aerial city. |
| [Helix Bridge — Sengchor](https://sketchfab.com/3d-models/helix-bridge-1221edc4c2454b29b3b6adcd6fdefb0e) | CC BY 4.0; 159,533 faces, zero textures; published 2022-06-18. Author describes modelling from a tutorial. | Identifiable waterfront geometry, not a photographic capture. |

The [Tyler_Dave Marina Bay circuit upload](https://sketchfab.com/3d-models/marina-bay-street-circuit-e665d831c57546609d4c15287a6107b7)
advertises 99 textures and a CC BY licence, but its description says the model
is corrupted and points to an alternate archive. Underlying creation/ownership
was not established. The licence selection alone is insufficient provenance;
the archive was not downloaded or promoted as a usable acquisition.

## Shanghai and Suzuka

[UrbanScene3D](https://vcc.tech/UrbanScene3D), from Shenzhen University's Visual
Computing Research Center, includes a Shanghai simulator scene. Its terms
restrict use to noncommercial purposes and prohibit redistributing the dataset
or altered versions. It also does not establish Shanghai International Circuit
coverage. Thus its downloadable research data cannot be bundled into this app.

Suzuka searches found third-party textured circuit uploads, but no verified
redistributable photogrammetric environment. One
[Suzuka upload](https://sketchfab.com/3d-models/suzuka-3fb86f8c589748a9af81341db4ae8822)
explicitly describes its source as **F1 2010**; an uploader-selected CC BY label
does not supply the game's rights. No such game-derived asset was acquired.
Generic Japanese city datasets do not prove Suzuka circuit coverage. Both
Shanghai and Suzuka remain **unresolved**, not verified unavailable everywhere.

## Integration consequence

The strongest concrete candidates are the named purchased landmarks and a
licensed Marina Bay survey with established extent. For either, retain the
original coordinate system or surveyed control points, capture/layout year and
height datum. Convert to web-sized glTF/3D Tiles only after confirming delivery
rights. Textures, LODs, geometric registration and car-to-road elevation need
validation against the actual files; no catalogue can establish “infinite zoom”.
