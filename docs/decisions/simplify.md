# Decisions: simplify

- **G77 (2026-11-13) Compare proposals with source evidence.** Retention and
  match shares use one-to-one onset/pitch matching in recorded seconds, with
  G21 settings. Duration and gain changes remain in the change ledger. Quiet
  filtering excludes source notes and their faithful quiet copies; added notes
  and unmatched counted proposals still lower precision.
  Empty denominators have share 1 and an explicit count of zero. This prevents
  duplicated notes or a coarse grid from claiming perfect reconstruction.
- **G78 (2026-11-13) Keep suggestions separate and deterministic.** Drum bar
  clustering, three cleaning operations, interval riffs, scale degrees, exact
  Euclidean fits and phrase repeats are independently inspectable. Expanded
  programs remain measured candidates (`shorter: false`); the UI must not call
  them shorter. No random fills. This keeps the losses attributable to a
  technique, and includes bass, keys and other pitched stems (G30).
- **G79 (2026-11-13) Conservative session defaults.** Start with 50 ms maximum
  extra endpoint movement, unchanged matched drum gain, 10% drop/add budgets, fills protected, Jaccard 0.25.
  Cleaning starts below velocity 32: stray duration ≤80 ms, split gap ≤30 ms,
  isolated octave duration ≤200 ms. Only weak fragments join; only an octave
  excursion between two nonoverlapping equal pitches corrects. These are
  hypotheses without attack evidence, not proof of errors. The six-song tables
  measure their effect; a zero-change result is preferable to pretending to
  identify noise. Match defaults are 50 ms, quiet included, exact pitch.
- **G80 (2026-11-13) Preserve source lineage through suggestions.** Extend the
  converter change shape with dropped/added kinds and parallel pitch/velocity
  arrays. Merges retain all original indices; added notes have no original,
  dropped notes no written endpoint. Compare directly with source evidence,
  including chosen-grid changes. Step 7 can draw the same six marks (G31).
