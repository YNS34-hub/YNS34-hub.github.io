# Forest tree derivatives

Sources are public-domain [Poly Haven CC0](https://polyhaven.com/license):

- [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), source meshes C and B. Both have their own complete branch distribution and wood geometry. They are two actual source forms, not one tree with a different colour.
- [Pine Sapling Small](https://polyhaven.com/a/pine_sapling_small), all three source forms. The sapling's bark is retained. Its atlas primarily contains stem/cone material; the **fir needle photographs** above are explicitly reused for bounded canopy proxies instead of portraying stem textures as foliage.

`scripts/prepare-forest-trees.mjs` processes source glTF/binary files offline. Each JSON records the canonical source, exact binary range, range SHA256, source mesh and metric height. The large original models stay outside the repository and are never fetched by the website. C used bytes 445212268–478462203 (33,249,936 bytes); B used 288300420–445212267 (156,911,848 bytes). Those are **offline source sizes**, not browser payloads.

Wood is simplified with normal/UV attributes into three bounded LODs. Missing trunk UVs receive cylindrical mapping. Canopy placement uses the **entire selected source mesh**, voxel sampling and cutout fir-twig photographs on curved quads. The result is an attributed real-asset derivative, **not a full needle scan rendered at original resolution**. Individual needles cannot simply be pruned: that failed visual experiment removed most of the crown. Representative distant clusters retain area; near-ground clusters shrink proportionally to avoid crossing the source root plane. Photograph aspect ratios are preserved.

`scripts/prepare-forest-textures.py` combines the original photographed JPG RGB with the original supplied PNG alpha, encoded as 1K WebP. Source JPG normals are encoded as lossless WebP; this does not invent detail beyond those sources. No AI generation, tint/grading or upscaling is involved. The runtime loads six shared photographic maps, clones only the owned samplers and shares all tree geometry between streamed stands. Source/colour-space cache images are not disposed when leaving a stand.

The original `pine-shape.json` and earlier source textures remain available for existing code; they are not deleted or claimed as newly authored work. This directory contains no private media.
