# Next steps

In order. Each step says what it needs, what it produces, and how we know it is
done. Sizes are estimates from reading ODM's code on 2026-11-12, not
measurements. Revised on 2026-11-13 to match the design study (G9–G32).

## 1. Design study (with the owner): done

Outcomes are in [design-study/outcomes.md](../design-study/outcomes.md) and
decisions G9–G32 in [decisions](decisions.md). The canvas source is in
[design-study/sketches/](../design-study/sketches/README.md). The owner ran the
usability test on the prototype and reported no issues.

Still worth doing, and not blocking: the same five tasks with someone new to
the design.

## 2. Bring in ODM's code: done

Done on 2026-11-13. Copied from ODM `main` at `26c3689`, with the whole corpus
(G33). On the unchanged copy `npm run check` passed (544 Node tests) and the
browser suite passed 64 with 3 skipped. Then the constellation and spiral were
removed (G17) and the app renamed: 489 Node tests and 56 browser tests pass,
1 skipped.

Known flaky: the browser test "Kiln live: split removal, undo, literal marks
and evenly spread drum hits" (`tests/browser/rhythm.spec.ts`) failed 2 of 5
runs here, each time seeing 3 of 4 expected bass triggers in the measured
cycle. It passed in ODM's own checkout on its one run. Not yet investigated.

What was planned:

GitHub does not allow forking a repository into the organisation that already
owns it, so this is a **file copy** of ODM `main` at a recorded commit.

- **Copy:**
  - `src/` modules: `strudel`, `engine`, `document`, `import`, `generate`,
    `editor`, `sheet`, `app`, `contract.ts`. The sheet's drawing code becomes
    the inside of the lens (G9).
  - The tests for those modules.
  - `scripts/` (Node tests, browser suite, docs and boundary checks).
  - Configs: Vite, Vitest, Playwright, TypeScript, ESLint, Prettier.
  - `package.json` and `package-lock.json`.
  - The relevant entries from ODM's `docs/lessons.md` and `docs/standards.md`.
- **Leave out:** `live` and `spiral` (G17), `spikes/`, `metrics/`, `infra/`
  (until step 12), and ODM's `corpus/`, unless a copied test needs part of it.
  Check its licence notes first.
- **Keep the `@odm-` metadata tag names** so copied text also pastes into ODM
  (G3).
- **Done when:** `npm run check` and `npm run test:browser` pass on the
  unchanged copy, before any Ghost Notes change, and the ODM commit is
  recorded in the README.

## 3. Prove the Strudel assumptions

Several decisions rest on Strudel behaviour nobody has checked at the pinned
versions. Check each in Node and in the browser suite before building on it.
Each check compares the events Strudel schedules, never how anything sounds.

- **Tempo per place (G28):** `arrange([n * f, part.slow(f)], ...)` plays `n`
  bars of `part` at `setcpm` ÷ `f`, including fractional cycle counts.
- **Following the band (G28):** changing the tempo while playing, bar by bar
  from a beat map, keeps every event within a set tolerance of the beat map's
  times.
- **The pickup (G29):** a quarter-cycle entry at the start of `arrange` plays
  the first beat of its pattern and shifts nothing after it.
- **Samples (G19):** which sample banks load at the pinned versions, and
  whether General MIDI sounds need `@strudel/soundfonts`. If they do, pin it to
  a version matching the other Strudel packages, and add it to the working
  rules.

**Done when:** each item has a test, or a recorded fallback. If tempo per
place fails, the fallback is one editable tempo, the song's average (G28).

## 4. Move the transcription tool

Move `tools/audio-to-midi` from ODM to here. That is one PR in each repo. Fix
what the first run showed:

- The beat map must cover the whole piece, or say where it stops.
- The cache key must include the settings and model, so stale results aren't
  reused.
- Flag a likely half or double tempo instead of choosing silently. The app
  asks about it (G27).
- Write one folder per song, holding each stem's audio, `notes.json`,
  `beats.json` and the MIDI, in a layout the app can open in one go (G20, G24).
  Output goes under `reference/`, which is git-ignored.

The drum model's weights are non-commercial share-alike (see the tool's
README). Personal use is fine; anything shipped needs permission or another
model.

## 5. Reference import (TypeScript)

- **Opening files (G24):** in Chromium browsers, ask once for a song folder
  and reopen it later; elsewhere, accept a dropped folder each session. All of
  it sits behind one small file layer, so a desktop shell stays possible.
  Nothing is uploaded or stored (G2).
- **Notes:** read `notes.json` + `beats.json` first, since they carry more than
  the MIDI, and MIDI second (`@tonejs/midi` or `midi-file`).
- **Audio (G20):** decode each stem and compute waveform peaks for the audio
  row. Keep the decoded audio for playback.
- **Beats:**
  - Map seconds to beats with the beat map, piecewise between detected beats.
  - Bar 1 is the first detected downbeat; anything before it is bar 0 (G15).
  - Keep each bar's tempo for playback and for the copy (G28).
  - Mark uneven stretches and where the map stops.
- **Stems:** one instrument per stem (G25). Keep stem names, and the stem
  levels used to flag possible bleed.
- Tests use synthetic fixtures written for the project, including a short
  generated audio file.

**Done when:** a fixture with a pickup, a tempo change and a gap in the beat
map imports with exact beat positions and the right bar tempos, and a fixture
folder opens through both the folder picker path and the drop path.

## 6. Literal converter (TypeScript)

Our own converter, informed by
[the literal conversion study](../research/midi-to-strudel-literal.md). Do not
reuse the GPL converter's code. Fix its known faults:

- Respect time signatures and the pickup, which is written as its own short
  section (G29).
- No moving notes from the last 5% of a bar onto the next downbeat.
- No duplicated notes at bar boundaries.
- Keep durations and velocity (as `gain`).
- Give every stem the same bar count so they loop together.
- Write drums as one instrument, one line per drum (`bd sd hh lt cr`, G26).
- Record every change it makes (moved, moved across a bar line, shortened,
  merged), for the difference marks (G31).

**Done when:** every MIDI note appears exactly once, which the first study
already measured as possible (9,008 of 9,008), with the timing error reported.

## 7. Timeline and the lens

The whole-song view, with the section sheet as a lens inside it (G9). This
merges the old timeline step and the old "reference marks in the sheet" step.

- **Rows:**
  - Per instrument: an optional audio row (G20), then MIDI, Notes and Mine.
  - Rows or layers, switched per instrument and for all (G10).
  - One lane per drum (G11).
  - Pitch as a contour outside the lens and a piano roll inside (G32).
  - The six difference marks, each explained on hover (G31).
  - Bars not arranged are marked and never look silent.
  - A match strip under arranged bars, using the match settings (G21).
- **The lens:**
  - Opens on a section or on selected bars.
  - Grows into place with an animation; the bars outside it blur and dim
    slightly.
  - Can be dragged along a section a bar at a time, from its header or its
    outline in the song strip; arrows do the same from the keyboard.
  - Respects reduced motion.
  - Drums are edited in the lens; bass and keys use ODM's editors there.
  - Mind ODM's 200-events-per-cell drawing cap.
- **Selecting:** whole band or one instrument, snapping to bars or beats
  (G12).
- **Doubtful tempo:** ½×, 1× and 2× side by side, asked once (G27).

Larger than ODM's spiral view (about 400 lines); estimate again after step 2.

**Done when:** a real four-song session from a local path draws; opening,
moving and closing the lens animates without dropped frames on the owner's
machine (measured with the browser's performance tools); and the browser suite
stays under its time budget.

## 8. Sections, reuse and links

- One new document edit, "make section from range". Sections are whole bars;
  a beat selection only limits which notes come in (G12).
- A new section starts as a literal copy by default (G13).
- When a section is made, offer the other places where the same music plays,
  pre-ticked (G14).
- Split one place off as its own copy; a new section takes over bars it
  overlaps, with a warning (G14).
- The pickup can be its own section (G29).
- Sections gain an optional source (file and bar ranges), a tempo per place
  (G28) and whether they have been edited (G13); instruments gain an optional
  stem. All of it is written to and read from the metadata comments (G3).

**Done when:** making a section, copying out, pasting back and reopening the
reference restores every link and tempo.

## 9. Playback and listening

- A speaker on every row decides what Play plays, with presets for Recording,
  Mine and Both (G20).
- The user's parts follow the band's beat map, and the stem audio plays as
  recorded (G28).
- Synths and samples per instrument (G19).

**Done when:** for a fixture beat map with tempo changes, the scheduled times
of the user's notes are within a set tolerance of the beat map's times across
the whole song. This is a measured check; nobody judges by ear.

## 10. Copy out and the app shell

- A copy panel (G18) that asks how to write unedited sections (as made,
  literal or simplified) and unarranged bars (silence, literal or simplified)
  (G13). It warns how many bars will be silent.
- A changed-since-last-copy marker on the Copy button, and a warning when
  leaving the page with uncopied changes (G18).
- Settings last for the session only (G23).
- Installable from the browser into its own window (G24).
- The dark scheme (G22).
- The licence notice (G8): the app uses Strudel under AGPL-3.0-or-later, with a
  link to the source of the deployed commit.

**Done when:** the copied text for a fixture arrangement loads in Strudel at
the pinned versions and plays the expected events, measured as in step 3.

## 11. Simplify

The limits are user settings (G16). Drums come first; every instrument is in
scope (G30).

1. **Drums:** cluster near-identical bars, then use `arrange` with run
   lengths. On song 3 that measured 44 → 26 distinct bars and 40% shorter
   code.
2. **Bass and keys,** which showed almost no whole-bar repeats:
   - cleaning (stray notes, split notes, octave errors);
   - matching riffs by their intervals, so transposed repeats count;
   - scale degrees;
   - Euclidean rhythm fits;
   - phrase-level repeats.

Each suggestion reports the share of original notes it keeps, the share of its
notes that match the original, and which notes it moved, dropped or added,
drawn with the same marks as the timeline.

**Done when:** each instrument type has a simplify that reports these numbers
on a fixture, and on the real session from a local path.

## 12. Hosting on AWS

- Its own CloudFormation stack in the Fire Lake Labs account, modelled on
  ODM's `infra/`: S3 + CloudFront, a `firelakelabs.com` subdomain such as
  `ghostnotes.firelakelabs.com`, deploy from `main` gated by a repo variable.
- Never modify other stacks.
- Needs the owner's approval and a fresh AWS login at the time; ODM's approval
  does not carry over.

## Later

- Splitting a stem into two instruments, or merging two (G25).
- A desktop shell (Electron), if the app should run the transcription tool
  itself (G24).

## Licence

Settled by G8: our code stays MIT, and the hosted app meets Strudel's AGPL
through public source and an in-app notice. The notice is part of step 10 (the
app shell) and must be live before step 12 publishes anything.
