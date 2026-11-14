# Lens editing: proof and limits

Step 7 part 3 and step 8 part 2, 2026-11-14. This report separates queried
music, visible results and browser callback timing. No agent listened.
Five final alternating passes per view met the 16.9 ms callback limit.
An earlier shared-machine series failed; its results and the limits of the
repeat are retained below.

## End-to-end checks

The invented browser walk makes one Chorus section with three matching places,
checks all six difference explanations, changes match settings without changing
queried music, and splits the middle place. A keyboard drum edit changes all
three places before the split; Undo restores them. A pointer edit afterwards
changes the two shared places while preserving the independent copy. A native
bass editor changes those same two places. Edited flags, actual queried events,
links and tempos survive two copies and a fresh-page paste/reference reopen.
Source text typed but not applied survives closing and reopening its editor;
Revert leaves the applied music unchanged. Muting preserves arranged ownership
and exposes an unmute hint. Copied literal fills remain unarranged and their
queried Mine notes remain visible beside editable cells. The pixel assertion
first failed with zero visible note pixels, then passed after grid painting was
limited to eligible bars. Only the invented screenshot is committed.

The private production-browser walk on the first test session, song 1 selected
bar 1's drums and accepted all 21 native reuse offers. One cell edit changed
all 22 places by one onset, from 242 to 264. Every place was marked edited;
Mine showed all 264 actual queried onsets. Copy reported 12 silent bars and
no queried onset fell in those unarranged bars. The system clipboard contained the
copy panel's exact text. Two fresh-page pastes and explicit reference reopens
preserved queried values, every source link, edited flag and tempo, with zero
runtime errors. A single observation of input to refreshed Mine plus two
animation callbacks took 561.7 ms; this is not an audio latency measurement or
a repeated performance estimate. Real-song screenshots stay local.

The reused single-instrument query initially exceeded its five-second budget.
G119 asks the full tagged program even for one row. A separate synthetic
shared-initializer canary proves a correctness difference: full playback gives
61/61; the former isolated expansion gave 62/63. The existing isolated fallback
and timeout remain. A failed multi-row query can add five seconds before fallback; a failed
one-row answer is reported directly, without repeating its question.
Full-song literal-fill query limits from the [score-query report](score-query-measurements.md)
remain; this walk does not establish every-bar arrangement scalability.

## Frame protocol

Production builds, pinned dependencies, Chromium 158.0.8127.18, Node 24.22.2,
16-core Linux, 1440×1100 CSS pixels and device scale 1. The machine-wide suite
lock serializes participating Ghost Notes Node/browser suites across worktrees;
other projects can bypass it. Per-input load averages are retained in
the anonymous local reports. The corpus spans 35–243 bars, 1,377–3,947 source
notes per song, six stems each: 14,047 source notes and 1,343 queried first-eight-bar
arrangement onsets in total. Query/Mine totals and zero query/runtime errors are
checked on every pass. Full data supplies matching and edits; drawing retains
the 200-event per-source/bar cap and the shared Mine/recording-ghost allowance.

A busy four-bar lens stays on screen after opening, moving and closing. Pointer
movement crosses Mine on each timed callback, using the actual drum-grid host
when visible. Before move and close, the existing native Source editor is
opened on an interior bar with unapplied text; each operation must close it
even when that bar remains visible, without changing the
document. Numeric requestAnimationFrame timestamps are matched one-for-one
against CDP User Timing marks, including the callback after the final drawing
frame. The unchanged limit is 16.9 ms, allowing 60 Hz timestamp rounding.
Transport is stopped. Screenshots and pixel readbacks happen after timing;
CPU/Skia profiling is excluded from qualification.

## Repeated results

Five runs per view alternated Rows, Layers, Rows, Layers. The busy working stem
was drums in three inputs and pitched in three. All 5,157 intervals matched
CDP marks one-for-one and stayed at most 16.8 ms. The table reports each run's
worst callback: median [minimum–maximum], plus the sum of intervals across five
runs. Opening, moving and closing each had a maximum of 16.8 ms for every input.

| Anonymous input            | Bars | Source notes | Rows worst, ms   | Layers worst, ms | Intervals Rows / Layers |
| -------------------------- | ---: | -----------: | ---------------- | ---------------- | ----------------------: |
| first test session, song 1 |   35 |        1,433 | 16.8 [16.7–16.8] | 16.8 [16.8–16.8] |               432 / 433 |
| first test session, song 2 |   76 |        2,203 | 16.8 [16.8–16.8] | 16.8 [16.8–16.8] |               427 / 431 |
| first test session, song 3 |   82 |        1,805 | 16.8 [16.8–16.8] | 16.8 [16.8–16.8] |               428 / 430 |
| first test session, song 4 |   62 |        3,282 | 16.8 [16.8–16.8] | 16.8 [16.8–16.8] |               431 / 428 |
| diversity-1                |  243 |        3,947 | 16.8 [16.8–16.8] | 16.8 [16.7–16.8] |               429 / 431 |
| diversity-2                |   51 |        1,377 | 16.8 [16.8–16.8] | 16.8 [16.8–16.8] |               427 / 430 |

An additional forced-drums pass in each view covered every song's cell host:
517 intervals per view, all at most 16.8 ms. Combined, the 12 passes verified
**6,191 intervals**, 5,975 pointer moves (1,200 on the cell host) and 144 native
Source editor closures. Every pass retained all 14,047 source notes and 1,343
queried arrangement onsets, with zero query/runtime errors. The drum-only
supplement is one pass per view, not five.

Whole-command time: Rows median 65.515 s [65.404–65.609], Layers 65.822 s
[65.710–66.838], five runs each. These optional six-song commands are outside
ordinary browser-suite accounting and exceed its 20-second individual-case
limit. Neither that limit nor the 180-second suite budget was raised. Initial
first-draw preparation, after import/decode, ranged 127.5–346.2 ms across these
runs; this work is outside the timed lens operations. Rows/Layers timings do
not establish a speed difference.

Per-input one-minute load averages ranged 0.15–2.02 during the repeated series.
Before/after command snapshots showed the same idle headless-browser pool at
0% reported CPU, without an additional active browser job. These are boundary
snapshots, not proof of exclusive machine use. Reports retain all three load
averages per input.

### Earlier failed series, unchanged application

The preceding series passed five Rows and four Layers runs, then the fifth
Layers run missed 19 intervals on songs 3–5, worst 50.0 ms. Query/runtime errors
were still zero. Load rose from 1.48 to 6.42 during that pass, and another
headless-browser job was active at inspection. A trace showed 12.162 ms wall
versus 4.223 ms thread CPU in one draw and a 1.966 ms collection near a missed
callback. Other failed-interval draws used 3.8–9.3 ms thread CPU. This is
consistent with scheduling/contention; it does not prove the cause of every
miss. No application code or threshold changed between that series and the
complete successful repeat. Both series' reports and traces are retained.
The repeated result therefore does not promise smooth frames under competing
browser/CPU work. A common launcher/lock across projects is a follow-up on #11;
process detection alone cannot exclude a job that starts later.

Stronger checks exposed two failures during development: a 33.3 ms opening
interval with six native instrument rows, then a 33.2 ms Layers closing
interval while a previously offscreen context became visible. Excluded CPU
and pipeline traces showed native DOM/layout and canvas drawing work. The
workspace now renders one chosen native instrument; static outside contexts
are prepared in the settled view before animations can reveal neighbouring
rows. Failed variants and their traces remain in private logs. There is no
paired speedup claim.

Reproduce with `GHOST_ARRANGEMENT_MEASURE=1 GHOST_LENS_MEASURE=1
GHOST_LENS_POINTER=1 GHOST_LENS_EDITOR=1 GHOST_LENS_RUN=<unique-run>
GHOST_TIMELINE_REPORT=/tmp/<unique-report>.json npm run measure:timeline`.
Add `GHOST_TIMELINE_LAYERS=1` for Layers, or `GHOST_LENS_DRUMS=1` to force the
drum surface. `GHOST_TIMELINE_SONG=1` through `6` isolates a diagnostic input.
The completed repeat used run names
`wave6-qualified-busy-ROWS-1` through `5` (and `LAYERS`), then
`wave6-qualified-drums-ROWS-6` and `LAYERS-6`; actual names use lowercase views.
The earlier series is `wave6-final-busy-ROWS-1` through `5` (and `LAYERS`).
Anonymous aggregate checks verify editor closures, pointer counts, query/Mine
equality and every numeric CDP timestamp. Reports and traces stay outside git. Profiling variants are diagnostic only.

Not measured: physical display presentation, perceived or audio latency,
active playback plus editing, touch/mobile memory, view-switch latency,
hundreds of successive source-preserving cell patches, or a complete literal
arrangement of every song. Later row speakers and simplify controls have
[documented hooks](lens-editing.md#next-steps-hooks).

## Checks and review

`npm run check` passed 631 Node tests (nine skips); `npm run test:browser`
passed 82 (one skip) in 134.560 s / 180 s after the CI follow-up below.
Both arrangement cases finished below the five slowest cases' 10.307 s,
within the unchanged 20-second accounting limit. Opus approved in four
rounds. Review found and fixtures reproduced wrong rewrite targeting in a split
copy, stale clicks during an unsent playback swap, an interior-bar editor left
open by a moving lens, and Remove → Add refusing a use-owned rewrite. Current
checks cover those fixes, including recovery of failed source text after closing
and reopening its editor. Reviewer usage was not exposed.

### CI follow-up

On the first PR #42 head, Check's functional browser cases passed (80, two
platform/opt-in skips) in 150.136 s, but the combined arrangement case took
21.523 s against the unchanged 20-second case budget. Hosting's separate runner
measured 24.226 s for that case and exposed two assertion races. The shared
arrangement setup now feeds two independent cases: shared editing/copy/reopen,
and rows/differences/view drawing. The original bodies and assertions remain.

A failed one-row score question had been followed by a duplicate isolated
question, delaying its row error to a second five-second deadline. A focused
controller test first failed with the row still pending, then verifies the
error settles without a second request. The existing browser timeout canary
still checks responsiveness, the seven-second user-facing error and recovery.
Source Apply waits on the existing completion signal within the same test
deadline; a sequence of legitimate questions is not assigned an unrelated
five-second assertion deadline. Case and suite budgets are unchanged. These
changes leave successful queries and the measured lens renderer unchanged.
