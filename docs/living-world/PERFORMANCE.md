# Visible hardware measurement / 2026-10-10

Edge 148.0.3967.70; ANGLE D3D11 / NVIDIA GeForce GTX 1650; 1920×1080, DPR 1, medium. One browser GPU workload at a time. RAF wall intervals, not GPU timestamp queries. Renderer counts are main-pass diagnostics; texture MB estimates are not full VRAM. Samples last 5–8 seconds after warmup. Source state: `534dccc` plus final pending player/Cinema/threshold fixes; editorial resting sample rechecked after final caption code.

| Sample | Avg FPS | P95 ms | Max ms | Calls peak | Triangles peak | Textures | Lights | Maps MiB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| atrium / still | 102.7 | 14.0 | 34.8 | 254 | 62086 | 38 | 6 | 37.9 |
| atrium / walking | 118.8 | 13.9 | 34.7 | 254 | 62086 | 38 | 6 | 37.9 |
| music / still | 143.7 | 7.1 | 13.9 | 72 | 5558 | 8 | 6 | 6.8 |
| music / walking | 138.3 | 7.5 | 20.9 | 72 | 5558 | 8 | 6 | 6.8 |
| music / native playback, FFT and scrolling lyric wall | 143.1 | 7.1 | 20.9 | 52 | 4610 | 5 | 6 | 4.7 |
| editorial / still | 144.0 | 7.1 | 14.0 | 53 | 3708 | 20 | 4 | 35.3 |
| worlds / preview thresholds | 144.2 | 7.0 | 7.6 | 27 | 2814 | 11 | 2 | 17.8 |
| court / resting composition | 141.0 | 7.1 | 20.8 | 104 | 22940 | 10 | 4 | 25.1 |
| court / real dribble and bounce audio | 143.4 | 7.1 | 20.9 | 34 | 8862 | 10 | 4 | 25.1 |
| court / timed shot, net and feedback | 143.1 | 7.1 | 20.7 | 54 | 17752 | 10 | 4 | 25.1 |
| editorial / keyboard accordion | 140.3 | 7.1 | 28.0 | 53 | 3708 | 20 | 4 | 35.3 |
| cinema / resting image | 143.8 | 7.1 | 20.8 | 11 | 976 | 8 | 4 | 2.9 |
| cinema / native image transitions | 141.3 | 7.1 | 41.6 | 13 | 980 | 10 | 4 | 6.7 |
| trailhead / stationary | 113.1 | 14.0 | 27.8 | 77 | 2198586 | 20 | 2 | 35.6 |
| dense forest / stationary | 121.1 | 13.9 | 20.8 | 73 | 2188386 | 19 | 2 | 35.6 |
| dense forest / native pedaling | 112.6 | 14.0 | 27.8 | 80 | 2345834 | 19 | 2 | 35.6 |
| dense forest / coasting | 116.3 | 14.0 | 27.9 | 78 | 1880694 | 19 | 2 | 35.6 |
| climb / stationary | 137.6 | 7.2 | 27.8 | 65 | 1801982 | 17 | 2 | 35.6 |
| lake reveal / stationary | 142.8 | 7.1 | 27.8 | 80 | 1678590 | 19 | 2 | 35.6 |
| shore road / stationary | 142.6 | 7.1 | 27.8 | 72 | 1936720 | 18 | 2 | 35.6 |
| high meadow / stationary | 142.9 | 7.1 | 27.8 | 49 | 356886 | 22 | 2 | 35.6 |
| golden valley / stationary | 140.5 | 7.1 | 41.6 | 65 | 846062 | 17 | 2 | 35.6 |
| fast descent / stationary | 135.8 | 7.6 | 48.6 | 64 | 1043142 | 22 | 2 | 35.6 |
| fast descent / native pedaling | 135.9 | 7.2 | 166.6 | 107 | 1215948 | 22 | 2 | 35.6 |
| fast descent / coasting | 141.6 | 7.1 | 41.7 | 90 | 1015172 | 22 | 2 | 35.6 |
| museum wing / after road exits | 143.5 | 7.2 | 20.8 | 27 | 2814 | 11 | 2 | 17.8 |
| editorial / still | 143.7 | 7.1 | 13.9 | 53 | 3708 | 20 | 4 | 35.3 |

No page errors were recorded in these runs. Downhill maximum 166.6 ms remains a reported limitation; averages do not hide it. Earlier accepted 88–143 FPS samples are historical context, not a controlled same-run A/B experiment. No claim of a measured percentage improvement.

Raw JSON is in the corresponding local evidence folders. No extra full-screen pass, render target or reflection was introduced; Cinema adds up to one temporary image plane.
