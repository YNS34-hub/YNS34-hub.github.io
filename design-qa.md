# Design QA — Three.js Nonlinear Glass Revision

## Comparison setup

- Source: selected **Refractive Theorem / nonlinear sphere** concept
- Implementation: local production build at `1348 × 926`
- Comparison state: page top, light theme, settled entrance state
- Combined evidence: `../threejs-reference-comparison.jpg` (kept outside the deployable project)
- Mobile evidence: `../jie-tian-threejs-mobile-final-qa.jpg` at a verified 375 px content viewport

## Visual review

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | The previous canvas was a full-screen triangle that sampled the fallback WebP and changed its UVs; no 3D mesh, perspective camera, normals, or depth existed. | Removed the texture shader completely and replaced it with a welded, high-detail `IcosahedronGeometry` rendered by Three.js in a real perspective scene. |
| P0 | Pointer movement distorted the image and CSS tilted the whole canvas by only a few degrees. | Pointer drag now applies world-space quaternion rotations to the sculpture group without angular clamping; release velocity continues as decaying rotational inertia. |
| P1 | A smooth sphere would not express nonlinear geometry or reveal meaningfully different sides. | Added deterministic multi-frequency 3D displacement, six directional cavities distributed across front, sides, and back, asymmetric scaling, and recalculated smooth normals. |
| P1 | A single transparent surface did not communicate optical thickness. | Added a physical outer glass surface, a contracted back-face inner shell, PMREM studio reflections, three soft area lights, subtle dispersion, and a real soft shadow receiver. |
| P1 | Loading Three.js in the main bundle would penalize the text-first hero. | Deferred the 3D module until after first paint. The initial application bundle is about 6.5 kB; the 49 kB WebP remains the immediate fallback/LCP visual. |
| P2 | WebGL-only labels could duplicate the annotated poster in fallback states. | Scoped the new level-set labels and 360° affordance to `.webgl-ready`; the poster path hides them. |
| P2 | Mobile could spend desktop-level GPU resources. | Reduced geometry detail, DPR, transmission buffer scale, antialiasing, shadows, dispersion, and frame rate on coarse/small-screen devices. |

## Geometry and interaction checks

- Desktop geometry: welded detail-28 icosphere, `8,412` unique vertices and `16,820` triangles.
- Radius range after displacement: `1.224–1.744`, confirming meaningful XYZ deformation rather than uniform scaling.
- Perspective silhouette width changed from `0.5735` at the initial view to `0.5861` near 90° and `0.6119` near 270° in the projection check.
- The public QA controller supports exact 0°/90°/180° orientations without changing textures or UV coordinates.
- Horizontal and vertical drag update the sculpture quaternion; pointer capture preserves rotation outside the initial hit area.
- Inertia decays after release; very slow idle rotation begins after 2.6 seconds and yields immediately to user input.
- Surface breathing is a low-amplitude vertex displacement inside the physical material’s vertex stage, not a screen-space ripple.

## Accessibility, fallback, and lifecycle checks

- The existing equation control, semantic alternative text, keyboard focus, and page navigation remain intact.
- `prefers-reduced-motion`, very low-performance devices, missing WebGL2, context loss, and module/render failure all retain the clean WebP poster.
- Resize handling caps both DPR and total pixel budget; `IntersectionObserver` and page visibility pause offscreen rendering.
- Geometry, materials, PMREM resources, observers, RAF, and pointer listeners are disposed by the controller.
- The cloud QA browser exposes no WebGL context, so it correctly exercised the poster fallback rather than the GPU scene. Its only non-extension console condition was the expected unavailable-context path.

## Responsive checks

- 375 px: `scrollWidth === clientWidth`; hero controls stay readable and the sculpture begins at the lower edge of the first viewport.
- 390 px: `scrollWidth === clientWidth`; fallback annotations do not duplicate and the poster remains correctly masked.
- 768 px: `scrollWidth === clientWidth`; the dedicated stacked composition retains a 718 px-wide visual stage.
- 1348/1363 px desktop: the established typography, copy, navigation, and 55/45-style Hero balance remain visually unchanged.

## Intentional differences from the concept image

- On capable browsers, the live glass geometry is not pixel-identical to the WebP poster: that difference is required for genuine side and back views.
- The cursor shown in the original visual reference remains removed.
- Scientific labels stay quiet and outside the primary reading path; no HUD or simulated API behavior was introduced.

## Final result

final result: passed
