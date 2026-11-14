# Strudel proof

- **G36 (2026-11-13) Reject live bar-by-bar `.cps()` changes as the
  mechanism for following the band.** Core 1.2.6 / web 1.3.0 queries put a
  chord's two notes on the same downbeat, but Cyclist changes cps after the
  first note and reuses the old phase anchor for the second. Browser triggers
  split by 40 ms on a drifting four-bar fixture and by 120 ms after three
  1.56 s bars change to a 1.60 s bar. This exceeds the 50 ms beat-map
  tolerance (one scheduler window, below half the measured 110 ms scheduling
  lead). A single voice hides the defect: 1.026 ms bar-clock error and 30 ms
  within-bar drift; phase errors can also accumulate at tempo changes.
  This rejects `.cps()`, not in-app following of the beat map. Step 9 must
  query patterns in cycles and schedule events at the beat map's time for
  each cycle position, through our scheduling seam. This time warping is
  untested here; its whole-song timing proof belongs to step 9. Simultaneous
  onsets must map to the same audio-context time. Only if step 9 measures
  that warping cannot keep events within tolerance does G28's one editable
  song-average fallback apply. A constant-tempo control preserves chords
  but does not establish alignment with recorded stems (G20).
  The copy keeps an editable tempo per section (G28): fractional per-place
  `.slow(f)` works without changing scheduler cps. Local map residuals
  (730/530/35/260 ms over 1,072 complete-bar queried beats from the first
  downbeat) describe input quality, not browser scheduling.
- **G37 (2026-11-13) The pickup is a once-only prefix, restarted before
  replay.** The first quarter cycle of `arrange` plays the pattern's first
  beat and the following bar starts its own pattern at zero. But the pickup
  on lap two starts on beat two, because a fractional total advances global
  phase. Steps 6/9/10 must stop/restart the whole arrangement for replay, or
  prove an explicit phase reset before offering a continuous pickup loop.
  G29's short section remains the representation. No visible design changes
  are made in this proof.
- **G38 (2026-11-13) Pin `@strudel/soundfonts` 1.3.0 for General MIDI.**
  The published manifest has no peer dependencies; its exact dependencies
  are core 1.2.6 and webaudio 1.3.0, deduplicated with our pins. The web
  bundle has synths but does not register General MIDI. Keep the import in
  `src/strudel/`, using the pinned `fontloader.mjs` submodule: its package
  entry also mutates `Pattern.prototype.soundfont` and imports an unrelated
  SF2 parser. A seam adapter shares the web bundle's audio context, bridges
  the standalone sound entry into its registry, and preloads each pitch and
  variant before scheduling. Offline CI supplies an authored WAV in two
  synthetic font zones; actual preset downloads run only in `online`.
  This proves `gm_piano`, not every General MIDI preset or variant. The
  upstream loader evaluates preset JavaScript from its fixed HTTPS host;
  custom soundfont hosts are not exposed by this seam.

  Failed preset downloads remain cached by the pinned upstream loader: reload
  the page before retrying after a network failure. Its direct-`eval` build
  warning is expected; the loader is in a lazy chunk.

- **G115 (2026-11-14) Ask multi-row score windows in their complete playback context.**
  For two or more rows, query the generated program with the same instrument
  tags used by playback. Read row identity from Hap context, outside sound
  values, and partition actual queried events. Refresh every row after edits:
  group rewrites such as arp can make one row depend on its neighbours, so
  mixing whole and isolated answers would make the display inconsistent.
  Single-row documents keep isolated questions. Errors, opaque values or
  missing/unknown identities fall back to that path; cancelled obsolete work
  cannot start its fallback.
  Every question still gets a fresh worker and the existing five-second limit.
  No result cache, new data cap or worker reuse is introduced. Independent play
  preflight remains. This removes repeated generation/evaluation before the
  timeline can show Mine. A full-context row can differ from its isolated/solo
  answer for cross-row transforms; isolated fallback retains the old behaviour.
  Decided for the absent owner after repeated CI budget failures. The
  [score-query report](../score-query-measurements.md) records the measured
  scope and full-program limitation; no visual design changes.

- **G119 (2026-11-14) Keep shared evaluation for a one-instrument score too.**
  Decided for the absent owner; supersedes G115's single-row exception. Ask one
  tagged whole-program question for any nonempty score, including every edit.
  Isolating a reused instrument expands its definition at each place: a shared
  initializer then runs repeatedly and can give different notes from playback.
  A synthetic canary returned 62/63 instead of the actual 61/61 before this fix.
  The real lens walk also exposed the five-second limit after accepting 21
  native reuse offers for one drum bar. Full questions keep the shared bindings;
  the existing isolated fallback, cancellation and per-question budget remain.
  A timed-out full question can therefore add five seconds before fallback,
  including for one row. No new worker or data limit is introduced.
