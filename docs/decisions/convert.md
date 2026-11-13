# Literal conversion

- **G57 (2026-11-13) Literal snapping bounds each onset by both 1 ms and
  1/1024 beat.** Choose subdivisions per instrument and bar by doubling from
  16, and keep the source onset's half-open bar ownership. Clamp a rounded
  final step inside that bar; never move it to the next downbeat. Fail explicitly
  above 1,048,576 subdivisions. This is a literal baseline, not a musical
  quantization choice for the arranger. Report median, p95 and maximum residuals.
- **G58 (2026-11-13) Keep uncovered notes in explicit edge sections.**
  Detected maps stop early on the local corpus. Whole-song conversion includes
  leading/trailing uncovered sections rather than dropping their notes or
  inventing numbered bars. Their reversible timing uses the adjacent bar's
  seconds per observed beat × nominal beats per bar; beat-error units use the nearest observed beat interval.
  All instruments share these sections. The map remains unchanged and the
  result marks these spans `uncovered`. Sections selected by numbered bar range
  exclude uncovered edges. Fractional output still obeys G37's reset-before-replay
  limit; step 9 owns actual beat-map scheduling.
- **G59 (2026-11-13) Preserve each note separately and retain its duration in
  seconds.** After snapping its onset, shift its end by the same seconds and
  write cycle duration as `legato`; retain velocity as `gain(velocity/127)`.
  Identical notes, chords and overlaps remain distinct events. Emit moved
  records, plus a bar-crossing record if a moved sustain end crosses a numbered
  boundary. Neither shortening nor merging is needed for literal conversion;
  reserve those record kinds for later transformations. Emit an ODM instrument
  boundary so bars and the five drum lanes import as one instrument. Sound
  choices remain editable (G19); the baseline pitched preset is `triangle`.

Issue #23 extends G57/G59 for chosen musical grids; exact mode keeps both.
Decided for the owner on 2026-11-13:

- **G67: default to four steps per beat (sixteenths).** Offer 1, 2, 3, 4, 6, 8,
  16 and exact, as a session-only converter argument (G23). All six songs and
  every stem were queried at each option; [measurements](../convert-grid-measurements.md)
  include errors, merges and bytes. Four gives 16 steps in a full four-beat bar.
  ODM's rhythm editor requires 20 px per mouse target or 44 px for touch: 16
  steps fit in 320/704 px; 64 need 1280/2816 px and otherwise zoom to one part.
  Coarser settings merge substantially more source notes; finer grids retain
  timing detail at the cost of smaller targets and longer text. This chooses
  an editable starting point, not musical ground truth. Keep exact available.
- **G68: snap within the source bar; shorten without extending.** Nearest
  onset step, ties later, clamped before the end, including the last 5% (G57).
  Pickup uses its own observed beat count. Shift the end by the same seconds,
  then floor it to its destination bar's grid only when still after the onset.
  Retain sub-step/zero lengths and uncovered ends; do not extend a note to fit.
  Uncovered onsets always use exact mode (G58). Record final moved/shortened
  endpoints and sustain-end boundary crossings (G31). No reference data changes.
- **G69: merge same pitch at the same written step explicitly.** Within one
  span, lowest source index represents the group, highest velocity and longest
  snapped tail win. Keep one result record per original with its representative
  index, and one merge change listing all originals and the single outcome.
  Distinct pitches remain simultaneous voices. Grid text uses ordinary note or
  sample sequences with aligned gain and legato patterns, editable through ODM.
  Exact mode retains separate duplicates and seconds durations (G59). The proof
  counts emitted-once plus recorded-as-merged and queries both original and
  ODM-regenerated text. This is literal quantization; structure finding remains
  step 11, and changing Notes must not overwrite Mine (G13).
