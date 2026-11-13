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

Issue #14 investigated the two intermittent trigger-count failures. Cyclist
advanced past late query windows even when their notes still had future audio
deadlines. Playback now recovers those onsets on the next query, without
replaying expired or previously scheduled notes. The fast Kiln rhythm test also
selected cycles in its bass-free ending (cycle 30 was traced); its old
`ceil(swap)` boundary could include a partially scheduled cycle. It now observes a whole future cycle in a bass-playing section after
pending edits settle. Exact trigger counts and all time budgets remain strict.
The PR for #14 records the loaded repetition counts and before/after failures.

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

## 3. Prove the Strudel assumptions: done

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

### Step 3 results (2026-11-13)

- **Tempo per place: works.** Core 1.2.6 queries and web 1.3.0 scheduled
  triggers agree for two bars at factor 0.75, then one at 1.25 (1.5 and 1.25
  cycles), over two loops: 24 events, <0.000001 ms schedule error at cpm 120.
  Step 10 can use `arrange([n*f, part.slow(f)], ...)`.
- **Live `.cps()` changes: do not work cleanly for following the band
  (G36).** Queried chord onsets coincide, but browser triggers split by
  40 ms on the drift fixture and by 120 ms after three 1.56 s bars change
  to a 1.60 s bar. Cyclist applies the new cps against the old phase anchor.
  This fails the 50 ms beat-map tolerance: one scheduler window, below half
  the measured 110 ms minimum trigger lead. A single voice's 1.026 ms
  bar-clock error hides the defect. **In-app following the band remains to
  be implemented and measured through beat-map time warping in step 9:**
  query in cycles and schedule each onset at the map's audio-context time,
  keeping chords simultaneous. That mechanism is untested here. The
  one-average-tempo fallback applies only if step 9 measures that warping
  cannot meet tolerance. Constant-tempo controls preserve chords but do not
  prove alignment with stems. The copy retains editable per-section tempos,
  proven by the fractional tempo-place check above (G28).
- **Pickup: works with limit first traversal (G37).** A quarter-cycle pickup
  schedules `c3` at zero and the following four notes at cycles 0.25–1.25,
  unchanged in duration. On the second lap its first note becomes `d3`:
  fractional `arrange` retains global phase. Steps 6/9/10 must treat the pickup
  as a once-only prefix or explicitly reset it before replay.
- **Samples: works with network access.** Online checks register each of the
  seven default banks separately, decode one representative file, and check
  its scheduled events: tidal-drum-machines, piano, Dirt-Samples, EmuSP12,
  vcsl, mridangam and full Dirt. This does not validate every file in a bank.
  General MIDI needs `@strudel/soundfonts` 1.3.0 (G38): no peer dependencies,
  exact core 1.2.6 / webaudio 1.3.0 dependencies. The seam bridges its registry
  and context into the web bundle and preloads pitches. Offline CI checks two
  synthetic pitch zones before scheduling; `online` checks real `gm_piano`.
  Other presets/variants remain unverified. The remaining in-app time-warping
  implementation and proof belong to step 9.

Proof: `src/strudel/assumptions*.test.ts`, `tests/browser/assumptions.spec.ts`
(serial audio project) and `npm run test:browser:online` (network only).
Local whole-session check: set `GHOST_BEATS_ROOT` to the first test session's
output root and run `npm test -- src/strudel/assumptions-local.test.ts --silent=false`.
It queries all complete four-beat bars: 132/292/320/328 events from
136/295/324/331 beats, with ideal-bar maximum errors 730/530/35/260 ms in
song order, starting at each first downbeat (beat offsets 0/0/1/1).
No notes or audio are imported; incomplete final bars are excluded.
Absent local material skips; CI uses the synthetic map. No speaker timing or
perceived output was measured.

## 4. Move the transcription tool: done

Copied from ODM `26c3689`; the [tool README](../tools/audio-to-midi/README.md)
defines the version 1 song-folder contract (G40–G42). Standard-library Python
tests run in a separate two-minute CI job without models. Cache keys include
source bytes, settings, models, bounds, dependencies and code; beat coverage and
tempo doubt are explicit. Audio cuts publish only on success.

Measured locally on CPU, 2026-11-13: the first test session and two diversity
inputs, six songs total. Six stem WAVs and six stem MIDIs per song, plus combined
MIDI, notes and beats. Durations and detected-map endpoints in seconds:

| Input                      | Duration | Beats | Map stops | Tempo review                |
| -------------------------- | -------: | ----: | --------: | --------------------------- |
| First test session, song 1 |  123.979 |   136 |   112.700 | possible half, 69.77 BPM    |
| First test session, song 2 |  166.000 |   295 |   150.500 | no range flag, 120.00 BPM   |
| First test session, song 3 |  142.000 |   324 |   123.600 | no range flag, 157.89 BPM   |
| First test session, song 4 |  140.524 |   331 |   128.220 | possible double, 214.29 BPM |
| Diversity input 1, song 1  |  310.747 |   487 |   310.120 | no range flag, 93.75 BPM    |
| Diversity input 2, song 1  |  160.670 |   253 |   160.320 | possible half, 78.95 BPM    |

These are detected beats, not a judgement of musical accuracy. Every map has
uncovered edges recorded in `beats.json`; no notes or audio enter git (G4).
The app importer is step 5; opening these folders in the app is not yet measured.

What was planned:

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

## 5. Reference import (TypeScript): done

Done 2026-11-13. Version 1 song/source folders open through a picker, retained
handle or dropped folder. JSON notes, secondary MIDI, exact timing queries,
coverage/tempo warnings, stem levels, retained PCM and waveform peaks are in
`src/reference/`; the open control is in the app. Types and uncertainty are
described in [reference](reference.md).

Measured: all six local songs, 36 decoded stems, zero import failures; per-song
bars, tempo ranges, gaps, decode/peak times and memory are in the
[measurement report](reference-measurements.md). `npm run check`: 516 Node tests
passed, one skipped. `npm run test:browser`: 67 passed, one skipped, 107.108 s /
180 s, including picker, persisted handles, permission grant/denial, native drop,
fallback folder input and generated audio. The real-input checks skip when
absent. Actual system permission UI and Firefox/Safari remain unverified.

What was planned:

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
  - Keep each bar's tempo for the copy and its beat positions for playback
    time warping (G28, G36).
  - Mark uneven stretches and where the map stops.
- **Stems:** one instrument per stem (G25). Keep stem names, and the stem
  levels used to flag possible bleed.
- Tests use synthetic fixtures written for the project, including a short
  generated audio file.

**Done when:** a fixture with a pickup, a tempo change and a gap in the beat
map imports with exact beat positions and the right bar tempos, and a fixture
folder opens through both the folder picker path and the drop path.

### Consistent bar grid (#19)

Steps 6–11 consume the derived 1× grid by default (G53–G56), with detected
bars retained. Tempo choices derive alternative grids through the same pure
function. Every added/removed bar line or beat records its reason and source
interval. True gaps stay uncertain; the map never extends past detection.
The step 5 summary reports grid changes. [Measurements](grid-measurements.md)
cover all six local songs, including unresolved bars and limits.

## 6. Literal converter (TypeScript): done

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

### Step 6 measurements (2026-11-13, detected grids)

All six local version 1 songs, every stem (36 total), queried through the pinned
Strudel Node seam. 14,047/14,047 source notes appear once; missing and duplicated
are both zero. Values are absolute onset errors: median / p95 / maximum.
Code size is the sum of six standalone instrument programs, in bytes.

| Input                      | Notes / once | Missing | Duplicated | Error (ms)            | Error (beats)                  | Code (B) |
| -------------------------- | -----------: | ------: | ---------: | --------------------- | ------------------------------ | -------: |
| First test session, song 1 |  1433 / 1433 |       0 |          0 | 0.291 / 0.792 / 0.977 | 0.000355 / 0.000916 / 0.000972 |   98,639 |
| First test session, song 2 |  2203 / 2203 |       0 |          0 | 0.273 / 0.469 / 0.947 | 0.000547 / 0.000937 / 0.000975 |  152,080 |
| First test session, song 3 |  1805 / 1805 |       0 |          0 | 0.174 / 0.352 / 0.406 | 0.000452 / 0.000925 / 0.000975 |  126,996 |
| First test session, song 4 |  3282 / 3282 |       0 |          0 | 0.164 / 0.469 / 0.527 | 0.000470 / 0.000901 / 0.000975 |  220,532 |
| diversity-1                |  3947 / 3947 |       0 |          0 | 0.250 / 0.600 / 0.880 | 0.000391 / 0.000937 / 0.000977 |  263,989 |
| diversity-2                |  1377 / 1377 |       0 |          0 | 0.306 / 0.700 / 0.756 | 0.000514 / 0.000925 / 0.000972 |   97,637 |

Maximum duration residual was below 0.000001 ms; gain was matched for every
note. MIDI pitch/gain multiplicity also matched exactly on every stem. Timing
precision above is against notes JSON (G46); MIDI tick/tempo serialization differs.
265 notes outside detected coverage were retained in marked edge sections
(G58). No real notes, source names or generated programs are stored.
[Converter API and reproduction](convert.md). Synthetic fixtures prove pickup,
tempo changes, boundaries, overlap, chords, drums, gain and ODM round trips.
Playback time warping, exported tempo fidelity and perceived output were not
measured in the detected-grid run.

### Step 6 final measurements (2026-11-13, chosen consistent grids)

Rebased onto #20 (`352b1a3`) and repeated the same all-stem proof with the
reader's default `song.bars` and `song.beatMap`. Converter production code and
synthetic fixtures were unchanged. All 14,047 source notes and all MIDI
pitch/gain multiplicities still appear once, with zero missing or duplicated.
Values below are median / p95 / maximum absolute onset errors against notes JSON.

| Input                      | Notes / once | Missing | Duplicated | Error (ms)            | Error (beats)                  | Code (B) |
| -------------------------- | -----------: | ------: | ---------: | --------------------- | ------------------------------ | -------: |
| First test session, song 1 |  1433 / 1433 |       0 |          0 | 0.277 / 0.792 / 0.977 | 0.000322 / 0.000916 / 0.000973 |   97,939 |
| First test session, song 2 |  2203 / 2203 |       0 |          0 | 0.273 / 0.469 / 0.947 | 0.000547 / 0.000937 / 0.000975 |  152,090 |
| First test session, song 3 |  1805 / 1805 |       0 |          0 | 0.174 / 0.352 / 0.406 | 0.000452 / 0.000925 / 0.000975 |  126,896 |
| First test session, song 4 |  3282 / 3282 |       0 |          0 | 0.227 / 0.472 / 0.527 | 0.000498 / 0.000907 / 0.000975 |  219,098 |
| diversity-1                |  3947 / 3947 |       0 |          0 | 0.255 / 0.600 / 0.925 | 0.000402 / 0.000937 / 0.000975 |  269,880 |
| diversity-2                |  1377 / 1377 |       0 |          0 | 0.391 / 0.703 / 0.761 | 0.000514 / 0.000925 / 0.000976 |   95,053 |

All durations remain within 0.000001 ms of the source durations; every gain
matched. The same 265 uncovered-edge notes survive. MIDI serialization has
separate timing residuals (largest measured onset residual 2.871 ms); the
sub-millisecond claim is against notes JSON, not MIDI tick times. Grid uncertainty
stays visible, including song 4's ten holes; no missing beats were guessed by
the converter. Playback scheduling, speaker timing and perceived output remain
unmeasured here (step 9). Decisions G57–G59; API and reproduction: [convert](convert.md).

### Chosen musical grid (#23, 2026-11-13)

The full [eight-option table](convert-grid-measurements.md) includes every song,
36 stems and 14,047 notes per option. Default grid: four steps per beat.
M/B/S/G count moved, sustain-end bar crossings, shortened notes and merge groups;
records overlap. “Merged” counts extra contributors, beyond emitted events.
Errors are median / p95 / maximum against notes JSON.

| Input                      | Once + merged | M / B / S / G           | Moved % | Error ms                   | Error beats                    |  Code B |
| -------------------------- | ------------: | ----------------------- | ------: | -------------------------- | ------------------------------ | ------: |
| first test session, song 1 |     1357 + 76 | 1384 / 77 / 235 / 67    |   96.58 | 38.300 / 185.000 / 495.000 | 0.044643 / 0.133429 / 0.249884 |  91,002 |
| first test session, song 2 |     2184 + 19 | 2114 / 151 / 884 / 19   |   95.96 | 20.000 / 64.400 / 182.500  | 0.040000 / 0.123846 / 0.249000 | 148,325 |
| first test session, song 3 |      1804 + 1 | 1677 / 159 / 1439 / 1   |   92.91 | 20.000 / 80.000 / 98.700   | 0.052632 / 0.200000 / 0.249737 | 111,626 |
| first test session, song 4 |     3257 + 25 | 3209 / 201 / 1802 / 25  |   97.78 | 20.000 / 64.700 / 129.400  | 0.040385 / 0.124444 / 0.248846 | 169,298 |
| diversity-1                |    3821 + 126 | 3919 / 533 / 2028 / 126 |   99.29 | 22.700 / 140.000 / 230.400 | 0.035156 / 0.218750 / 0.249844 | 246,085 |
| diversity-2                |     1344 + 33 | 1279 / 78 / 195 / 33    |   92.88 | 20.000 / 95.600 / 184.600  | 0.027027 / 0.124079 / 0.249324 |  99,070 |

All options passed emitted-once plus recorded-merge accounting, with zero missing
or duplicated events, before and after ODM import/generation. Exact retains
1 ms / 1/1024-beat onset tolerance and seconds durations. Grid settings deliberately
trade timing detail for an editable rhythm; clamping the last step can approach
one step of error. Uncovered edges stay exact. G67–G69 extend G57/G59; API details
and reproduction are in [convert](convert.md). The setting is an argument for the
session UI to own; no control or section creation is implemented here. Playback
alignment, musical correctness and perceived output remain unmeasured.

## 7. Timeline and the lens

**Part 1: done.** The recording timeline has optional audio above MIDI per stem,
whole-song ruler, pickup/gap/uncovered/inference marks, zoom and overview
navigation. Proof on six local songs (including diversity-1: 181 detected / 243 derived bars, 3,947
notes, 627.3 MiB PCM) is recorded in [timeline measurements](timeline-measurements.md).
The [structure and viewport API](timeline.md) are the handoff to parts 2/3;
[synthetic screenshots](../design-study/sketches/timeline-part1.png) match Main's
row sizes. G61–G65 record choices made for the owner. #5 stays open.

Step 6 (#21) and the consistent grid (#20, closing #19) have landed.
Part 2 can now add the lens, selection and doubtful-tempo integration.
Part 3: Notes/Mine rows, six difference marks, unarranged bars, match strip,
and rows-or-layers. Their original requirements follow.

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
- The user's parts follow the beat map through time warping in our own
  scheduler: query patterns in cycles and schedule each event at the beat
  map's audio-context time for its cycle position. Chords stay simultaneous;
  stem audio plays as recorded (G20, G28, G36). Do not use live `.cps()` changes.
- Synths and samples per instrument (G19).

**Done when:** every scheduled event, including simultaneous chords, stays
within a stated tolerance of the beat map across a whole synthetic song,
with a local real-material check and timing errors reported (G36). Only if
measured time warping cannot meet that bound does G28's one editable
song-average fallback apply; disclose the resulting stem misalignment.
Nobody judges by ear.

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
