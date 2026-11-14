# Arrangement rows: intermediate measurements

Step 7 part 3, row PR (2026-11-14). This is one six-song production-browser
pass, not the final repeated qualification for the complete editing wave.
Reference music and screenshots stay local. No listening claim is made.

Claim checked: with audio/MIDI/Notes/Mine for six stems, plus a literal first
eight-bar arrangement, opening/moving/closing a four-bar lens stays within the
existing 16.9 ms callback limit. The browser was Chromium 158.0.8127.18,
1440×1100, on this 16-core Linux machine. Pre-run load was 0.10/0.44/0.69;
the machine-wide suite lock excluded other Node/browser suites. Production
builds retain the pinned dependencies. The optional measurement takes about
85 s and is excluded from the ordinary browser suite.

The first diagnostic (`wave6-pr2-a`) failed: opening/closing reached 33.4 ms.
A separate CPU/DevTools profile identified drawing and Paint as the main costs;
all 24 rows were redrawn even below the window. The fix paints rows within
150 px of the window and redraws on page scroll. Every row still keeps its
full data, drawing cap and animated height. Screenshots visit each instrument
before taking a whole-timeline image. No events are skipped to pass timing.

Earlier passes (`wave6-pr2-b/c`) passed but did not prove a busy row was in
view. The strengthened protocol scrolls the busiest first-eight-bar stem into
view and verifies painted pixels before tracing. Runs d/e/f caught occasional
33.3–33.4 ms intervals. Reading row geometry before DOM writes reduced forced
layout; experimental row containment did not help and was removed. Profiles
also found the unchanged recording overview drawn on every frame. Its image is
now cached, with only the viewport indicator redrawn.

A fresh unprofiled pass (`wave6-pr2-g`) verified all 513 opening/moving/closing
intervals against numeric callback timestamps in CDP User Timing marks, one
for one. Zero intervals exceeded 16.9 ms; zero runtime or query errors occurred.
Each operation includes the callback after its final drawing frame. The
selected lens lies within the arranged first eight bars. All 36 Mine rows
contained the expected queried events (1,343 total); remaining bars stayed
marked unarranged. Conversion input remained 14,047 source notes.

| Anonymous input            | Visible stem kind | Chosen bars | Source notes | Initial draw, ms | Open max, ms | Move max, ms | Close max, ms | Missed / intervals |
| -------------------------- | ----------------- | ----------: | -----------: | ---------------: | -----------: | -----------: | ------------: | -----------------: |
| first test session, song 1 | pitch             |          35 |        1,433 |             41.4 |         16.8 |         16.8 |          16.8 |             0 / 86 |
| first test session, song 2 | drums             |          76 |        2,203 |            124.9 |         16.8 |         16.7 |          16.7 |             0 / 86 |
| first test session, song 3 | drums             |          82 |        1,805 |            134.8 |         16.8 |         16.7 |          16.8 |             0 / 85 |
| first test session, song 4 | pitch             |          62 |        3,282 |             47.4 |         16.7 |         16.8 |          16.8 |             0 / 85 |
| diversity-1                | pitch             |         243 |        3,947 |             76.7 |         16.8 |         16.7 |          16.8 |             0 / 85 |
| diversity-2                | drums             |          51 |        1,377 |             28.7 |         16.8 |         16.7 |          16.8 |             0 / 86 |

Initial drawing includes conversion/visible cache construction after reference
read/decode; it is separate from the animated frame check. No before/after
speedup is claimed: viewport painting does less off-window work. Data,
conversion and answers remain complete. Physical display/GPU presentation,
touch, phone memory, speaker output and perceived timing are unmeasured.
The complete wave will repeat this protocol after differences and lens editing.

Reproduce with `GHOST_LENS_MEASURE=1 GHOST_ARRANGEMENT_MEASURE=1
GHOST_LENS_RUN=wave6-pr2-g GHOST_TIMELINE_REPORT=/tmp/ghost-wave6-pr2-g.json
npm run measure:timeline`. Reports and six traces remain under `/tmp/ghost-*`;
none contains committed music. `GHOST_LENS_PROFILE=1` is diagnostic only and
is excluded from reported timings.

For a single anonymous input during diagnosis, set `GHOST_TIMELINE_SONG=1`
through `6`. Leave it unset for qualification. Final five-run proof remains
with the complete editing wave.
