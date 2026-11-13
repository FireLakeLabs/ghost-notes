# Decisions

What is settled. Each entry says when and why. Ghost Notes inherits ODM's
decisions where its code is inherited; they are listed in ODM's
`docs/decisions.md` (D1–D40 as of 2026-11-12) and are re-examined, not assumed,
when this app departs from them.

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
- **G9 (2026-11-13) The lens.** Opening a section grows its bars in place
  inside the whole-song timeline; the rest of the song stays visible, squeezed
  to the sides. Chosen over stacking the sheet under the timeline or switching
  between two modes, so the detail never leaves its context. Replaces ODM's
  separate one-section sheet (D18, D34) for this app.
- **G10 (2026-11-13) Rows and layers, both.** Each instrument shows MIDI,
  Notes and Mine as stacked rows or as one layered row; the user switches per
  instrument, and a setting switches all.
- **G11 (2026-11-13) One lane per drum.** Kick, snare, hi-hat, tom and crash
  each get a lane.
- **G12 (2026-11-13) Selection is a user setting:** whole band or one
  instrument, snapping to bars or beats. Sections stay whole bars, because one
  bar is one Strudel cycle; a beat selection only limits which notes come in.
- **G13 (2026-11-13) Starting content and written form are separate.** A new
  section starts as a literal copy by default (a setting). At copy time the
  user chooses how unedited sections and unarranged bars are written.
- **G14 (2026-11-13) Reuse.** Matching places are offered when a section is
  made. Any place can be split off as its own copy. A new section takes over
  bars it overlaps, with a warning.
- **G15 (2026-11-13) Bar 1 is at the first detected downbeat.** A pickup
  before it is a short bar 0.
- **G16 (2026-11-13) Simplify limits are user settings.**
- **G17 (2026-11-13) No Now constellation or Watch spiral.** Ghost Notes
  stands alone; ODM's `live` and `spiral` modules are not copied.
- **G18 (2026-11-13) Copy out** is a panel. The Copy button shows when there
  are changes since the last copy, and leaving the page with uncopied changes
  asks first.
- **G19 (2026-11-13) Synths and samples,** chosen per instrument.
- **G20 (2026-11-13) Stem audio is an optional fourth row.** Each instrument
  can show its stem's audio, opened from local disk (G2) and never in the
  repository (G4). A speaker on each row chooses what Play plays.
- **G21 (2026-11-13) What counts as a match is a user setting:** timing
  tolerance, whether quiet recorded notes count, and exact pitch or any
  octave.
- **G22 (2026-11-13) Dark scheme:** blue for the recording, cream for the
  user's own, orange for differences.
- **G23 (2026-11-13) Settings last for the session only.** They are not
  remembered between visits and not written into the copied text, for now.
  Consistent with G2.
- **G24 (2026-11-13) Ghost Notes stays a web app.** It is installable from
  the browser into its own window. In Chromium browsers it asks once for a
  song folder and can reopen it; elsewhere the user drags the folder in each
  session. File access sits behind one small layer, so a desktop shell
  (Electron) stays possible if the app should later run the transcription
  tool itself. G6 hosting stands.
- **G25 (2026-11-13) One instrument per stem to start.** A stem is one track
  the splitter writes: its audio and its transcription. Splitting a stem into
  two instruments, or merging two, comes later.
- **G26 (2026-11-13) The drum kit is one instrument, written one line per
  drum:** a `stack` of `s(...)` lines matching the lanes on screen (G11).
- **G27 (2026-11-13) A doubtful tempo is asked about once.** When the beat
  map may be at half or double the real tempo, the app shows ½×, 1× and 2×
  side by side over the same bars and asks; a control stays available.
- **G28 (2026-11-13) Playback follows the band; the copy has a tempo per
  section.** In the app, the user's parts play along the recording's beat
  map, so they stay with the stem audio, which plays as recorded. In the
  copied Strudel each section gets its own tempo (the band's average within
  it), editable. This partly reverses "tempo maps in the output" being out of
  scope in the idea. To check first: that Strudel 1.2.6 can change speed while
  playing and can carry a tempo per section cleanly. If not, one editable
  tempo (the song's average) is the fallback.
- **G29 (2026-11-13) The pickup is its own short section,** placed before
  bar 1, so the section starting at bar 1 keeps a clean, loopable length.
- **G30 (2026-11-13) Simplify starts with drums, and all instruments are
  committed scope.** Riff matching by intervals, scale degrees and cleaning
  for bass and keys follow; they are part of the plan, not optional.
- **G31 (2026-11-13) Difference marks as drawn on the Rows board:** moved
  (with a line back to where it was played), moved across a bar line,
  shortened, merged, only in yours (orange) and only in the recording
  (hollow). Hovering a mark says what happened.
- **G32 (2026-11-13) Pitch is a contour outside the lens and a piano roll
  inside it.**
- **G33 (2026-11-13) ODM's corpus comes in whole.** Its 13 `real-*`
  programs were generated by AI, so the owner confirms there is no licence
  issue; corpus/README.md's note that collection "does not assert a
  third-party licence" refers to that. 44 tests use them.
