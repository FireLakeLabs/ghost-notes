# Lens measurement protocol

Part 2 extends `npm run measure:timeline` with `GHOST_LENS_MEASURE=1`.
The production build opens the six local folders through the real input, retains
six decoded stems, and asserts 12 recording rows. It finds each song's busiest
four-bar window by original note onsets, leaving one bar for the movement test.
Selection uses the visible bar controls. The timed actions are Look closer,
one-bar movement with the header button, and Close. Dragging both handles,
arrow keys, band/instrument selection, bar/beat snaps and reduced motion have
separate synthetic browser checks.

Each action records every animation callback interval, including the callback
after the last drawing frame. CDP `devtools.timeline,blink.user_timing` tracing
runs across all three actions; User Timing marks retain the callback timestamps
inside the trace. A missed 60 Hz callback fails the optional measurement:
intervals must be at most 16.9 ms, allowing rounding of the 16.6/16.7 ms clock.
This is a callback/rendering observation in headless Chromium, not a claim of
GPU/display presentation or a perceived result. No playback, speaker timing,
physical touch interaction or mobile memory limit was measured.

Opening and closing use Main's 450 ms cubic-bezier(.2,.75,.25,1); dragging uses
160 ms. Reduced motion ends on the next drawing frame. The buffers stay at the
final row height while displayed heights grow. Waveform summaries are drawn
once at 64 pixels per beat (maximum 30,000 pixels), then projected by slices;
softened whole-song contours are also cached. The initial timeline draw pays
this work. Source audio and notes remain intact; the lens retains G62's
200-events-per-bar drawing cap and count warnings.

Rejected diagnostic attempts remain local: full-height backdrop filtering had
compositor passes near 19 ms; repeating Gaussian blur per row also missed
callbacks. A separate CPU-profile run identified a ruler-label search that
reread DOM datasets quadratically: about 131 ms on diversity-1 across the three
transitions. Ruler labels now retain their bar references. These diagnostic
runs are not part of the final capacity table. No speedup ratio is claimed.

## Earlier rendering attempts

Five preliminary runs (40–44), Chromium 158.0.8127.18, 1440×1100, device scale 1,
Linux x86-64, Node 24.22.2 and 16 logical cores. All six songs opened with
12 recording rows and six retained buffers; no runtime errors. Times are ms.
These measurements preceded the final lens-only grid drawing and batched
strokes. Their missed callbacks are retained as diagnostic evidence.

| Input                      | Bars | Notes | First draw median (range) | Open max | Move max | Close max | Missed / frames |
| -------------------------- | ---: | ----: | ------------------------: | -------: | -------: | --------: | --------------: |
| first test session, song 1 |   35 |  1433 |        100.1 (98.2–105.8) |     16.8 |     16.8 |      16.8 |         0 / 434 |
| first test session, song 2 |   76 |  2203 |       150.6 (146.9–152.4) |     16.8 |     16.8 |      16.8 |         0 / 427 |
| first test session, song 3 |   82 |  1805 |       175.5 (174.5–177.5) |     16.8 |     16.8 |      16.8 |         0 / 430 |
| first test session, song 4 |   62 |  3282 |       160.7 (158.3–161.9) |     16.8 |     16.8 |      16.8 |         0 / 430 |
| diversity-1                |  243 |  3947 |       227.2 (224.4–242.1) |     33.4 |     16.8 |      16.8 |         2 / 428 |
| diversity-2                |   51 |  1377 |          94.3 (88.6–97.5) |     16.8 |     16.8 |      16.8 |         0 / 428 |

The initial cache construction is included in first draw, excluding folder
read/decode. No source PCM or notes were discarded. Shared-machine load varied
across the wave (about 2–11.5); these are observations, not a device guarantee.
Earlier series 20–22 had no sample above 16.8 ms, while series 23 had one
33.3 ms sample on diversity-1. These attempts are retained rather than excluded
from the record. The final rendering results below supersede this capacity result.

Raw intervals: `/tmp/ghost-lens-{40..44}.json`; matching CDP traces:
`/tmp/ghost-lens-trace-{40..44}-{1..6}.json`. Music pixels remain local.
The ordinary synthetic case checks the corrected contour span, no blue border,
selection feedback outside the lens, both drag handles and session controls.

## Lens/selection PR results (2026-11-13)

Five successive production-build runs (50–54), with the same browser, viewport,
input sizes and unchanged 16.9 ms limit. All 2,581 sampled intervals matched the
callback timestamps embedded in their CDP traces; none exceeded 16.8 ms and no
runtime error occurred. The frame-clock floor is about 16.7 ms. Grid lines in
the outside context are now supplied by the cache; only lens lines are redrawn,
and strokes are batched. This is a bounded rendering observation, not a speedup
comparison or a guarantee for physical display presentation.

| Input                      | First draw median (range), ms | Open max, ms | Move max, ms | Close max, ms | Missed / frames |
| -------------------------- | ----------------------------: | -----------: | -----------: | ------------: | --------------: |
| first test session, song 1 |            103.7 (99.1–107.2) |         16.8 |         16.8 |          16.8 |         0 / 433 |
| first test session, song 2 |           151.7 (147.3–159.5) |         16.8 |         16.8 |          16.8 |         0 / 431 |
| first test session, song 3 |           173.4 (165.9–179.1) |         16.8 |         16.8 |          16.8 |         0 / 428 |
| first test session, song 4 |           160.0 (156.9–168.0) |         16.8 |         16.8 |          16.8 |         0 / 428 |
| diversity-1                |           232.4 (221.2–246.2) |         16.8 |         16.8 |          16.8 |         0 / 432 |
| diversity-2                |              95.1 (85.1–98.7) |         16.8 |         16.8 |          16.8 |         0 / 429 |

The cache cost remains visible in first draw (95.1–232.4 ms medians), excluding
file read/decode. The final series ran with other waves active; observed load
was about 2.7–3.7 on 16 logical cores. Raw results are local in
`/tmp/ghost-lens-{50..54}.json`, with traces in
`/tmp/ghost-lens-trace-{50..54}-{1..6}.json`. Their contents are not committed.

Rebased local gates: `CI=1 npm run check` passed 582 Node tests (five skipped),
Node portion 27.878 s / 60 s; `npm run test:browser` passed 70 tests (one skipped)
in 114.779 s / 180 s. The moved settings-host case is part of that lean
synthetic test. Tempo/meter and ruler/inference fixes follow in the second PR.

## Complete part 2 verification (2026-11-13)

After the tempo/meter question and neutral ruler changes, five fresh production
runs (90–94), rebased onto shell #36 (c38e828) opened all six real folders. The question appeared on flagged
inputs, and independently on diversity-1's 87 two-beat / 70 four-beat detected
bars. Through the actual controls, four beats/bar and beat one one beat later
changed diversity-1 from 243 to 121 chosen bars. Detection and 3,947 source
notes remain intact. Tests also verify retained audio/folder identity, updated
note coordinates, identical source marks across previews, and no guessed bar
lines between a gap and the next reliable phase restart (G87).

All 2,580 opening/moving/closing intervals matched the numeric callback
timestamps in the CDP User Timing traces one for one. All were at most 16.8 ms,
with zero runtime errors and zero intervals over the unchanged 16.9 ms limit
(60 Hz, allowing clock rounding). Each action includes the callback after its
last drawing frame. This measures browser rendering callbacks, not GPU/display
presentation. The browser/version/viewport and six retained stems match the
protocol above. The final host-load snapshot was 0.69 on 16 cores; no per-run load series
was captured. The machine-wide lock excluded other test suites.

| Input                      | Chosen bars | First draw median (range), ms | Open max, ms | Move max, ms | Close max, ms | Missed / frames |
| -------------------------- | ----------: | ----------------------------: | -----------: | -----------: | ------------: | --------------: |
| first test session, song 1 |          35 |           105.4 (102.3–114.9) |         16.8 |         16.8 |          16.8 |         0 / 435 |
| first test session, song 2 |          76 |           157.8 (154.1–162.3) |         16.8 |         16.8 |          16.8 |         0 / 427 |
| first test session, song 3 |          82 |           175.3 (173.9–176.8) |         16.8 |         16.8 |          16.8 |         0 / 429 |
| first test session, song 4 |          62 |           165.2 (163.8–166.5) |         16.8 |         16.8 |          16.8 |         0 / 430 |
| diversity-1                |         121 |           222.5 (220.0–227.8) |         16.8 |         16.8 |          16.8 |         0 / 431 |
| diversity-2                |          51 |             92.8 (90.0–104.4) |         16.8 |         16.8 |          16.8 |         0 / 428 |

First draw includes cache construction and excludes file read/decode. For
diversity-1 it is the first redraw after applying the grouping; the other five
retain the default grid. No speedup comparison is claimed. The earlier 50–54
series covers diversity-1's default 243-bar grid as well. Raw reports remain
local in `/tmp/ghost-lens-{90..94}.json`, traces in
`/tmp/ghost-lens-trace-{90..94}-{1..6}.json`, and the aggregate in
`/tmp/ghost-lens-summary-shellbase.json`. The pre-shell 80–84 series also had zero misses in 2,583 intervals;
its local reports remain available. Diagnostic 60–74 attempts predate the final
gap correction and are not final evidence. No real musical data or pixels are
committed. Synthetic question/ruler and all six local lens screenshots were
inspected; physical touch, display presentation, mobile memory and perceived
output remain unmeasured.

Reproduce with `GHOST_LENS_MEASURE=1 GHOST_GRID_REVIEW_MEASURE=1
GHOST_LENS_RUN=90 GHOST_TIMELINE_REPORT=/tmp/ghost-lens-90.json npm run
measure:timeline`, repeating with distinct run numbers. The optional six-song
case takes about 48 s and is excluded from the ordinary suite. Final full local
gates: `npm run check` passed 608 Node tests (seven skipped; 13.752 s / 60 s);
`npm run test:browser` passed 75 (one skipped) in 128.218 s / 180 s. No budgets
were raised. Opus approved the behavior after three rounds; gap-phase and stale
inference findings were reproduced and fixed.
