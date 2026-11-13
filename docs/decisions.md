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

## [Transcription](decisions/transcription.md)

- G40: version 1 song folders with explicit relative paths and every stem.
- G41: cache by source content, bounds, settings, models, dependencies and code.
- G42: expose beat coverage and tempo doubt without changing detected beats.
