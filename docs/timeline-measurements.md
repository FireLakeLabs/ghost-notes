# Timeline measurement protocol

Measure with `npm run measure:timeline` against a production Vite build. The
optional Playwright test opens each of six folders through the real file input,
decodes all six stems, asserts 12 drawn rows and six retained buffers, then
records the browser's User Timing first-draw mark and Chrome DevTools Protocol
Performance metrics. The first-draw interval starts when the decoded reference
reaches the timeline and ends at the animation frame after drawing; folder
open time separately includes reading, decoding and peaks. Neither is speaker
latency.

Each run scrolls 90 animation frames from start to end at 8× zoom, asserting
more than 1,000 px traveled, then changes zoom for 60 frames (1×–15.5×). Frame
intervals include the actual rendering callbacks. The report records every
interval, first draw, task/script durations, bytes and note/bar counts, and
rejects runtime errors. All six songs run sequentially with a fresh page so
there is no retained multi-song PCM cache. Local material absent: skip.

Report five runs, medians and ranges, without profiler overhead. The browser
suite's machine lock separates rendering measurements from other browser
suites. Other waves can still use CPU; load is recorded with the results.
This is a capacity/rendering observation, not a comparison or a frame-time
promise for every device. Default headless Chromium, 1440×1100, device scale 1,
Linux x86-64, Node 24.22.2, 16 logical cores; audio contexts decode at 44.1 kHz.
No playback, hardware audio, GPU/display presentation, touch interaction or
mobile memory limit was measured.

A separate CPU-profile experiment on the first session's song 4 found repeated
seconds-to-grid classification and waveform drawing on the main thread. The
implementation caches exact boundary coordinates, shares the inverse seconds
axis across waveform rows, and skips unchanged ruler layout during scrolling.
Waveforms use the chosen map's linear beat intervals directly, without
allocating/classifying a full Position for every screen pixel; public position
queries still preserve gap and uncovered variants. At a 60 Hz animation clock,
16.7 ms is the measurement floor. That limits observable gains once drawing
fits the frame. The inherited sheet's 200-event cap remains unchanged; the
new timeline samples per bar cell and keeps original counts and data.

## Results (2026-11-13)

Five fresh opens per song, Chromium 158.0.8127.18, after the grid and converter
integration. No runtime errors; 12 rows and six retained stems per song.
Bars count all positive-numbered derived bars, including partial final bars.
These differ from the grid study's complete-bar counts and from detected bars.
Diversity-1 has 181 detected bars and 243 derived bars.

Times in ms: first-draw median (range), median per-run p95 frame interval
(range), and worst frame across all 750 interaction frames per song.

| Input                      | Bars | Notes | PCM MiB |       First draw |       Scroll p95 |         Zoom p95 | Worst frame |
| -------------------------- | ---: | ----: | ------: | ---------------: | ---------------: | ---------------: | ----------: |
| first test session, song 1 |   35 |  1433 |   250.3 | 33.5 (33.1–34.4) | 16.7 (16.7–16.8) | 16.7 (16.7–16.8) |        16.8 |
| first test session, song 2 |   76 |  2203 |   335.1 | 23.4 (22.6–26.5) | 16.7 (16.7–16.8) | 16.8 (16.7–16.8) |        16.8 |
| first test session, song 3 |   82 |  1805 |   286.7 | 25.5 (22.1–26.6) | 16.7 (16.7–16.8) | 16.7 (16.7–16.8) |        16.8 |
| first test session, song 4 |   62 |  3282 |   283.7 | 29.3 (28.2–30.8) | 16.7 (16.7–16.7) | 16.7 (16.7–16.8) |        16.8 |
| diversity-1                |  243 |  3947 |   627.3 | 46.5 (37.9–50.1) | 16.7 (16.7–16.8) | 16.7 (16.7–16.8) |        16.8 |
| diversity-2                |   51 |  1377 |   324.4 | 20.3 (20.1–23.8) | 16.8 (16.7–16.8) | 16.7 (16.7–16.8) |        16.8 |

Folder-open medians (ranges), including decode and peaks, in song order: 1422.5 (1383.0–1433.0) ms; 1366.5 (1361.0–1399.6) ms; 1385.2 (1364.2–1403.8) ms; 1391.4 (1367.3–1407.7) ms; 2440.1 (2422.5–2592.0) ms; 1353.5 (1349.4–1358.2) ms.

The five integrated-grid runs had no sampled frame above 16.8 ms. This is a
headless browser observation, not a guarantee of display presentation. Shared
machine load was about 1.4–3.2 on 16 logical cores during these runs. Earlier
pre-grid experiments under heavier load (up to 19) reached a 50 ms frame on
song 4; the chosen grid also reduces its flagged gaps from 160 to 10. We do
not attribute a speed difference to drawing alone. No real-song pixels or
musical data are included here. Anonymous raw intervals remain locally in
`/tmp/ghost-timeline-grid-{1..5}.json`; per-run aggregates are in
`/tmp/ghost-timeline-summary-grid.json`.

Final local gates on the base containing #20 and #21: `npm run check` passed
546 Node tests (two skipped); `npm run test:browser` passed 68 (one skipped)
in 105.341 s of its unchanged 180 s budget. The synthetic timeline case took
about one second. Opus approved three bounded rounds; its overflow finding
was reproduced as 72 px of excess scroll, then fixed and guarded at Fit/End.

Part 2's lens protocol, diagnostic failures and current measurements are in
[lens measurements](lens-measurements.md). Its cache construction is included
in first draw; animation timing starts at the user's lens action.
