# Alpine Descent sources

This is an original first-person cycling scene inspired by the road framing, sunlight, meadows and rocky valley in [the supplied reference film](https://www.bilibili.com/video/BV1Tu4y187zN/). The film's exact location has not been independently verified. Furka Pass → Gletsch is the scene's geographic basis. No game assets, film frames, soundtrack, logos or commercial music are distributed.

## Measured terrain and aerial imagery — © swisstopo

- `massif-dem.bin`: 1921 × 1521 signed little-endian Int16 half-metre samples, covering 19.2 × 15.2 km at 10 m spacing. The render mesh uses 10 m faces near the route and 20 m further away; low quality further reduces distant subdivision.
- `detail-dem.bin`: 1351 × 701 samples, covering the 5.4 × 2.8 km road region at 4 m spacing. Both fields come from the latest available 2 m [swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) tiles in the accessed catalogue, rather than subdividing a coarse surface and claiming additional measured detail. Elevations subtract 1500 m; vertical scale is preserved. An 80 m border blends the fields.
- `swissimage.webp`: 3072 × 2560 bounded offline SWISSIMAGE atlas from the official EPSG:3857 WMTS at zoom 14, approximately 6.56 m ground pixels at this latitude.
- `swissimage-near.webp`: 3584 × 1792 zoom-16 atlas, approximately 1.64 m ground pixels. Near scenery blends to this atlas; original aerial pixels remain bounded to their actual geographic position.
- `geography.json`: local frame, grid dimensions and atlas projection metadata. It contains no personal information.

Accessed 2026-10-10 through the [official STAC catalogue](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d) and [WMTS service](https://docs.geo.admin.ch/visualize-data/wmts.html). Processing and redistribution are permitted by [swisstopo's free-geodata terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices), with the required **© swisstopo** source acknowledgement. Terrain tinting, roadbed alignment and near-field material blending are artistic processing; this is not survey or navigation data.

`terrain.json` and `daylight-2k.hdr` are retained checkpoint assets; this version does not load them. The former was prepared from [Tilezen / Mapzen EU-DEM terrain](https://registry.opendata.aws/terrain-tiles/) at 50 m. Europe terrain produced using Copernicus data and information funded by the European Union — EU-DEM layers. [Original attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## Road — © OpenStreetMap contributors

`src/worlds/alpine/road-data.json` derives from Furkastrasse geometry retrieved through Overpass on 2026-10-10. The horizontal alignment is unchanged from `f67509e`; only road heights were updated to the measured terrain with bounded smoothing. The derived road database is made available under the [Open Database Licence](https://www.openstreetmap.org/copyright). Ride state, route identity, saved-progress namespace and the original `/cycling` map are retained.

## Materials, scans and sky — Poly Haven CC0

All original downloads and derivatives below are [CC0](https://polyhaven.com/license). These are source files, not redistributable website previews.

- `meadow-color/normal.webp`: [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock), 2K.
- `rock-color/normal.webp`: [Rock 01](https://polyhaven.com/a/rock_01), 2K.
- `road-color/normal.webp`: [Asphalt 01](https://polyhaven.com/a/asphalt_01), 2K, rendered with neutral colour grading.
- `clear-daylight-2k.hdr`: [Kloofendal 48d Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky), 2K.
- `rock_09/` and `rock_face_01/`: [Rock 09](https://polyhaven.com/a/rock_09) and [Rock Face 01](https://polyhaven.com/a/rock_face_01), actual scans with 1K diffuse/normal/roughness maps. Offline LODs keep 1738 / 4031 triangles and preserve UVs and normals. Source meshes remain alongside their runtime LODs.
- `grass_medium_01/`: [Grass Medium 01](https://polyhaven.com/a/grass_medium_01). Three complete clumps are reduced to 180 / 160 / 240 triangles, using original photographed diffuse, alpha and normal maps at 1K. A separately packed transparent clump atlas is used for dense low-cost meadow instances. No grass shadow render pass is added.
- Lower-route pines reuse the existing [Pine Tree 01](https://polyhaven.com/a/pine_tree_01) CC0 trunk and foliage under `/media/road/`. The original forest map and its assets are unchanged.
- Retained `daylight-2k.hdr`: [Kloppenheim 06 Pure Sky](https://polyhaven.com/a/kloppenheim_06_puresky), 2K.

Road furniture, pass houses, viewpoints and UI are original project code. Bike physics, rider, camera, audio, photo mode and museum systems continue to use the existing implementations. Raw source downloads stay in a temporary directory outside Git. Runtime makes no geodata / Poly Haven requests.

## Offline reproduction

Requires Python with Pillow, numpy, rasterio and pyproj, the project's Node dependencies, and internet access. `PALACE_ALPINE_CACHE` optionally overrides the temporary source-cache directory. Run in this order:

```sh
python scripts/prepare-alpine-fidelity.py
python scripts/prepare-alpine-near-image.py
python scripts/prepare-alpine-scans.py
node scripts/prepare-alpine-rock-lod.mjs
python scripts/prepare-alpine-grass.py
node scripts/prepare-alpine-grass-lod.mjs
```

The near-image preparation augments `geography.json` after the DEM / wide-atlas preparation. The older `prepare-alpine-assets.py` prepares the previous checkpoint; it is not the preparation command for this version. No Python tools run during site builds. Public builds retain the existing exclusion of all private music, lyrics, HTML, personal manifests and browser imports.
