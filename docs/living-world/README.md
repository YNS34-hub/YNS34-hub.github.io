# Round Three / living-world

Baseline: `e39d1aff87a89c0bc8a91ede9af4e2250bd24423` on `codex/memory-palace-collection-curation`, after completed Round Two (`aca9b5a`). Work branch: `codex/memory-palace-living-world`. No merge or deployment is implied.

## Direction and boundaries

The existing architecture, artwork proportions, Space Grotesk identity, dual-slot player, lyric clock, imports, privacy guarantees, ball physics and road physics remain the authority. Motion reads their state. One primary focus, short follow-through, and a quiet resting composition.

References inspected on 2026-10-09: [shared UI state morphing](https://www.prompt-motion.com/twoclipping-5cba86), [masked type and shared anchors](https://www.prompt-motion.com/twoclipping-6dd14e), [motion techniques](https://www.prompt-motion.com/lukasersil-0ed38e). We adopt continuity, selective masks and staged timing; not their demo layouts, render pipelines, soundtrack synchronization or visual effects.

## Work log

- Baseline source verified clean. Same-camera public-content captures started at 1920×1080 and 2560×1440, DPR 1, medium.
- Phase 1: pure presentation boundaries and regression tests. Committed `1d20dd8`; 12 targeted tests passed.
- Phase 2: proximity, hero and import state feedback. Committed `2e70f10`; typecheck/lint and 10 targeted tests passed. Existing native interaction runner passed 8 checks across 1080p and 1440p, including gaze, E/F, blocked WASD, exact Cinema return, persistent favorite, real FFT/lyrics and reduced motion. Gaze screenshot reviewed.
- Phase 3: shared player anchors, lyrics, editorial accordion and Cinema. Implemented. Full suite: 117/117 tests passed. Native 1080p browser runner passed 4 journeys; public audio/cover import, shared anchor cleanup, focus accordion, Cinema idle/wake/favorite/Escape, OS reduced motion. Screenshots inspected. Initial Cinema wake test failed because the original capture listener stopped propagation; registering wake in capture phase fixed it and recheck passed. Accordion inactive actions were then hidden to avoid cramped labels; recheck this final CSS adjustment on resume.
- Phase 4: basketball and cycling presentation polish. Pending.
- Phase 5: native interaction recordings, static comparison, reduced motion, privacy and visible hardware performance. Pending.

Local evidence lives outside Git under `outputs/living-world`. Tests use public content and original Palace Study audio. Private collections and recordings are never copied into published evidence.

No Round Three performance or visual acceptance result is claimed until measured and reviewed.

Latest checkpoint: `c9c42a8` implements Phase 3 and is pushed. The final inactive-action CSS adjustment was rechecked with all 4 native journeys passing in `phase-3-final`; no page errors. TypeScript, lint and public production build passed. Public generated personal manifest has all five empty lists and no private assets; the local catalog was restored to 4 wallpapers / 22 visuals / 40 audio / 8 local projects / 0 research. This is an intermediate checkpoint, not full Round Three acceptance.

## Resume checkpoint / 2026-10-09

The 5-hour account window reached 98% used. User explicitly requested automatic continuation after reset; heartbeat `memory-palace` targets this same chat at 19:56:11 Asia/Shanghai, after reported 19:54:11 reset. Do not treat scheduling as completion. Do not duplicate the automation. Continue using the user's requested GPT-6 Astra / high setting.

Read the full user brief at `E:/Codex/.codex/attachments/d82e2337-c5db-4e49-a6fa-2b1a5a781cc9/已粘贴的文本.txt`. Continue from this branch, never from older PR #13. Original source baseline is still e39d1af. No new PR, merge or deployment yet.

Evidence outside Git: `../../outputs/living-world/baseline` contains 38 same-camera public-content BEFORE shots at two viewports; `phase-2` contains the 8-check report and images; `phase-3-recheck` contains the passing 4-journey report, native browser video and screenshots. These runs are headless visual/functional tests, NOT claimed performance benchmarks.

Remaining concrete work:

- Review complete resting-state comparisons against BEFORE; record actual hero/proximity transitions, validate hidden/occluded targets and frame budget. New proximity currently adds at most one extra occlusion ray per 100ms.
- Player anchor prototype passes native flows but needs rapid-toggle/track-switch/1440p scrutiny and a refined single-object appearance. Source components and all playback ownership stay original.
- Cinema now has orientation-aware tiny drift, accurate index and idle controls. It does not yet provide the full requested related-image crossfade/masked direction choreography. Do not claim that complete.
- Enhance threshold entry continuity without changing navigation/physics or original structure; Guide currently only adds a restrained line reveal.
- Basketball physical/sound/net/score feedback and road cycling coast/crest/photo/environment polish have NOT been implemented this round. `dribblePresentation` has boundary tests but is not wired into the live ball yet.
- Complete all 42 requested motion QA entries, static review, visible GTX 1650 measurements, reduced-motion matrix, final public-build privacy and local catalog restoration. Existing audio engine, lyric engine, original geometry/proportions and media schema remain protected by the preservation tests.
- Use small commits, push only source/public-safe evidence, no private ten images/music/LRC/HTML/manifests. Stop the heartbeat after the authorized task is complete.
