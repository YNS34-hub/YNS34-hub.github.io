# Design QA — Real WebGL2 Hero acceptance

## Scope and evidence

Date: 5 September 2026. Starting main: `97a5d264f81e94706930492f079eea8f861069f4`.
The earlier cloud-browser screenshots were poster fallbacks and did not validate GPU appearance. This report supersedes those visual claims.

The new local acceptance run uses the installed Google Chrome, with an isolated Playwright browser profile. The renderer reports:

- `WebGL 2.0 (OpenGL ES 3.0 Chromium)`
- `ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 (0x00001F99) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- `data-render-mode="three-webgl"` before every 3D screenshot; the suite refuses to save fallback images under 3D evidence names.

Mobile checks use Chrome device/viewport and trusted touch-event emulation on this GPU. They are not measurements on a physical phone or Safari.

## Issues actually found and fixed

| Finding in real Chrome | Final change |
| --- | --- |
| Milky, nearly uniform surface with weak optical depth | Double-sided physical transmission renders the actual rear surface into the transmission pass. Removed the blended inner shell. Reduced roughness/coating and used neutral clear glass, IOR 1.52 and thickness 1.7. |
| Uniform screen-space background concealed refraction | A purpose-built PMREM studio supplies softbox/flag contrast. A world-normal Snell-ray environment contribution supplements screen-space transmission, including its refracted rear surface and reference curves. This is an environment-light approximation, not offline path tracing. |
| Shallow cavities and visible coarse contour changes | Deepened the six cavities, reduced fine noise, and increased welded mesh detail to 48 desktop / 24 mobile. |
| Hard, clipped opaque-looking shadow | Replaced the shadow map with an analytic feathered contact shadow. This is a presentation shadow, not a physically traced glass caustic. |
| Desktop title intersected the subtitle | Increased the desktop subtitle top margin; existing mobile overrides remain. |
| Mobile sculpture almost touched the canvas edge | Moved the mobile camera back and reduced presentation scale to keep the complete contour visible. |
| PMREM sigma sampling warning | Reduced PMREM blur from 0.045 to 0.008; no such warning in the new run. |
| Stale animation metadata after fallback | Fallback now explicitly reports stopped animation and disabled drag. |
| Double-sided shader variants could use different breathing times | Update time uniforms in both compiled front/back programs. |

Colors remain clear/silver with restrained cool edge lighting and small dispersion. No blue body color, poster texture, UV distortion or CSS canvas rotation drives the 3D sculpture.
README, CI, cover assets, public contact details and other page sections were preserved.

## Actual local browser results

| Check | Observed result |
| --- | --- |
| Desktop 1440 x 1000 | Real WebGL2; initial screenshot saved; title/subtitle no longer overlap. |
| Horizontal pointer drag | Two approximately 242 px drags measured 90.0 degrees and 180.0 degrees. The controller only establishes the initial 0-degree reference; the subsequent turns use mouse events. |
| Vertical pointer drag | 120 px measured 44.7 degrees pitch. |
| Release inertia | Yaw continued from 44.7 to 60.6 degrees after 400 ms without further input. |
| Idle rotation | Yaw advanced from 65.8 to 68.1 degrees over 2 seconds after inertia settled. |
| 375 / 390 / 768 px | Each reported `scrollWidth === clientWidth`, at the requested CSS width, in `three-webgl` mode. Complete hero screenshots reviewed. |
| Touch at 375 / 390 px | Chrome emitted `pointerType: touch`, `isTrusted: true`. A 140 x 40 px diagonal drag changed yaw from -24.1 to 35.7 and pitch from -7.4 to 8.6 degrees. |
| Reduced motion | Both changing the real emulated media preference and loading with it enabled produced `reduced-motion-poster`. |
| Real context loss | `WEBGL_lose_context.loseContext()` produced `context-lost-poster`; reloading restored `three-webgl`. |
| WebGL unavailable | A separate Chrome launched with `--disable-webgl` produced `webgl-unavailable-poster`. |
| Console | No application errors or shader warnings in the completed suite. |

The 0 / 90 / 180-degree and vertical screenshots show different silhouettes, cavities moving to the side/back, different bright softbox bands, and rear contours seen through the front surface. The comparison is rendered evidence, not just source inspection or a CPU projection test. Aesthetic review remains a judgment, not a numerical guarantee.

## Build and source checks

- `npm run build`: passed; deferred 3D bundle about 753 kB / 232 kB gzip. Vite retains its informational >500 kB chunk warning.
- `npm run test:hero`: passed; all seven required native modules resolve.
- Desktop: 24,012 vertices / 48,020 triangles; mobile: 6,252 vertices / 12,500 triangles. Both closed manifolds, finite normals, nonuniform radii, no UV attribute.
- Reviewed lifecycle disposal, the changed shader programs, shader edge handling, touch capture and the narrow CSS change. `git diff --check` passed.

## Repeatable GPU suite

`scripts/check-hero-browser.mjs` is an optional browser acceptance runner. It is not included in the page runtime and does not change the existing CI workflow. Supply Playwright through a separate install or `HERO_PLAYWRIGHT_MODULE` (module URL), and optionally `HERO_CHROME_PATH` (installed Chrome executable).

Set `HERO_QA_URL` to the local server or `https://yns34-hub.github.io/`, and `HERO_QA_OUTPUT` to an evidence directory, then run `node scripts/check-hero-browser.mjs`.

Outputs include `report.json`, `desktop.png`, `angle-000.png`, `angle-90.png`, `angle-180.png`, `vertical.png`, `hero-375.png`, `hero-390.png`, `hero-768.png`, touch screenshots and separately labeled fallback screenshots. Current local evidence is outside the deployable repository in `../hero-evidence/local/`.

## Production status

Local GPU acceptance is complete. The repair commit and Pages deployment must still be checked before production acceptance is recorded here.
