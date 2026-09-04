# Design QA — Jie Tian Academic Portfolio

## Comparison setup

- Source: selected **Refractive Theorem / nonlinear sphere** concept
- Implementation: local production build at `1348 × 926`
- Comparison state: page top, light theme, settled entrance state
- Combined evidence: `../strengthened-comparison-final.jpg` (kept outside the deployable project)

## Visual review

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | None | — |
| P1 | Long display headings overflowed at the 375 px breakpoint. | Reduced the mobile display scale and verified `scrollWidth === clientWidth` after accounting for the full-bleed visual. |
| P1 | The fixed navigation could visually compete with the translated display type. | Added a paper-colored navigation layer and explicit stacking isolation. |
| P1 | The first tablet composition hid the sphere below a long type block. | Rebalanced the 641–900 px typography, section gap, and sphere height so the visual enters the initial tablet viewport. |
| P1 | The static cover and live WebGL rendering used two different sphere constructions. | Made the retouched cover artwork the canonical texture for both states; WebGL now adds motion to that exact image instead of replacing it. |
| P2 | The source artwork contained a baked cursor and cropped scientific label. | Rebuilt the hero asset without the cursor and retained the complete `01 / LEVEL SETS` annotation. |
| P2 | The 390 px hero did not reveal the visual in its first viewport. | Tightened the mobile display scale and rhythm so the sphere now enters at the lower edge without crowding the identity and CTA content. |
| P2 | Hero rhythm was looser than the chosen concept. | Tightened statement, action, metadata, and lower-edge spacing; aligned the display and sphere to the same top datum. |

## Interaction and accessibility checks

- Desktop navigation lands on all six sections and updates the active state.
- Mobile menu opens, changes its accessible label to **Close**, closes with Escape, and exposes every destination.
- The equation annotation updates `aria-expanded` and `aria-hidden` correctly.
- All five workflow steps update the live detail panel and pressed state.
- Skip link, visible keyboard focus, semantic heading order, reduced-motion CSS, and fallback text were verified.
- No site-owned browser console errors were observed. The only logged errors came from the cloud-browser extension itself.
- The no-WebGL path keeps the same hero artwork and retains inertial pointer tilt; capable browsers add localized refraction, chromatic separation, directional light, and scroll response.

## Responsive checks

- 375/390 px: no content-width overflow after fixes; controls remain readable and tappable, and the sphere is visibly introduced at the lower edge of the first viewport.
- 768 px: dedicated stacked tablet composition; the sphere begins within the first viewport.
- 1348/1440-class desktop: source and implementation hierarchy, scale, and spatial balance match closely.

## Intentional differences from the concept image

- The live site keeps the requested **About** section before **Research**.
- Detailed assumptions are disclosed by interaction instead of being permanently printed in the hero.
- The live surface deliberately begins from the same artwork as the cover; the additional depth is interaction-driven and never changes the underlying composition.

## Final result

**passed**

final result: passed
