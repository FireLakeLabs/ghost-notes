# Decisions: foundations (G1–G8)

The app, its data and its licence, settled before the design study. The index is [decisions](../decisions.md).

- **G1 (2026-11-12) A separate app, forked from ODM, with ODM's editors.** The
  owner chose to bring ODM's document model, import, generation, score sheet
  and editors rather than a plain text editor. Drift from ODM is accepted: no
  shared package, no syncing. A fork or a file copy are both fine.
- **G2 (2026-11-12) No saving in the app.** The user copies their Strudel out
  and keeps it themselves. Reference files are opened from local disk each
  session and never stored.
- **G3 (2026-11-12) Links travel in the copied text.** Each section's source
  file and bar ranges, and each instrument's stem, are written into ODM's
  existing metadata comments (`/*@odm-part {...}*/`, `/*@odm-pattern {...}*/`)
  and read back on paste. They hold names and bar numbers, never notes.
- **G4 (2026-11-12) Other people's music stays out of the repository,** as ODM
  D13: recordings, stems, MIDI, transcriptions and conversions of them. Tests
  use a local path or music written for the project. Documentation refers to
  the first test session by song number only.
- **G5 (2026-11-12) MIDI-to-Strudel conversion is a feature.** Both the literal
  conversion and structure-finding belong in the app, built on the research in
  `research/`.
- **G6 (2026-11-12) Hosted on AWS,** as its own stack in the Fire Lake Labs
  account, set up later and only with the owner's approval at the time.
- **G7 (2026-11-12) A design study comes before code,** run with the owner
  present. Its outcomes become decisions here.
- **G8 (2026-11-12) Our code is MIT; the hosted app meets Strudel's AGPL.**
  The Strudel packages (`@strudel/*`, `superdough`) are AGPL-3.0-or-later. The
  built app bundles them and serves them to every visitor, which counts as
  distributing them, so the app as served must meet AGPL terms. It does that
  by keeping this repository's source public and showing a notice in the app:
  it uses Strudel under AGPL-3.0-or-later, with a link to the source of the
  deployed commit. The same position as ODM D43.
