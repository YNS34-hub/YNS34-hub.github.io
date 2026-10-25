# Park Court — public assets

The supplied [Bilibili video BV1P8tH6gEMM](https://www.bilibili.com/video/BV1P8tH6gEMM/) is a visual reference only. No frames, game meshes, logos, sound recordings or video are included here. Court painting, hoop/support, net, fence, benches, lighting and background architecture are original project code.

## Poly Haven — CC0

- aggregate maps: [Asphalt 04](https://polyhaven.com/a/asphalt_04), 2K diffuse, OpenGL normal and roughness.
- paving maps: [Brick Pavement 02](https://polyhaven.com/a/brick_pavement_02), 2K diffuse, OpenGL normal and roughness.
- tree: [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree). Original 19.32 m shape, branches/trunk textures and photographed leaf atlas. Branch/trunk geometry is reduced offline; canopy locations are derived from the original geometry and reconstructed with alpha-cutout photographed sprigs. This is a botanical derivative.
- day-sky.webp: a 4K derivative of the existing Alpine clear-sky-8k.webp. Original: [Kloofendal 48d Partly Cloudy Puresky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky). The existing 2K HDR supplies static IBL.

All Poly Haven derivatives are [CC0](https://polyhaven.com/license).

## Microsoft Rocketbox — MIT

Six avatars from [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), source revision 0943055db6ec570bcef9f2c8b41c9e5467c808f9. Original diffuse textures are reduced to 512px WebP. The library's male/female neutral standing animation provides a single baked resting pose per type. Geometry is metre-scaled and instanced at the sidelines.

Retain [ROCKETBOX-LICENSE.md](ROCKETBOX-LICENSE.md) with redistributed files. Copyright (c) 2020 Microsoft, MIT.

## Reproduce

Run prepare-court-assets.py (trees, people, surfaces), prepare-court-tree.mjs, prepare-court-crowd.mjs, and prepare-court-painting.py from the scripts directory. Raw source downloads stay in E:/Temp/palace-court-source, outside Git. Runtime UVs preserve the appropriate FBX/glTF orientation.

No private media, commercial audio or browser imports are part of this package.
