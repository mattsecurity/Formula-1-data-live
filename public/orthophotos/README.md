# Photographic ground textures

These are actual aerial orthophotographs of the circuits and their surroundings.
They supply ground and roof appearance. They are not photographic facades or 3D
mesh models. Source years can predate current circuit construction or layouts.

The runtime index is `manifest.json`. Each entry records the image URL, exact
EPSG:4326 and EPSG:3857 bounds, north-up pixel dimensions, source endpoints,
attribution and license, capture information, working pixel resolution, source
request URLs, validation and SHA-256. Render the JPEG using Mercator-derived UVs;
its rows are uniformly spaced in EPSG:3857, not latitude.

| Circuit | Source photography | Source resolution | License |
| --- | --- | --- | --- |
| Zandvoort | PDOK / Beeldmateriaal winter 2025 | 5/8 cm product; local 5 versus 8 cm not distinguished | CC BY 4.0 |
| Barcelona | ICGC Ortofoto Territorial 2025 | 25 cm | CC BY 4.0 |
| Imola | RER March 2022; RER 2023–24 fills the pilot-survey gap in the surrounding area | 20 cm | CC BY 4.0 |
| Madrid | PNOA July 2023 at center and four bbox corners | 25 cm at those same metadata samples | CC BY 4.0 |
| Austria | Orthofoto Österreich / basemap.at, 2022 tiles | See `at-1969.source.json` | CC BY 4.0 |

The four imagery products made by `scripts/fetch-orthophotos.py` are resampled to a
4096-pixel longest edge (about 0.55–0.77 m/pixel at these locations), cropped to the
existing environment bounding boxes, and JPEG recompressed. Their combined image
payload is limited to 15 MB. Original source resolution is recorded separately;
resampling does not increase it. Madrid's 2023 photography predates the 2026 circuit.

Imola is a mosaic of two explicitly open regional products. The 2022 pilot survey
contains every checked circuit-outline point but not the entire surroundings
rectangle. Both WMS products are fetched as transparent PNGs. Only the 2022 source's
declared transparent no-data is filled with 2023–24 photography; the source alpha
union must cover every pixel. There are no generated replacement pixels or manual
reconstruction. Both epochs and sources are preserved in the manifest.

## Attribution and reuse

Keep the entry's `attribution` visible with the imagery, link its `licenseUrl`, and
identify the cropping, resampling, stitching and JPEG recompression. The sources
and license evidence are linked individually in the manifest:

- [PDOK Luchtfoto RGB](https://www.pdok.nl/introductie/-/article/pdok-luchtfoto-rgb-open-)
- [ICGC Ortofoto Territorial](https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Imatge/Ortofoto-Territorial)
- [RER 2022 RGB](https://geoportale.regione.emilia-romagna.it/catalogo/dati-cartografici/cartografia-di-base/immagini/layer-10)
- [RER 2023–24 RGB](https://geoportale.regione.emilia-romagna.it/catalogo/dati-cartografici/cartografia-di-base/immagini/layer-14)
- [IGN / CNIG reuse license](https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf)
- [Orthofoto Österreich](https://basemap.at/#nutzungsbedingungen)

## Reproduction

Python 3 and Pillow are required. From the repository root:

```sh
python scripts/fetch-orthophotos.py
```

Each WMS image request is at most 2048×2048. Network calls have connect/total
timeouts. Responses are cached under the system temporary directory in
`f1-orthophotos-cache`; `--refresh` bypasses that cache to fetch current provider
responses. Fixed-year products are used except PNOA's maximum-actuality service;
its capture date and native pixel size are queried at five points and stored.
Caching makes offline reruns reproduce the same image hashes while the source
responses remain present. Unknown manifest entries and independent
`*.source.json` records are preserved, so regeneration does not remove Austria.

Validation rejects constant source tiles, wrong sizes, uncovered Imola pixels,
excessive no-data on the circuit outline and a four-image payload above 15 MB.
All four final images have also been visually checked for actual circuit coverage.
