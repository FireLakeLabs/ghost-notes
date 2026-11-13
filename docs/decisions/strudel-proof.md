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
