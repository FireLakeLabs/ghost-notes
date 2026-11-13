# Strudel proof

- **G36 (2026-11-13) Bar-by-bar `.cps()` fails for simultaneous notes; use
  G28's fallback: one editable song-average tempo.** Core 1.2.6 / web 1.3.0
  queries put a chord's two notes on the same downbeat. But Cyclist changes
  cps after the first note and reuses the old phase anchor for the second.
  Browser triggers split by 40 ms on a drifting four-bar fixture, and by
  120 ms when the initial 1.56 s tempo lasts three bars before a 1.60 s bar.
  This exceeds the chosen beat-map tolerance of 50 ms (one scheduler window,
  below half the measured 110 ms scheduling lead). A monophonic check alone
  misses the defect: its bar-schedule error is only 1.026 ms, with 30 ms
  within-bar drift against the map. Its proposed 3 ms whole-song target is
  withdrawn: phase errors can accumulate at each change. Constant-average
  scheduling preserves simultaneous notes and matches its own clock within
  0.000001 ms; it does not promise alignment with the recording (40 ms map
  error on the drift fixture). Steps 5/9 keep the beat map for reference
  positions and disclose playback drift. Export's per-place `.slow(f)` works
  without changing the scheduler tempo and remains available (step 10).
  Other tempo setters and per-beat time warping are unverified workarounds. Local map
  residuals (730/530/35/260 ms over 1,072 complete-bar queried beats, aligned
  to the first downbeat) describe input quality, not browser scheduling.
- **G37 (2026-11-13) The pickup is a once-only prefix, restarted before
  replay.** The first quarter cycle of `arrange` plays the pattern's first
  beat and the following bar starts its own pattern at zero. But the pickup
  on lap two starts on beat two, because a fractional total advances global
  phase. Steps 6/9/10 must stop/restart the whole arrangement for replay, or
  prove an explicit phase reset before offering a continuous pickup loop.
  G29's short section remains the representation. No visible design changes
  are made in this proof.
