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
