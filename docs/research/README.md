# Circuit photographic asset search — 5 November 2026

This is an acquisition and coverage audit for **all 25 circuit locations in the
project**. It does not claim that the application now contains these scenes.
The current `public/scenery-sources.json` remains empty; catalogue candidates
have not been purchased or streamed. Regional reports contain source links,
formats, dates, coverage evidence, licence restrictions and actual downloads.

| Project circuit | Best result from this search | Current gap | Report |
|---|---|---|---|
| Melbourne `au-1953` | MetroMap 2025 real photomesh; catalogue polygon contains all 146 outline vertices | Commercial; public web delivery needs separate rights. Free municipal mesh excludes track | [Australia/USA](AUSTRALIA-USA.md) |
| Shanghai `cn-2004` | No cleared whole-circuit photographic mesh verified | Source and usable delivery still missing | [Asia](SINGAPORE-ASIA.md) |
| Suzuka `jp-1962` | VI-grade lists an exact-circuit professional scenario | Scan method, export and web-delivery rights unverified | [Asia](SINGAPORE-ASIA.md), [catalogue audit](LATIN-AMERICA.md) |
| Bahrain `bh-2002` | Textured venue model offered for $29 | Authored model, not survey; purchase/accuracy/delivery unverified | [Middle East](MIDDLE-EAST.md) |
| Jeddah `sa-2021` | Textured venue model offered for $22 | Authored model, not survey; purchase/accuracy/delivery unverified | [Middle East](MIDDLE-EAST.md) |
| Miami `us-2022` | Aerometrex Miami photomesh exists | Published downtown extent excludes Hard Rock Stadium | [Australia/USA](AUSTRALIA-USA.md) |
| Imola `it-1953` | Official 2022 20 cm orthophotography sample | 2D photography, no photographic building mesh verified | [Southern Europe](EUROPE-SOUTH.md) |
| Monaco `mc-1929` | Official digital-twin lead | No cleared downloadable whole-circuit photographic mesh verified | [Southern Europe](EUROPE-SOUTH.md) |
| Barcelona `es-1991` | Official 25 cm orthophotography | 2D photography, no photographic building mesh verified | [Southern Europe](EUROPE-SOUTH.md) |
| Montreal `ca-1978` | Official photo-textured city buildings | Island/circuit completeness and accessible original downloads unresolved | [Northern Europe/Canada](EUROPE-NORTH-CANADA.md) |
| Spielberg `at-1969` | Official aerial imagery and elevation data | No photographic mesh verified | [Northern Europe/Canada](EUROPE-NORTH-CANADA.md) |
| Silverstone `gb-1948` | Professional UK photomesh supplier identified | Published stock coverage does not establish Silverstone coverage | [Northern Europe/Canada](EUROPE-NORTH-CANADA.md) |
| Spa `be-1925` | Official aerial image downloaded over circuit | 2D photography, no photographic mesh verified | [Northern Europe/Canada](EUROPE-NORTH-CANADA.md) |
| Hungaroring `hu-1986` | No cleared whole-circuit photographic mesh verified | Source and usable delivery still missing | [Northern Europe/Canada](EUROPE-NORTH-CANADA.md) |
| Zandvoort `nl-1948` | Official 5/8 cm orthophotography | 2D photography, no photographic mesh verified | [Southern Europe](EUROPE-SOUTH.md) |
| Monza `it-1922` | Official recent high-resolution aerial imagery located | View-only source does not establish redistribution; no cleared photomesh | [Southern Europe](EUROPE-SOUTH.md) |
| Madrid `es-2026` | Official aerial imagery and city mesh lead | Actual future race-layout mesh and licensed coverage not established | [Southern Europe](EUROPE-SOUTH.md) |
| Baku `az-2016` | Genuine photographed Palace of Happiness entrance | One architectural detail; authenticated download, not whole circuit | [Middle East](MIDDLE-EAST.md) |
| Singapore `sg-2008` | Specific textured circuit/city/landmark listings | Paid candidates; original scan provenance and exact city extent unverified | [Asia](SINGAPORE-ASIA.md), [marketplaces](MARKETPLACE-AUDIT.md) |
| Austin `us-2012` | Public city photomesh demo located | Demo is downtown, not Circuit of the Americas | [Australia/USA](AUSTRALIA-USA.md) |
| Mexico City `mx-1962` | Real circuit photogrammetry and VI-grade exact-circuit product | Photogrammetry not downloadable/licensed; professional model quote only | [Latin America](LATIN-AMERICA.md) |
| Interlagos `br-1940` | Actual municipal RGB LiDAR tile downloaded and decoded | Colored points need surface reconstruction and texture work | [Latin America](LATIN-AMERICA.md) |
| Las Vegas `us-2023` | Aerometrex photographic survey used for EA F1 23 | Commercial quote; licensed web delivery and current layout validation needed | [Australia/USA](AUSTRALIA-USA.md) |
| Lusail `qa-2004` | Professional 2026 survey-based simulator product | Restricted professional access, no standalone mesh export verified | [Middle East](MIDDLE-EAST.md) |
| Yas Marina `ae-2009` | Detailed paid models, official textured GIS, research LiDAR | Different access/rights/layout limits; none a cleared drop-in photographic scene | [Middle East](MIDDLE-EAST.md) |

## How these findings change implementation

The strongest actual photographic city sources are the named Aerometrex surveys.
OBJ/FBX inputs require geographic/vertical alignment, tiling, mesh and texture
optimization before they can be used in the app's Three.js 3D Tiles adapter.
Paid catalogue listings and publicly visible GIS scenes must not be copied into
the public source repository merely because a preview loads.

Open orthophotos are useful for authentic road markings, park paths, terrain
colour and placement checks. They do not contain the unseen facades or geometry
needed for helicopter-like oblique close-ups. RGB LiDAR supplies measured 3D
points but is not a textured triangle mesh. Both are reconstruction inputs,
not completed photorealistic scenes.

Downloaded evidence is retained locally outside version control. Regional
reports identify its source and limits. No purchase, supplier message, account
creation or proprietary-viewer extraction was performed during this search.
