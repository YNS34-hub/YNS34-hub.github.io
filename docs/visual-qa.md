# Desktop visual inspection

Final verification: lint, 42 unit tests, TypeScript/production build, 10 production
browser scenarios, and three native audio-travel checks passed. The legacy glass
import graph, manifold geometry, and reduced-motion/WebGL fallback checks also
passed. Both project branches pass their GitHub CI. The machine-readable scope
and observations are in [verification.json](visual/verification.json).

These are actual Chromium captures of the running application, not concept renders.
The baseline is `codex/the-memory-palace` at `7b2aef4`. The desktop inspection uses
1600 × 1000, Medium quality, and device scale 1; Focus is also inspected at 1440 ×
900 and the collection index at 1920 × 1080. Local media and the original content
systems remain in use. No manuscript, review, or real audit case was used.

## Before and after

| Space | Before | After |
| --- | --- | --- |
| Atrium | ![Original Atrium](visual/before-atrium.png) | ![Retained composition with distinct surfaces](visual/atrium.png) |
| Listening room | ![Original furniture composition](visual/before-music.png) | ![Central listening installation](visual/music.png) |
| Projects | ![Original abstract project covers](visual/before-projects.png) | ![Actual interfaces in the gallery](visual/projects.png) |

The Atrium retains its typography and camera composition. Wall, stone floor,
ceiling, reveals, and the continuous glass sculpture now respond differently to
light. The gallery headings move away from central exhibits. The listening room
uses one turntable installation, integrated speakers, acoustic surfaces, and
peripheral seating. Close inspection led to a lower platter and quieter wood
grain, so the record and tonearm can be seen from normal eye height.

![Listening installation at normal eye height](visual/music-installation.png)

![Explicit playback gently raises the album](visual/music-playing.png)

The remaining rooms share a material and lighting vocabulary while keeping their
own purpose: a neutral research exhibit, a dark experimental installation, a
directionally lit unfinished archive, and a neutral image gallery.

| Research | Experiments | Unfinished futures | Images |
| --- | --- | --- | --- |
| ![Research](visual/research.png) | ![Experiments](visual/experiments.png) | ![Archive](visual/archive.png) | ![Images](visual/wallpapers.png) |

## Spatial signatures

The corridor changes structural proportions, light slots, roof alignment, and
frame scale gradually. It still streams five deterministic chunks. These images
show progression, rather than presenting one long room as an infinite system.

| Arrival | Later structure | Final nested frames |
| --- | --- | --- |
| ![Corridor arrival](visual/corridor.png) | ![Changing architectural datum](visual/corridor-phase-3.png) | ![Impossible nested structure](visual/corridor-phase-5.png) |

| Mirror | Compression | Small entrance | Oversized interior |
| --- | --- | --- | --- |
| ![Finite repeated symmetry](visual/mirror.png) | ![Solid tapered room](visual/compressing.png) | ![Deep small doorway](visual/impossible.png) | ![Larger interior court](visual/impossible-inside.png) |

| Gravity | Floating | Loop | Memory |
| --- | --- | --- | --- |
| ![Architecture turns around a stable horizon](visual/gravity-datum.png) | ![Suspended collection](visual/floating.png) | ![Return with a difference](visual/loop.png) | ![A room remembers visits](visual/memory.png) |

Gravity rotates the architectural shell smoothly while keeping the camera
horizon stable. Reduce Motion disables that rotation. Compression uses solid
tapering walls and corresponding walk bounds. Mirror uses finite shared-image
copies rather than recursive realtime reflections. Loop and Memory continue to
use existing local visit state.

## Presentation and legibility

Focus presents the real interface at its own aspect ratio with a provenance
caption and an editorial description. Reviewer-First Audit is shown through its
actual offline renderer using explicitly synthetic demonstration metadata. No
private report or source was copied into this public project.

![Focus: actual Audit interface, synthetic metadata](visual/project-focus.png)

![Museum guide](visual/museum-guide.png)

![1920 px collection index](visual/index-desktop.png)

![1440 px Focus](visual/focus-1440.png)

Screenshots wait for native overlay transitions to settle. The dark-room header
has a restrained contrast treatment so the roof light does not erase its text.
Focus, Guide, and the index show no horizontal overflow at the inspected sizes.

## Rendering cost

Counts below are visible-frame measurements, including the retained original
Atrium sculpture. The Listening arrival camera changed to suit the new
installation; the other baseline room camera positions are retained. Triangle
counts increase in some rooms because edges and frames now have real depth.

| Room | Before draw calls | After draw calls | After triangles | After textures |
| --- | ---: | ---: | ---: | ---: |
| Atrium | 196 | 181 | 97,376 | 21 |
| Listening | 150 | 82 | 13,100 | 21 |
| Projects | 112 | 59 | 4,676 | 18 |
| Research | 42 | 42 | 8,952 | 10 |
| Wallpapers | 53 | 53 | 4,134 | 17 |
| Experiments | 87 | 85 | 7,308 | 12 |
| Unfinished | 74 | 64 | 8,616 | 14 |
| Corridor arrival | 58 | 71 | 6,070 | 25 |

At corridor Z = −108 m the measured frame uses 61 draw calls, 6,414 triangles,
37 textures, and five resident chunks. Rounded geometry is omitted on Low;
texture sizes and material complexity still follow the existing quality budget.
The wall/floor maps are tiny seeded local canvases, acoustic fins are instanced,
and repeated mirror works share a texture. No SSR, remote HDR, or extra
postprocessing pass was added.

**Hardware limit:** this environment renders WebGL with Chromium/SwiftShader.
These counts verify a bounded scene and guide optimization; they do not establish
45 FPS on a GTX 1650 or 60 FPS on a hardware GPU. Those targets require a separate
1080p measurement on the intended Windows machine. This iteration prioritizes
desktop composition; mobile visual redesign was outside its scope.

## Reproduce

```sh
npm ci
npm run dev -- --port 5174
PALACE_URL=http://127.0.0.1:5174 npm run qa:visual
PALACE_URL=http://127.0.0.1:5174 PALACE_STORY=1 PALACE_MOVEMENT=1 npm run qa:visual
```

The visual script exercises explicit native playback and mouse look, captures
room composition, checks overlay overflow, observes console/runtime/resource
errors, and can assert native WASD movement, wall containment, taper return, and
the resident-chunk limit. Developer scene inspection is absent from production.

For production regression use an ordinary static server, so Vite's SPA fallback
cannot hide missing route files:

```sh
npm run lint
npm test
npm run build
python3 -m http.server 5175 --directory dist
PALACE_URL=http://127.0.0.1:5175 PALACE_VERIFY_DIST=1 npm run test:browser
PALACE_URL=http://127.0.0.1:5175 npm run test:audio-travel
npm run test:hero
```

The build writes 49 directly shareable static routes, with 42 in the sitemap.
Hidden rooms have standalone HTML and `noindex` metadata; they stay out of Guide
and the sitemap. The four original legacy documents remain intact. Browser
regression checks the actual built route files and assets, local audio/image
imports and IndexedDB restoration, legal NetEase links, direct Focus URLs,
bookmarks, comfort settings, room travel, fullscreen viewing, cinema, and the
existing touch/WebGL fallback behavior.

The production build deliberately omits developer camera inspection. Its exact
movement diagnostic is therefore skipped; the development visual run verifies
native WASD, corridor containment, five resident chunks, and return movement
inside the tapered room. Native audio inspection confirms the same two crossfade
slots and the same playing Audio element across Listening → Projects → Research,
with advancing playback time and no pause, end, abort, or empty events in travel.
