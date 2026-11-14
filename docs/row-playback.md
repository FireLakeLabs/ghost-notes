# What Play plays

Each instrument has an independent speaker for Audio, MIDI, Notes and Mine.
Layers keeps three separate music-row speakers; audio remains its own optional
row. Recording chooses every retained stem and no synthesized rows; Mine chooses
the arrangement only; Both chooses audio plus Mine and is the initial preset.
No selected sources disables Play. Hiding audio or switching views does not mute
it: the transport explicitly says hidden selected rows still play. Source changes
stop the transport; press Play to use the new selection (G122).

MIDI uses complete original transcription times, pitches, velocity and duration.
Notes uses complete converter output on the session grid, including merges.
Mine is the actual full generated program with row tags, filtered after its
cross-row transforms and effects. Neither painted notes nor isolated programs
supply Mine playback. A program that loses its row identity reports the problem;
it cannot silently become an empty row. An unlinked Mine draft explains why it
needs a section before following reference time; choose Recording for stems.

`createRowEngine` adapts `createSongPlayback` to the existing editor's canonical
cycle clock. Native Solo filters Mine while the chosen reference monitors remain selected;
its banner says Mine solo. All synthesized sources share its onset/sustain warp; retained stem
buffers start at the same origin and recorded offset, rate 1. Playback includes
pickup/edges and stops after the first pass. The controller keeps whole-score
answers during reference playback, including its ending. Live document revisions
use `update`, retaining stem phase. Recording revisions commit silence and do not
evaluate Mine. Changing reference/grid stops and disposes the old transport;
obsolete asynchronous initialization cannot start it. Existing unlinked draft
playback retains its original engine.

Sound choices follow G123. Mine as written preserves current document settings;
MIDI/Notes default to triangle or the default drum kit. An explicit choice sets
MIDI/Notes and every current Mine definition for that stem (including independent
copies), and supplies new sections for this session. Synths and samples remain
choices per instrument; General MIDI uses pinned soundfonts 1.3.0, with pitch
preloading through the existing seam. Drum banks preserve the five sample lanes.
The change uses normal history and edited flags, so Undo and Copy retain the
music's settings. Choosing Mine as written later removes the session preference;
Undo reverses earlier document changes. Missing/offline sounds report failure.
No fallback silently substitutes another voice.

The controls follow Main; the [small sketch](../design-study/sketches/row-playback.html)
records the new source-change notice and as-written choice. A sound picker is
disabled while a native editor is open, as are the speaker/preset controls.
Speaker input stays separate from range selection and drum cell editing.

## Proof and limits

`tests/row-playback.test.ts` compares selected Mine with full-context events and
effects, checks reference times through tempo changes and 50 ms query windows,
and proves sound edits retain queried notes, links and copied settings.
`tests/app-transport.test.ts` covers recording without a draft and a song change
during asynchronous preparation, including stopping/releasing the old transport.

`tests/browser/row-speakers.spec.ts` opens an invented two-instrument folder,
makes a linked arrangement, changes its sound and observes the complete song.
Each preset checks exact note sources/counts/timestamps and native retained-buffer
start calls, forwarded without a timing stub. A mixed-source walk distinguishes
unsnapped MIDI from Notes, keeps choices through Layers, leaves the range intact,
and stops active playback when a source changes. Both also plays selected audio
when its row is hidden. Tests retain the 20 s per-case accounting.

`npm run measure:playback` is a separate optional, locked 180 s command. It opens
the first local song, makes eight bars, and observes Both over its complete
recording, checking every expected arrangement trigger and stem start. Its
170 s case is a private measurement, excluded from the ordinary suite. The report
contains only anonymous counts/errors in `/tmp/ghost-notes-playback-report.json`.
Set `GHOST_PLAYBACK_REAL_SHOT` to a local PNG to inspect a cropped drum row;
real pixels never enter git or PRs. Synthetic screenshots use `GHOST_PLAYBACK_SHOT`.

Measurements are scheduled AudioContext times, not speaker output or perception.
The separate original eight-second warp fixture still covers chords, pickup,
gap, uncovered edges, live revisions and bar seeks. Network availability, every
soundfont/kit sample and physical/audio-device latency are not established by
these controls.

## Measurements (2026-11-14)

The four-second fixture crosses 240 → 120 BPM. The latest focused command
passed all four cases in 27.880 s, with the slowest case 7.305 s / 20 s:

| Preset    | Note triggers | Native stem starts | Maximum added onset error |
| --------- | ------------: | -----------------: | ------------------------: |
| Recording |             0 |                  2 |            not applicable |
| Mine      |            24 |                  0 |              <0.000001 ms |
| Both      |            24 |                  2 |              <0.000001 ms |

Mine's minimum trigger lead was 217.300 ms; Both's was 206.667 ms. The mixed
MIDI/Notes case schedules exactly 40 events, with original MIDI at 0.28 s and
Notes at 0.25 s. The [synthetic capture](../design-study/sketches/row-playback.png)
was inspected after visiting each instrument and waiting for settled answers.

The complete **first test session, song 1**, 123.979 s, was observed with an
eight-bar, six-instrument Mine arrangement and all retained stems. Chromium
scheduled **362/362** expected triggers and **6** native stem starts, with zero
missing/unexpected events, zero chord split, zero stem-start deviation,
maximum added onset error **0.000000000558 ms**, minimum lead **183.300 ms**, and
zero runtime/playback errors. Source values also match after ignoring only
warp-owned duration/clip/cps and sorting object keys. The command took 131.254 s
including build/serving/shutdown. This is one complete pass under the suite lock,
not a claim about other devices, competing jobs or perceived output. The cropped
private drum row was inspected; only anonymous aggregates were retained here.

The first private pass produced the same 362 triggers and six aligned starts,
but its comparison rejected all event bags because their property insertion
order differed. It provided no qualified onset-error result. Sorting object keys
fixed that oracle without changing application code or reducing the observed
recording; the complete pass was then repeated.

The first complete local gate also exposed two UI-test assumptions: Play is no
longer a readiness proxy for an unlinked Mine draft, and rows pushed below the
viewport must be visited before pixel assertions. Their original assertions
remain, with appropriate load/drawing signals. One unchanged Node case timed out
at 5 s while deleting every instrument sequentially; its focused file passed in
3.17 s. That case now checks one deletion per test, sharing only immutable input
and baseline setup. Every full-song query/assertion and the default case/suite
limits remain. No cause of the shared-machine variation or speedup is claimed.

The integrated local gates passed **648 Node tests** (nine skips), 23.366 s /
60 s, and **88 browser tests** (one skip), 160.870 s / 180 s. The later focused
transport check also proves Recording ignores an invalid live document revision
without restarting stems. Desktop and 390 px synthetic views were inspected.
The mobile source group spans the transport grid, and sound pickers remain
inside the viewport without increasing the 46 px instrument heading. Its layout
checks catch the original 448 px page overflow; the corrected page stays 390 px.

Opus approved the feature in one round (nits only). The follow-up fixes keep Mine
eligible before native Solo filters its current ids, explicitly explain Mine
instruments without matching stems, reject obsolete preparation errors, and keep
a refused sound choice atomic with its visible status. The cancellation regression
fails without the guard (an old cancellation replaces the new song's message),
and passes with it. Clearing Solo during Both now reaches real Mine triggers
without restarting stems. The per-deletion test split is retained because this
wave's complete local gate exposed its bundled 5 s case limit; no assertion,
query interval or limit was removed.

After the review fixes, the final complete gates passed **649 Node tests** (nine
skips), 14.276 s / 60 s, and **88 browser tests** (one skip), **166.478 s / 180 s**.
The extended mixed/Solo case took 10.553 s / 20 s. No test or suite limit changed.
