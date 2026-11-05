# Geographic terrain elevation

These compact elevation grids are sampled from public Mapzen / Tilezen terrain
tiles. They contain measured DEM relief rather than extrapolating hills from
track telemetry. They are not a survey of the current circuit, and cannot
represent tunnels, bridge decks, recent construction, or every track camber.

Source: <https://registry.opendata.aws/terrain-tiles/>.
Contributing datasets and their attribution/license requirements:
<https://github.com/tilezen/joerd/blob/master/docs/attribution.md>.
The source tiles combine several datasets under their respective terms; no
single license is asserted for the combined collection. Each JSON records its
exact source tile URLs and attribution reference. Geographic circuit outlines
are © Tomislav Bacinger, MIT:
<https://github.com/bacinger/f1-circuits>.

Run `python scripts/fetch-terrain.py` to rebuild missing grids. `--refresh`
rebuilds existing JSON from cached source data. Downloads are cached in
`/tmp/f1-terrain-cache`; `--offline` prevents network requests. The application
does not contact the elevation tile service at runtime.

Each JSON covers the geographic outline's bounding box with 1,100 metres of
margin on all sides. `bbox` is `[west, south, east, north]` in longitude/latitude
degrees. `width` and `height` are the number of grid vertices, including both
edges. `heights` is row-major, west-to-east within each row and north-to-south
between rows, in absolute metres from the source DEM. Sample with bilinear
interpolation. A JSON `null` means the source tile has no valid height; it must
not be treated as sea level. Source HGT void samples are omitted and remaining
valid bilinear weights are normalized. An all-void sample remains `null`.

`origin` is `[longitude, latitude]`; `outline` uses the same local east/north
metres projection as the environment data: longitude difference ×
`111320 × cos(originLatitude)`, latitude difference × `111320`.
