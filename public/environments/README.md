# Circuit surroundings data

These files bundle real mapped surroundings for the 25 circuits supported by the
replay. They are fetched at build time; viewing a replay needs no map API key or
runtime map request. Regenerate with `python scripts/fetch-environments.py --refresh`.
The downloader caches source responses in the system temporary directory; remove
`f1-environments-cache` there to request a newer map snapshot.

## Sources and attribution

- Map geometry: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Source data is downloaded
  from the public OSM map API. Dense bounding boxes are subdivided and merged by
  OSM entity ID. Incomplete multipolygons are completed through the relation API.
- Geographic circuit outlines: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits),
  MIT license, under `circuits/<circuit ID>.geojson`. Datasets record their local
  origin and download timestamp; refreshed files also include the outline URL.
- The JSON files are a derived OSM database distributed under ODbL 1.0. Retain the
  map attribution and license when redistributing these files or their map views.

## Geometry and limits

Coordinates are `[east, north]` meters relative to each file's `[longitude, latitude]`
origin, using a local equirectangular projection. Road lines, building footprints,
water, parks, pitches and other vegetation follow their OSM geometry.
Mapped fence, guard rail, wall and retaining wall ways use `kind: barrier` and
their original line geometry. Buildings with explicit grandstand, bleacher, pit,
paddock or motorsport facility tags or recognizable names use `role: circuit`.
Mapped building and roof colors and roof materials are preserved when present.
Multipolygon islands and courtyards use `holes`. Original way IDs remain numeric; multipolygon
IDs use `relation/<OSM ID>/<outer ring index>`. Sea polygons follow directed OSM
coastlines and close on the dataset bounding rectangle; `sourceWayIds` identifies
the original coast ways. Extensive land-cover polygons are clipped to that rectangle.

OSM coverage varies: absence of a feature means it was not mapped under the queried
tags, not that no feature exists. Parks and vegetation are mapped land-cover areas,
not surveyed individual trees. Building height is the tagged height where available,
or tagged floor count multiplied by 3.2 meters; unknown height remains `null`.
There are no surveyed facade textures, building models or ground elevations here.
Projection, source-outline age and alignment with telemetry can affect apparent
placement. The source outline for Madrid can predate construction of the circuit.
`coverage.incompleteRelations` records any multipolygon that could not be assembled.
The fetch timestamp is not an assertion that every mapped feature is up to date.

## Included features

| Circuit | Buildings | Water | Vegetation | Road lines | Barriers | Circuit facilities | Features with holes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bh-2002 | 247 | 3 | 119 | 558 | 143 | 10 | 12 |
| sa-2021 | 198 | 2 | 67 | 631 | 2 | 4 | 4 |
| au-1953 | 6973 | 9 | 314 | 3531 | 98 | 7 | 20 |
| jp-1962 | 363 | 19 | 275 | 595 | 130 | 28 | 3 |
| cn-2004 | 243 | 33 | 34 | 445 | 15 | 17 | 6 |
| us-2022 | 2281 | 10 | 92 | 1473 | 0 | 22 | 7 |
| it-1953 | 1336 | 6 | 123 | 1287 | 144 | 35 | 9 |
| mc-1929 | 5545 | 24 | 238 | 3686 | 118 | 1 | 44 |
| es-2026 | 817 | 31 | 712 | 3580 | 292 | 0 | 21 |
| es-1991 | 327 | 11 | 128 | 750 | 38 | 18 | 12 |
| ca-1978 | 883 | 19 | 206 | 2239 | 122 | 35 | 8 |
| at-1969 | 459 | 8 | 130 | 377 | 56 | 9 | 6 |
| gb-1948 | 340 | 21 | 369 | 1018 | 331 | 29 | 1 |
| hu-1986 | 341 | 2 | 77 | 388 | 51 | 19 | 1 |
| be-1925 | 405 | 1 | 270 | 374 | 204 | 8 | 4 |
| nl-1948 | 2329 | 14 | 217 | 1129 | 90 | 1 | 22 |
| it-1922 | 2502 | 7 | 196 | 1100 | 51 | 45 | 14 |
| az-2016 | 2464 | 73 | 856 | 4476 | 104 | 0 | 111 |
| sg-2008 | 5320 | 50 | 273 | 7899 | 63 | 1 | 51 |
| us-2012 | 530 | 26 | 37 | 594 | 79 | 15 | 1 |
| mx-1962 | 3558 | 3 | 263 | 1556 | 204 | 46 | 16 |
| br-1940 | 8694 | 3 | 97 | 1070 | 89 | 5 | 118 |
| us-2023 | 1910 | 31 | 114 | 8908 | 93 | 0 | 40 |
| qa-2004 | 253 | 0 | 124 | 875 | 220 | 4 | 10 |
| ae-2009 | 468 | 13 | 751 | 1730 | 166 | 25 | 18 |
