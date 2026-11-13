# Decisions: design study (G9–G32)

Settled with the owner in the design study on 2026-11-13; why each was chosen is in [design-study/outcomes.md](../../design-study/outcomes.md). The index is [decisions](../decisions.md).

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
