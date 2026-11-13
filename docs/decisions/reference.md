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
- **G47: keep one decoded song, process stems sequentially.** Decode at 44.1
  kHz through a temporary Web Audio context, closing it afterward. Keep each
  AudioBuffer and min/max waveform bins across all channels for step 9.
  Release the previous reference before decoding another song; failure leaves
  no current reference. This avoids a hidden multi-song PCM cache. Report
  encoded bytes, retained float32 PCM and peaks separately; no arbitrary
  per-file limit based on just one song.
- **G48: retain only the last browser folder handle.** The picker adapter
  keeps its picked or dropped handle and attempts IndexedDB storage for reopening after
  reload. It asks for read permission when needed; storage failure still
  permits session access. No note, audio or provenance bytes are persisted.
  The drop/input adapter requires a folder each session. A source manifest
  uses a native song selector with ordinal labels; importing shows a plain
  summary in the existing shell, as recorded in the step 5 sketch.
