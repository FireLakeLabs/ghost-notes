# Difference marks: intermediate frame proof

Step 7 part 3, 2026-11-14. One production-browser pass per view, before lens
editing, with pointer movement during all three lens operations. These are
callback measurements, not a physical display or listening
claim. The complete wave still owes five final passes per view.

The strengthened protocol uses a literal first-eight-bar arrangement for all
six stems, selects a busy four-bar range within it and scrolls its busiest
stem into view. Bounds are checked after opening, moving and closing. Numeric
callback timestamps are matched one-for-one against CDP User Timing marks,
including the callback after the final drawing frame. One pointer move crosses
the visible Mine canvas per timed animation callback; counts are retained.
Pixel readbacks and
screenshots happen after timing. Transport is stopped. No CPU/Skia profiler
runs during qualification.

Both views retained all 14,047 source notes and 1,343 queried arrangement
onsets across 36 instrument rows. Mine totals matched the actual queried
answers; runtime and query errors were zero. Drawing alone keeps the existing
200-event allowance per source/bar, with Mine and recording-only ghosts
sharing theirs. Matching uses complete data.

Chromium 158.0.8127.18, 1440×1100 CSS pixels, device scale 1, Node 24.22.2,
16-core Linux and the machine-wide suite lock. The preceding, pointer-free
Layers pass started at load averages 0.21/0.72/0.52; the pointer runs did not
retain a separate pre-run load record. Builds use production settings
and the pinned dependencies. Each pass took about 65 seconds, outside the
ordinary browser suite. The optional six-song case exceeds that suite's
20-second individual-case accounting rule; no budget was raised.

| Anonymous input            | Bars | Source notes | Rows open/move/close max, ms | Layers open/move/close max, ms | Intervals, Rows/Layers |
| -------------------------- | ---: | -----------: | ---------------------------- | ------------------------------ | ---------------------: |
| first test session, song 1 |   35 |        1,433 | 16.7 / 16.7 / 16.8           | 16.8 / 16.8 / 16.8             |                  86/87 |
| first test session, song 2 |   76 |        2,203 | 16.8 / 16.8 / 16.8           | 16.7 / 16.8 / 16.7             |                  86/85 |
| first test session, song 3 |   82 |        1,805 | 16.8 / 16.7 / 16.8           | 16.8 / 16.7 / 16.8             |                  86/85 |
| first test session, song 4 |   62 |        3,282 | 16.8 / 16.8 / 16.8           | 16.8 / 16.7 / 16.8             |                  85/85 |
| diversity-1                |  243 |        3,947 | 16.8 / 16.8 / 16.8           | 16.8 / 16.8 / 16.8             |                  85/85 |
| diversity-2                |   51 |        1,377 | 16.8 / 16.8 / 16.8           | 16.8 / 16.7 / 16.8             |                  85/85 |

Rows verified 513 intervals and 495 pointer moves; Layers verified 512 and 494. None exceeded the existing 16.9 ms limit (60 Hz rounding allowance).
Initial drawing in Rows was 41.8–119.5 ms after reference read/decode, including
conversion and cache preparation. Layers is selected and painted before its
timed operations; view-switch latency was not separately measured. Before
review, pointer-free passes verified 514/512 intervals at the same limit;
those did not cover the extra redraw triggered by pointer input. The review
fix uses existing hits for pointer input and flushes only a never-painted row
for keyboard input. A fixture reproduced 80 synchronous clears before the fix
and zero afterwards.

The earlier [rows proof](rows-measurements.md) checked visibility only before
opening; header focus could move the working row away. Preserving scroll on
focus and checking bounds exposed missed frames in the stronger protocol.
Diagnostic CPU/Skia traces, excluded from reported timings, identified native
canvas drawing, repeated per-note calls, hatch strokes and unnecessary outside
work. The final renderer caches the closed view and its hit regions, prepares
hatch/piano-grid images, clips before projecting changes, batches pitched
rectangles and updates row heights together before reading actual bounds.
Outside the lens it uses the cached blurred context. Layers draws one grid
and one visible canvas per instrument, retaining independent source data and
hit regions; its outside image combines the same three sources and opacity.
Rows keep separate visible surfaces. Whole-timeline raster/containment
experiments were removed. Failed variants remain in private logs. No paired
speedup or repeated reliability claim is made here.

The synthetic browser walk exercised all six explanations, pointer and
keyboard access, match-setting changes without changed query answers, three
shared places, split/takeover and copy/paste/reopen. A private production walk
on the first test session, song 1 opened a converter explanation, changed
match tolerance without changing queried music, then copied twice and reopened
the reference: 362 queried/Mine onsets, identical links and tempo, zero runtime
errors. Its screenshot stays local; only invented fixtures are committed.

Reproduce Rows with `GHOST_LENS_POINTER=1 GHOST_ARRANGEMENT_MEASURE=1 GHOST_LENS_MEASURE=1
GHOST_LENS_RUN=wave6-pr3-r2-rows GHOST_TIMELINE_REPORT=/tmp/ghost-wave6-pr3-r2-rows.json
npm run measure:timeline`. Add `GHOST_TIMELINE_LAYERS=1` and use run
`wave6-pr3-r2-layers` for Layers. Reports and traces stay under `/tmp/ghost-*`.
`GHOST_TIMELINE_SONG=1` through `6` isolates an input for diagnosis;
`GHOST_LENS_PROFILE=1` enables excluded diagnostics.

Not measured: physical presentation, active playback plus editing, touch,
phone memory, a view switch's latency, or perceived/audio timing. Lens editing
and the final repeated qualification remain work for the next PR.
