# Photorealistic 3D sources

**5 November update:** see the [25-circuit acquisition audit](research/README.md)
for actual model listings, checked coverage polygons, prices, downloaded survey
samples and regional source reports. The Melbourne municipal index has now
been checked: none of the 146 Albert Park outline vertices lies within its
coverage. MetroMap's commercial 2025 coverage does contain all 146 vertices,
but its standard licence does not authorize this public web delivery.

Official documentation reviewed on **4 November 2026**. The application uses
Three.js. A configurable 3D Tiles URL is an integration point for an independently
authorized dataset; it does not supply a dataset, credentials, or a licence.

## What is required

Photographic building facades and recognizable city geometry require a textured
photogrammetry mesh or separately licensed detailed models. OSM footprint
extrusions and generic PBR materials cannot provide that information.

No complete, licensed photorealistic source covering all **25 circuit locations**
has been verified. Coverage must be checked against each circuit and its visible
surroundings, including capture date, texture detail, geographic reference,
elevation datum, streaming permissions and attribution. Camera zoom can be
continuous; captured geometry and imagery always have finite detail.

## Candidate sources and confirmed limits

| Source | Verified capability | Requirement or unresolved limit |
| --- | --- | --- |
| Google Photorealistic 3D Tiles | Textured 3D mesh, streamed through the Map Tiles API to compatible renderers. | Billing-enabled project, enabled API, authorized API key, eligible account/region, visible attribution. Not a universal source for all 25 locations. |
| City of Melbourne Photomesh 2020 | Downloadable OBJ/MTL/JPG and SLPK covering the City of Melbourne municipality; official DataVic record identifies CC BY 4.0. | Municipality coverage does **not** establish Albert Park circuit coverage. Inspect the tile index before downloading or integrating. |
| Singapore OneMap / SLA | Official Singapore mapping platform with 3D visualization and documented developer services. | No documented public phototextured 3D Tiles download/streaming API with redistribution rights was established from the official sources reviewed. Viewer access and a general open-data licence are not sufficient evidence for reusing its 3D scene. |

### Google

[Setup and delivery documentation](https://developers.google.com/maps/documentation/tile/3d-tiles)
requires billing, API enablement and an API key. The renderer manages streamed
tile requests after loading a root tileset. The current
[usage documentation](https://developers.google.com/maps/documentation/tile/usage-and-billing)
describes timed tile sessions and quotas; this is not an offline asset download.

For **new EEA-linked projects**, and existing projects that no longer qualify as
unmodified, Photorealistic 3D Tiles are unavailable under the changes effective
8 July 2025. Requests return HTTP 403. Google's suggested Maps JavaScript 3D
alternative is a different rendering integration; it is not a raw-tile source
for this Three.js implementation.
See [EEA-specific adjustments](https://developers.google.com/maps/comms/eea/map-tiles)
and [error documentation](https://developers.google.com/maps/documentation/tile/error_handling).

The [country coverage table](https://developers.google.com/maps/coverage) lists
3D availability for Singapore and Australia, but no 3D entry for China, Bahrain,
Azerbaijan or the UAE. Country availability does not confirm an individual
circuit. The [official coverage viewer](https://developers.google.com/maps/documentation/javascript/3d/coverage)
explicitly distinguishes worldwide terrain from geographically limited 3D surface
coverage and provides a location search.

[Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies)
require visible Google Maps attribution plus the applicable tile-provider credits;
credits cannot be hidden in a collapsed information panel. They also restrict
prefetching, storage, extraction and offline use. Independently created 3D overlays
are supported subject to those policies. Do not bundle Google's streamed mesh or
use a public demo's credentials.

### Melbourne

The [municipal photomesh page](https://data.melbourne.vic.gov.au/explore/dataset/city-of-melbourne-3d-textured-mesh-photomesh-2020/information/)
provides an interactive tile index and download links. The
[official DataVic catalogue](https://discover.data.vic.gov.au/dataset/city-of-melbourne-3d-textured-mesh-photomesh-2020)
specifies CC BY 4.0, MGA Zone 55 coordinates and the Australian Height Datum.
Published catalogue descriptions disagree on capture pixel size, so a particular
download's metadata must determine its resolution. Neither description warrants
infinite-detail rendering.

Albert Park is documented by the
[City of Port Phillip](https://www.portphillip.vic.gov.au/explore-the-city/shopping-and-retail/albert-park-and-middle-park),
and the Melbourne dataset explicitly describes its municipal extent. Do not label
this dataset as verified Australian Grand Prix coverage without checking its index.

### Singapore

Primary references are the [SLA OneMap overview](https://www.sla.gov.sg/geospatial/onemap/),
[OneMap API documentation](https://www.onemap.gov.sg/apidocs/), and
[OneMap open-data licence](https://www.onemap.gov.sg/legal/opendatalicence.html).
The licence applies to datasets actually made available under it and excludes
rights the agency cannot license. A documented authorized delivery route and the
specific 3D dataset's terms remain necessary before integrating OneMap scene data.

## Three.js integration requirements

The maintained [3D Tiles Renderer JS project](https://github.com/NASA-AMMOS/3DTilesRendererJS)
supports Three.js, streamed levels of detail and provider plugins. Checked package
version 0.5.4 declares Three.js >=0.167, compatible with this project's 0.169.
Pin and test the selected version rather than relying on moving upstream examples.

- Stream only tiles needed for the current camera; bound concurrent requests and
  memory, update camera resolution after resize, and dispose the tiles renderer
  when changing sessions. Decoders must be configured for the supplied compression.
- Use one local geographic frame for tiles, telemetry, cars and cameras. Retain
  the circuit's longitude/latitude origin and invert the validated geographic-to-
  telemetry fit to place telemetry in geographic metres. Do not stretch the
  geographic mesh to make a poor telemetry fit look plausible.
- Resolve horizontal and vertical references separately. A 2D outline fit cannot
  establish absolute elevation or reconcile ellipsoidal heights with AHD or other
  orthometric datums. Validate road height and bridge levels before placing cars.
- The upstream [ReorientationPlugin documentation](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer/three/plugins/ReorientationPlugin/)
  uses radians for latitude/longitude and describes its local axes as X west,
  Z north. The current replay uses X east, Z south. An explicit axis transform is
  necessary; blindly using default reorientation rotates the scenery incorrectly.
- Keep per-provider coverage, loading, permission and attribution states explicit.
  A configured endpoint must not be described as verified coverage until actual
  geometry is loaded at that circuit. Do not silently substitute illustrative
  buildings while calling the result photorealistic.

No paid account, subscription, credential, or third-party mesh was purchased or
provisioned during this source review.

## Configure an authorized survey

The runtime reads `public/scenery-sources.json`. Its shipped `circuits` object is
empty: the repository does not include or claim a photogrammetric survey.
To connect an authorized, CORS-enabled **ECEF/WGS84 3D Tiles** endpoint, add an entry
for its circuit ID. For example (illustrative path, not a supplied dataset):

```json
{
  "version": 1,
  "circuits": {
    "sg-2008": {
      "url": "/authorized-surveys/singapore/tileset.json",
      "originAltitude": 0,
      "attribution": "Required attribution from the licensed data supplier"
    }
  }
}
```

`originAltitude` is the survey's ellipsoidal height in metres at the local scene
origin, and must be calibrated: `0` above is a placeholder, not Singapore's
measured altitude. Horizontal placement uses the circuit outline alignment;
vertical alignment with telemetry requires survey datum validation. Do not store
private service credentials in this public file. Use a same-origin authorized
service or appropriately restricted public client credentials according to the
provider's requirements.

The generic adapter streams visible levels of detail in Three.js. It does not
implement Google-specific authentication, bypass regional restrictions, provide
a dataset, or establish a license. Dataset/provider credits remain visible.
The full-environment toggle shows the survey; circuit-only hides it and retains
mapped circuit structures. The OSM context is a **schematic fallback**, not a
substitute for the requested photorealistic scenery.
