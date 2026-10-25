# 42-item motion evidence index

Evidence root: local `../../outputs/living-world/`. All rows have recorded visual evidence and corresponding flow assertions; this is not a claim of frame-by-frame human review of every recording. Static views and sampled frame sequences were visually inspected. Tests use public artwork and original test audio. Camera fixture staging and network/visibility fault injection are explicitly labelled in scripts; actual user actions remain native.

| # | Motion | Evidence |
|---:|---|---|
| 1 | hero entrance | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 2 | museum identity | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 3 | ENTER transition | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 4 | artwork proximity | final-interactions / validation.json, two native .webm and poster/lyrics screenshots |
| 5 | artwork hover / focus | final-interactions / validation.json, two native .webm and poster/lyrics screenshots |
| 6 | poster caption motion | final-interactions / validation.json, two native .webm and poster/lyrics screenshots |
| 7 | editorial gallery | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 8 | favorite | final-interactions / validation.json, two native .webm and poster/lyrics screenshots |
| 9 | mini player idle | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 10 | mini player playing | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 11 | mini to full player | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 12 | track switch | edge-cases / validation.json and edge-cases.webm |
| 13 | play to pause | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 14 | lyric transition | final-interactions / validation.json, two native .webm and poster/lyrics screenshots |
| 15 | Cinema transition | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 16 | Cinema metadata | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 17 | door threshold | court-after / validation.json and native .webm (physical threshold input) |
| 18 | Guide | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 19 | import flow | edge-cases / validation.json and edge-cases.webm |
| 20 | court entry | court-after / validation.json and native .webm (physical threshold input) |
| 21 | pickup | court-after / validation.json and native .webm (physical threshold input) |
| 22 | dribble | court-after / validation.json and native .webm (physical threshold input) |
| 23 | shot | court-after / validation.json and native .webm (physical threshold input) |
| 24 | swish | court-after / validation.json and native .webm (physical threshold input) |
| 25 | rim miss | edge-cases / validation.json and edge-cases.webm |
| 26 | scoreboard response | court-after / validation.json and native .webm (physical threshold input) |
| 27 | cycling entry | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 28 | mount | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 29 | start pedaling | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 30 | coast | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 31 | freehub | road-journey-recheck / journey.json and continuous-native-ride.webm; actual-coast-pedal.webm contains captured Web Audio |
| 32 | shift | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 33 | climb | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 34 | crest reveal | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 35 | descent | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 36 | scenic stop | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 37 | Photo Mode | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 38 | return to Palace | road-journey-recheck / journey.json and continuous-native-ride.webm |
| 39 | reduced hero | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 40 | reduced player | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 41 | reduced room transition | continuity-complete + continuity-complete-1440 / validation.json and native .webm |
| 42 | reduced cycling | edge-cases / validation.json and edge-cases.webm |

Before/after: `comparisons/sheet-1.jpg` through `sheet-10.jpg`, 38 pairs from e39d1af. Final `poster-caption-response-*` and `player-continuity.png` supplement the static set. `road-motion-review.jpg`, `court-motion-review.jpg` and `museum-motion-review.jpg` are aspect-preserving sampled filmstrips.

Failures found and corrected: duplicate shared destination; source-size typography snap; exact-rest floating-point residue in new caption; 144 Hz camera sample before 90 Hz invalid-state recovery. No baseline hash was replaced to make preservation checks pass.
