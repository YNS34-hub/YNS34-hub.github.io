# Alpine Descent sources

This is an original first-person alpine cycling scene inspired by the landscape, road framing, daylight and descent in [the user's reference film](https://www.bilibili.com/video/BV1Tu4y187zN/). The film's location has not been identified. This scene uses Furka Pass as its independent geographic basis; it is not a claim of reconstructing the film's exact road. No game models, video frames, soundtrack, logos or commercial music are included.

## Terrain

`terrain.json` is a resampled local height field, in metres, from [Mapzen/Tilezen Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/), accessed 2026-10-10. Tile source headers identify `eudem/eudem_dem_5deg_n45e005.tif`.

Europe terrain data produced using Copernicus data and information funded by the European Union — EU-DEM layers. Processing/distribution: Mapzen/Tilezen. [Data attribution and licensing](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). The terrain is 19.2 × 15.2 km, sampled at 50 m. Near-road mesh subdivision improves roadbed alignment; it does not add measured elevation resolution. Heights subtract 1,500 m for local coordinates and preserve vertical scale.

## Road data

`src/worlds/alpine/road-data.json` is derived from Furkastrasse geometry by **© OpenStreetMap contributors**, retrieved through the Overpass API on 2026-10-10. [Open Database Licence (ODbL)](https://www.openstreetmap.org/copyright). The derived road database is also made available under the ODbL. It is resampled at approximately 12 m, smoothed for DEM noise and paired with local terrain elevations. The bicycle simulation separately bounds noisy interpolation grades. It is an artistic ride, not navigation or survey data.

## Materials and sky

All these assets are **CC0** from [Poly Haven](https://polyhaven.com/license):

- `meadow-color.webp`, `meadow-normal.webp`: [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock), encoded at 1K.
- `rock-color.webp`, `rock-normal.webp`: [Rock 01](https://polyhaven.com/a/rock_01), encoded at 1K.
- `daylight-2k.hdr`: [Kloppenheim 06 Pure Sky](https://polyhaven.com/a/kloppenheim_06_puresky), 2K HDR.
- Asphalt and its normal map reuse the existing CC0 [Asphalt 02](https://polyhaven.com/a/asphalt_02) assets under `/media/road/`.

Road furniture, pass houses, viewpoints, grass geometry and map UI are original project code. The map uses the existing bicycle and audio/ride systems. No private library or browser-imported media is needed.

## Reproduction

`python scripts/prepare-alpine-assets.py` (Python + Pillow, internet access) downloads/caches the open source data and prepares these assets offline. Runtime does not require Overpass, AWS or Poly Haven requests.
