# Decisions: reference import

Decided for the owner during step 5, 2026-11-13.

- **G45: evidence-aware reference coordinates.** Preserve seconds, interpolate
  between detected beats, anchor beat zero and bar 1 at the first downbeat.
  Preserve the tool's gaps and tempo doubt. Gap interpolation is explicitly
  marked; uncovered edges have no beat coordinates. Never infer how many
  beats a gap lost. Bar tempos use observed intervals and exact downbeat
  boundaries; a final incomplete bar is marked partial. This gives steps 6–9
  queryable timing without silently extending detection.
- **G46: MIDI is secondary, using midi-file 1.2.4.** Prefer notes JSON; absent
  notes JSON falls back to stem MIDI, while invalid JSON fails. Retain MIDI
  notes separately. Pin the small MIT parser with bundled declarations and no
  runtime dependencies. Registry unpacked sizes checked 2026-11-13:
  midi-file 47,239 bytes, @tonejs/midi 287,668 bytes. Both have older releases
  (2023 and 2022); Tone itself uses midi-file. We need the parser, not Tone's
  higher-level editing model. Synthetic tempo-change tests cover our adapter.
