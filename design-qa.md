# Design QA — Jie Tian Academic Portfolio

## Comparison setup

- Source: selected **Refractive Theorem / nonlinear sphere** concept
- Implementation: local production build at `1348 × 926`
- Comparison state: page top, light theme, WebGL-safe poster fallback
- Combined evidence: `../design-comparison.jpg` (kept outside the deployable project)

## Visual review

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | None | — |
| P1 | Long display headings overflowed at the 375 px breakpoint. | Reduced the mobile display scale and verified `scrollWidth === clientWidth` after accounting for the full-bleed visual. |
| P1 | The fixed navigation could visually compete with the translated display type. | Added a paper-colored navigation layer and explicit stacking isolation. |
| P1 | The first tablet composition hid the sphere below a long type block. | Rebalanced the 641–900 px typography, section gap, and sphere height so the visual enters the initial tablet viewport. |
| P2 | The fallback image repeated WebGL-only scientific labels. | Added an explicit fallback state that suppresses duplicate labels while preserving the interactive equation control. |
| P2 | Hero rhythm was looser than the chosen concept. | Tightened statement, action, metadata, and lower-edge spacing; aligned the display and sphere to the same top datum. |

## Interaction and accessibility checks

- Desktop navigation lands on all six sections and updates the active state.
- Mobile menu opens, changes its accessible label to **Close**, closes with Escape, and exposes every destination.
- The equation annotation updates `aria-expanded` and `aria-hidden` correctly.
- All five workflow steps update the live detail panel and pressed state.
- Skip link, visible keyboard focus, semantic heading order, reduced-motion CSS, and fallback text were verified.
- No site-owned browser console errors were observed. The only logged errors came from the cloud-browser extension itself.

## Responsive checks

- 375/390 px: no content-width overflow after fixes; controls remain readable and tappable.
- 768 px: dedicated stacked tablet composition; the sphere begins within the first viewport.
- 1348/1440-class desktop: source and implementation hierarchy, scale, and spatial balance match closely.

## Intentional differences from the concept image

- The live site keeps the requested **About** section before **Research**.
- Detailed assumptions are disclosed by interaction instead of being permanently printed in the hero.
- The production version uses verified factual copy, working navigation, and a real adaptive WebGL surface rather than mock interface decoration.

## Final result

**passed**
