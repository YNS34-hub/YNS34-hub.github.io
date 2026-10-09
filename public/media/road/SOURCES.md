# Road-cycling environment textures

These are public-domain CC0 assets from Poly Haven, resized/encoded as 1K WebP for this scene. They remain freely available from the original source. No private media is included.

- `asphalt.webp` and `asphalt-normal.webp`: [Asphalt 02](https://polyhaven.com/a/asphalt_02).
- `bark.webp` and `pine.webp`: bark and a cropped twig of [Pine Tree 01](https://polyhaven.com/a/pine_tree_01). The supplied twig alpha channel is preserved.
- `pine-shape.json`: an offline, vertex-clustered version of that CC0 tree's wood (3,756 triangles), with 1,700 sampled canopy positions rendered as cutout twig cards. The 905 MB needle model is never shipped. `scripts/prepare-road-tree.mjs` records this conversion. Each streamed sector instances the small shared geometry; distant crowns are locally composed from the same canopy and texture.
- `ground.webp`: [Forest Leaves 04](https://polyhaven.com/a/forest_leaves_04).
- `grass.webp`: [Leafy Grass](https://polyhaven.com/a/leafy_grass).

License: [Poly Haven CC0](https://polyhaven.com/license). Bicycle, road, terrain, architectural and UI geometry is original project code; the pine shape is explicitly attributed above. The site does not use any commercial road-bike logos.
