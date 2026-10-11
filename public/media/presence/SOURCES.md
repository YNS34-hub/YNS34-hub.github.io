# Outdoor practice avatar — MIT

Source: [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), pinned revision 0943055db6ec570bcef9f2c8b41c9e5467c808f9.

Sports_Male_04 provides the rigged athlete, original blue jersey, white shorts and shoes. The original idle, neutral walking and neutral running clips are retargeted without horizontal root motion. The public release uses this licensed base character; it is not a face scan of Jie Tian or an NBA player.

Only the metre-scale rigged glTF, necessary animation tracks, 1K WebP textures and this MIT notice ship. Raw FBX and textures remain outside Git. Skinning, hands/feet constraints and finishing/cycling choreography use the existing gameplay state. No game meshes, logos, footage or private media are included.

The additive wardrobe uses owned geometry / material clones, bounded shape deformation with preserved smooth normals, shader recoloring and original cap / daypack geometry. The public release adds no private photo textures. Optional photo-informed shape parameters and an artistically derived local head atlas are registered only in local development / personal builds; `build:public` emits an empty profile and removes the generated private atlas. These adjustments are an approximate artistic interpretation of visible features, not photogrammetry or motion capture. The six outfit styles are original variations on the existing base rig.

Retain [ROCKETBOX-LICENSE.md](ROCKETBOX-LICENSE.md), Copyright (c) 2020 Microsoft. Reproduce using scripts/prepare-sport-avatar.py then scripts/prepare-sport-avatar.mjs.
