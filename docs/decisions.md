# Decisions

What is settled. This page is the index: one line per decision. The full entry,
with its date and reason, is in the linked file. Ghost Notes inherits ODM's
decisions where its code is inherited; they are listed in ODM's
`docs/decisions.md` (D1–D40 as of 2026-11-12) and are re-examined, not assumed,
when this app departs from them.

To add a decision, take the next free G-number, write the full entry in the
topic file it belongs to (or a new file in [decisions/](decisions/)), and add
its line here. Replace a decision by adding a new one that names the old;
never edit history away. Every file here has a word budget (`npm run
check:docs`); when a topic file fills, start a new one.

## [Foundations](decisions/foundations.md)

- G1: a separate app, copied from ODM, with ODM's editors.
- G2: no saving in the app; the user copies their Strudel out.
- G3: links (source file, bar ranges, stem) travel in the copied text.
- G4: other people's music stays out of the repository.
- G5: MIDI-to-Strudel conversion is a feature.
- G6: hosted on AWS, its own stack, with the owner's approval at the time.
- G7: a design study comes before code.
- G8: our code is MIT; the hosted app meets Strudel's AGPL.

## [Design study](decisions/design.md)

- G9: the lens: a section opens in place inside the whole-song timeline.
- G10: rows and layers, both, switched per instrument.
- G11: one lane per drum.
- G12: selection is a user setting; sections stay whole bars.
- G13: starting content and written form are separate.
- G14: reuse: matching places offered, split-off copies, takeover with warning.
- G15: bar 1 is at the first detected downbeat.
- G16: simplify limits are user settings.
- G17: no Now constellation or Watch spiral.
- G18: copy out is a panel, with a changed marker and a leaving warning.
- G19: synths and samples, chosen per instrument.
- G20: stem audio is an optional fourth row; a speaker per row.
- G21: what counts as a match is a user setting.
- G22: dark scheme: blue recording, cream yours, orange differences.
- G23: settings last for the session only.
- G24: Ghost Notes stays a web app, installable, with folder access.
- G25: one instrument per stem to start.
- G26: the drum kit is one instrument, written one line per drum.
- G27: a doubtful tempo is asked about once (½×, 1×, 2×).
- G28: playback follows the band; the copy has a tempo per section.
- G29: the pickup is its own short section.
- G30: simplify starts with drums; all instruments are committed scope.
- G31: the six difference marks, as drawn on the Rows board.
- G32: pitch is a contour outside the lens and a piano roll inside.

## [Code and toolchain](decisions/toolchain.md)

- G33: ODM's corpus comes in whole.
- G34: TypeScript 7 and Oxlint.
- G35: decisions are an index plus topic files, each under a word budget.

## [Strudel proof](decisions/strudel-proof.md)

- G36: reject live `.cps()`; prove beat-map time warping in step 9 before using G28's fallback.
- G37: a fractional pickup is a once-only prefix; restart before replay.
- G38: pin soundfonts 1.3.0; bridge General MIDI through the Strudel seam.

## [Transcription](decisions/transcription.md)

- G40: version 1 song folders with explicit relative paths and every stem.
- G41: cache by source content, bounds, settings, models, dependencies and code.
- G42: expose beat coverage and tempo doubt without changing detected beats.

## [Reference import](decisions/reference.md)

- G45: preserve uncertain timing in queryable reference coordinates.
- G46: notes JSON first, MIDI second through pinned midi-file.
- G47: one decoded song, sequential stems, retained PCM and min/max peaks.
- G48: persist only the last folder handle; source folders use a song selector.

## [Consistent bar grid](decisions/grid.md)

- G53: use the derived 1× grid by default; tempo choices select grids.
- G54: explain each inference and preserve gaps, edges and tempo uncertainty.
- G55: add level-switch reporting to version 1; read old folders unchanged.
- G56: show grid counts and ask once when tempo is flagged.

## [Literal conversion](decisions/convert.md)

- G57: adaptive onset snapping within 1 ms and 1/1024 beat, never across a bar line.
- G58: preserve uncovered edge notes in explicit, unnumbered sections.
- G59: retain separate notes, seconds durations, velocity and one ODM instrument boundary.

- G67: session musical grids, default four steps per beat; exact stays available.
- G68: bar-owned onset snapping and end flooring without extending notes.
- G69: explicit same-pitch merges and editable sequences, with every source accounted for.

## [Whole-song timeline](decisions/timeline.md)

- G61: draw the chosen grid; uncovered edges remain unnumbered.
- G62: viewport canvases and a declared 200-event cap per bar cell.
- G63: prototype row order and sizes, optional audio, quiet-stem warnings.
- G64: the song strip navigates the visible window before sections exist.
- G65: affected bars show the chosen grid's inference reasons.

## [Playback](decisions/playback.md)

- G72: fixed-clock onset and sustain warping through the chosen grid; 1 ms additional scheduling tolerance.
- G73: one shared audio clock, bar seeks restart at recorded offsets, live edits retain stem phase.

## [Simplify](decisions/simplify.md)

- G77: report one-to-one source onset/pitch matches with explicit denominators.
- G78: independent deterministic proposals, including those that expand.
- G79: conservative session limits; record their measured effects.
- G80: retain source lineage and converter-shaped changes through suggestions.

## [Sections and links](decisions/sections.md)

- G91: optional source, place tempo, edited flag and stem fields in ODM metadata.
- G92: canonical song cycles for playback, per-place stretching only in copied text.
- G93: whole-place takeover warnings and independent section copies.
- G94: reference onset/pitch Jaccard offers with the prototype's match knobs.
- G95: mark changed section content edited at the shared document mutation boundary.
- G96: group independent section patterns into stem rows without note propagation.

## [Hosting](decisions/hosting.md)

- G103: offline PR hosting checks and a repository gate on both AWS workflows.
- G104: serve licence notices as plain text; guard the complete pinned source list.
- G105: publish the install manifest and icons as static files with correct headers.
