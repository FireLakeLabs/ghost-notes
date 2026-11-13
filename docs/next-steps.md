# Next steps

In order. Each step says what it needs, what it produces, and how we know it is
done. Sizes are estimates from reading ODM's code on 2026-11-12, not
measurements.

## 1. Design study (with the owner)

Lives in [`design-study/`](../design-study/README.md). Run with the owner
present; mockups first, using the first test session's real data from a local
path (G4).

**Prepare before the session** (can be delegated once asked):

- Static mockups built from song 3's real notes, since it has the steadiest beat
  grid. Show bass and drums in three rows over 16 bars. Include one selected
  range and one reused section.
- The same 16 bars as the literal conversion draws them, with its differences
  from the MIDI marked: moved notes, shortened notes, merged chords.
- One sketch of a "simplify" result for drums, from
  [finding-structure](../research/finding-structure.md).

**Questions to settle.** Each one becomes a G-decision:

1. **Timeline and sheet.** The whole-song timeline and ODM's score sheet, which
   shows one section at a time (ODM D18, D34). Do they stack? Is the timeline
   a mode? Does the sheet get faint reference marks inside the current section?
2. **Rows per instrument.**
   - Three stacked rows, or one row with layers?
   - Pitch drawn as piano roll or contour?
   - Drums as one row or one lane per kind of hit?
   - How differences are marked.
3. **Selecting a range.** Whole band or per instrument? Snap to bars or beats?
   What happens at a pickup bar?
4. **What a new section starts with.** Empty, a literal copy, or a
   simplified suggestion, and which is the default.
5. **Reuse.** One section standing for several ranges: how it is made, and
   how the Mine row draws it.
6. **Instruments and stems.** Does each stem become one instrument? Can a
   user's instrument follow a stem? Is the drum kit one instrument or one per
   kind of hit?
7. **Bar lines and tempo.**
   - Whose bar lines: the detected downbeats, or 4/4 from the first note?
   - A control to halve or double a wrongly detected tempo.
   - Which single tempo the arrangement plays at: the median beat gap, or the
     song's average.
8. **Simplify.**
   - Which limits the user sets: how far notes may move, what share of weak
     notes may be dropped, whether pitches may change.
   - How dropped and added notes are shown.
   - What ships first. The evidence says drums.
9. **ODM's live views.** Keep, drop or postpone the Now constellation and the
   Watch spiral.
10. **Copy out.** One button or a panel? Warn before leaving with uncopied
    work?
11. **Sounds.** Built-in synths per stem (what the conversion used), or add
    General MIDI soundfonts (not pinned in ODM)?

**Done when:** sketches are in `design-study/sketches/`, outcomes are in
`design-study/outcomes.md`, the decisions are G9 onward in
[decisions](decisions.md), and steps 2–10 below are revised to match.

## 2. Bring in ODM's code

GitHub does not allow forking a repository into the organisation that already
owns it, so this is a **file copy** of ODM `main` at a recorded commit.

- **Copy:**
  - `src/` modules: `strudel`, `engine`, `document`, `import`, `generate`,
    `editor`, `sheet`, `app`, `contract.ts`. Add `live` and `spiral` per
    question 9.
  - The tests for those modules.
  - `scripts/` (Node tests, browser suite, docs and boundary checks).
  - Configs: Vite, Vitest, Playwright, TypeScript, ESLint, Prettier.
  - `package.json` and `package-lock.json`.
  - The relevant entries from ODM's `docs/lessons.md` and `docs/standards.md`.
- **Leave out:** `spikes/`, `metrics/`, `infra/` (until step 10), and ODM's
  `corpus/`, unless a copied test needs part of it. Check its licence notes
  first.
- **Keep the `@odm-` metadata tag names** so copied text also pastes into ODM
  (G3).
- **Done when:** `npm run check` and `npm run test:browser` pass on the
  unchanged copy, before any Ghost Notes change, and the ODM commit is
  recorded in the README.

## 3. Move the transcription tool

Move `tools/audio-to-midi` from ODM to here. That is one PR in each repo. Fix
what the first run showed:

- The beat map must cover the whole piece, or say where it stops.
- The cache key must include the settings and model, so stale results aren't
  reused.
- Flag a likely half or double tempo instead of choosing silently.
- Write output under `reference/`, which is git-ignored.

The drum model's weights are non-commercial share-alike (see the tool's
README). Personal use is fine; anything shipped needs permission or another
model.

## 4. Reference import (TypeScript)

Read `notes.json` + `beats.json` first, since they carry more than the MIDI,
and MIDI second (`@tonejs/midi` or `midi-file`).

- Map seconds to beats with the beat map, piecewise between detected beats.
- Keep pickups and stem names, and the stem levels used to flag possible
  bleed.
- Tests use synthetic fixtures written for the project.

**Done when:** a fixture with a pickup, a tempo change and a gap in the beat
map imports with exact beat positions.

## 5. Literal converter (TypeScript)

Our own converter, informed by
[the literal conversion study](../research/midi-to-strudel-literal.md). Do not
reuse the GPL converter's code. Fix its known faults:

- Respect time signatures and pickups.
- No moving notes from the last 5% of a bar onto the next downbeat.
- No duplicated notes at bar boundaries.
- Keep durations and velocity (as `gain`).
- Give every stem the same bar count so they loop together.
- Map drums to `bd sd hh cr lt`.

**Done when:** every MIDI note appears exactly once, which the first study
already measured as possible (9,008 of 9,008), with the timing error reported.

## 6. Timeline and reference rows

The whole-song view from question 1: three rows per instrument, zoom, bar
lines, unarranged bars marked, range selection. Expect about 400 lines, like
ODM's spiral view.

**Done when:** a real four-song session from a local path draws, and the
browser suite stays under its time budget.

## 7. Make section from range, and links

- One new document edit, "make section from range".
- Sections gain an optional source (file and bar ranges) and instruments an
  optional stem. Both are written to and read from the metadata comments.
- Decide what duplicating, splitting and moving a section does to its source.

**Done when:** making a section, copying out, pasting back and reopening the
reference restores every link.

## 8. Reference marks in the sheet, and copy out

- Within the current section, draw the MIDI and converted notes faintly behind
  the user's own. Mind ODM's 200-events-per-cell drawing cap.
- Add the Copy button.
- Add the licence notice (G8): the app uses Strudel under AGPL-3.0-or-later,
  with a link to the source of the deployed commit.

## 9. Simplify

Start with drums: cluster near-identical bars, then use `arrange` with run
lengths. On song 3 that measured 44 → 26 distinct bars and 40% shorter code.
Then:

- matching riffs by their intervals, so transposed repeats count;
- scale degrees;
- Euclidean rhythm fits;
- phrase-level repeats.

Each suggestion reports the share of original notes it keeps, the share of
its notes that match the original, and which notes it moved, dropped or
added. Bass showed almost no whole-bar repeats, so it needs the interval and
cleaning steps first.

## 10. Hosting on AWS

- Its own CloudFormation stack in the Fire Lake Labs account, modelled on
  ODM's `infra/`: S3 + CloudFront, a `firelakelabs.com` subdomain such as
  `ghostnotes.firelakelabs.com`, deploy from `main` gated by a repo variable.
- Never modify other stacks.
- Needs the owner's approval and a fresh AWS login at the time; ODM's approval
  does not carry over.

## Licence

Settled by G8: our code stays MIT, and the hosted app meets Strudel's AGPL
through public source and an in-app notice. The notice is part of step 8 (the
app shell) and must be live before step 10 publishes anything.
