# A quiet, growing museum

The desktop visual direction is architectural and editorial. An exhibit supplies
the character of a room; architecture frames it with scale, shadow, and restraint.
This iteration evolves the existing world, content configuration, and interface.

![The retained Atrium composition, actual browser capture](visual/atrium.png)

## Material hierarchy

| Surface | Treatment | Purpose |
| --- | --- | --- |
| Wall | Warm off-white `#e4e0d7`, roughness 0.76 | A calm background for work and typography. |
| Floor | Pale stone `#bfc3be`, roughness 0.38, metalness 0.045, restrained local bump | A distinct ground plane without mirror-like glare. |
| Ceiling | Grey `#cecfc9`, deeper beams and a recessed roof | An overhead volume with visible shadow hierarchy. |
| Reveals | Muted grey/metal, 0.66 m door-frame depth | Door thickness, inner frames, and scale. |
| Edges | Small rounded chamfers, usually 22 mm; reduced for thin members | Highlights catch the edge without excessive geometry. Low quality uses square edges. |
| Core | Physical transmission, IOR 1.49, thickness 3.4, icy-blue absorption, roughness 0.035 | The original continuous nonlinear sculpture remains the Atrium's focal point. |
| Listening | Dark walnut/acoustic fins, charcoal, warm grey stone | A room dedicated to sound rather than living-room furniture. |

`src/world/artDirection.ts` is the shared palette and lighting profile. Surface
textures are small deterministic local canvases in `src/world/materials.ts`; no
external texture or HDR service is required. Geometry and textures are disposed
when their owner unmounts. Mirror copies share one image texture.

## Lighting bible

| Space | Direction |
| --- | --- |
| Atrium | Cool daylight, a neutral key, legible structural shadows. |
| Projects | Neutral museum daylight; authentic interfaces are the visual subject. |
| Research | Neutral-cool, precise shadows and sparse mathematical structure. |
| Listening | Warm local spots, low global light, deep charcoal and walnut. |
| Wallpaper archive | Neutral viewing light; image color remains authentic. |
| AI playground | Restrained cool local illumination in a darker installation room. |
| Unfinished futures | Darker, directional light on partial structures. |
| Infinite corridor | Cold light, gradually offset openings and suspicious proportions. |

Ambient light is deliberately low. One locally generated PMREM environment is
reused across room travel. High/Medium directional shadow maps are 2048/1024;
Low disables live shadows. Local contact footprints ground important exhibits
without adding recursive reflection passes. No bloom, chromatic aberration, RGB
dispersion, film grain, or remote environment map was added.

## The listening installation

![A listening gallery, actual browser capture](visual/music.png)

One warm-stone listening table carries a walnut turntable, grooved vinyl platter,
tonearm, and sparse exhibition signage. Two integrated speaker columns and
instanced acoustic fins frame the album surface. Seating moves to the periphery.
The album respects its own aspect ratio; it is not a television rectangle.

Explicit playback raises the album gently, rotates the record, and adjusts local
light very slightly. Reduce Motion suppresses record rotation and settles the album quickly. The original
player, crossfade slots, local imports, metadata editing, NetEase links, and
IndexedDB collection continue to use their existing systems. Palace Study's new
square sleeve is original vector artwork; its existing audio is unchanged.

## Authentic works

![Real interfaces in the project exhibition](visual/projects.png)

The featured project is selected from content configuration and shown as a large
freestanding installation. Side exhibits show actual project interfaces. Their
color presence increases smoothly between 17 and 5 m rather than changing at a
hard threshold. Focus uses a two-column catalogue composition: original image,
provenance, description, status, technical context, and links.

Reviewer-First Audit's visible interface comes from its real offline renderer,
using explicitly invented demonstration metadata. The project remains described
as private and validation pending. No private manuscript, review, or real case is
used. See the [visual source manifest](../public/media/projects/README.md).

## Existing spatial rules, made visible

The deterministic graph and five resident corridor chunks remain. Progressing
through the corridor changes height, light placement, structural alignment, and
nested portal proportions. Decorative fragments were removed.

| Rule | Visual signature |
| --- | --- |
| Mirror | Paired repeated architecture and artwork with a displaced symmetry; finite geometry, no recursive SSR. |
| Gravity | Slow rotation of the architectural shell, clear 0°/90° datum lines, a stable walking horizon; disabled by Reduce Motion. |
| Floating | Actual suspended works surrounding a narrow transparent path. |
| Compressing | Solid walls and ceiling converge over eight stages; movement bounds follow the taper and preserve a clear return path. |
| Impossible | A thick, small entrance opens into an oversized court, offset frames, and 16 m columns. |
| Loop | The existing return door changes object position, orientation, text, and color according to visits. |
| Memory | The existing visit record progressively lights a quiet installation and preserves hidden-room access. |

Desktop framing is the priority of this iteration. Existing touch navigation,
responsive safeguards, accessible settings, and the complete 2D index remain.
Actual captures and the limits of verification are recorded in
[visual QA](visual-qa.md).
