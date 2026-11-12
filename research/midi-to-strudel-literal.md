# Literal MIDI-to-Strudel conversion

> Provenance: run 2026-11-12 by an agent working from the ODM repository, on
> the first test session (four songs, one live recording, local only, G4).
> Measured figures only; nobody listened to the output.

## What was done

- **Converter:**
  [MIDI-To-Strudel](https://github.com/Emanuel-de-Jong/MIDI-To-Strudel) by
  Emanuel de Jong, commit `57919509104bf5ce2d47463d939302177883a453`,
  GPL-3.0. Its code is not copied here and must not be. It needs only `mido`
  (1.3.3).
- **Input:** each song's combined multitrack MIDI, one track per stem, with a
  tempo map built from the detected beats at 480 ticks per beat.
- **Grid:** `--notes-per-bar 64` (1/16 of a beat), chosen by measurement:
  - 16 wrote duplicate notes (9,020 events from 9,008 MIDI notes). A note moved
    onto the next downbeat also landed in the earlier bar's last step, because
    of a rounding error at the bar boundary.
  - 48 had one timing outlier of 3.9 beats.
  - 64 gave an exact count and the smallest timing error.
- **Post-processing** (`scripts/literal-postprocess.py`):
  - one tempo per song (`setcpm(bpm_median/4)`); the converter has no tempo
    option;
  - a comment naming each block's stem;
  - drums as `s(...)` with General MIDI 35→`bd`, 38→`sd`, 42→`hh`, 47→`lt`,
    49→`cr` (the only five drum notes present);
  - pitched stems on built-in synths: bass `triangle`, guitar `sawtooth`,
    vocals `square`, other `sine`, piano `triangle`.

## Results

| Song | Size | Lines | Loads in Strudel 1.2.6 | Onsets, cycles 0–4 |
| --- | ---: | ---: | --- | ---: |
| 1 | 24,611 B | 119 | yes | 158 |
| 2 | 51,642 B | 269 | yes | 25 (drums start near bar 4) |
| 3 | 47,958 B | 235 | yes | 92 |
| 4 | 53,191 B | 235 | yes | 134 |

The whole-song comparison queried every track to its end and matched it note by
note against the MIDI (`scripts/strudel-dump.mjs`, `scripts/literal-compare.py`):

- 9,008 of 9,008 notes appear exactly once, and none are unmatched.
- Drum hit counts match the transcription's counts exactly.
- Timing error averages 0.019 beats; the largest is 0.198 beats.

## What the literal conversion loses

These faults are the specification for our own converter
(next steps, step 5):

- **Tempo changes.** The tempo maps held 93, 137, 219 and 154 tempo events,
  and the output keeps one. Positions stay right in beats, but clock time
  drifts. The longest track, played at the median tempo against the MIDI's own
  length:

  | Song | Played at median tempo | MIDI length |
  | --- | ---: | ---: |
  | 1 | 141.0 s | 123.0 s |
  | 2 | 164.0 s | 164.9 s |
  | 3 | 138.3 s | 140.4 s |
  | 4 | 99.7 s | 139.6 s |

  Song 4's median (214.29 BPM) is far from the MIDI's average (352.8 beats in
  139.56 s, about 151.7 BPM). The beat tracker probably settled on the wrong
  multiple.
- **Pickup bars.** The converter assumes 4/4 from tick 0 and ignores
  time-signature events. Songs 1 and 3 open with a 2/4 and a 1/4 bar, so every
  bar line in those files is 2 beats or 1 beat early.
- **Durations.** Only note starts survive. Most notes last one grid step
  (median 0.0625 beat), against MIDI medians of 0.12–0.47 beats. In a sparse
  bar the converter shrinks the grid, so a lone note lasts the whole bar.
- **Overlaps and chords.**
  - Sustained overlaps become plain onsets: 624 in one song's "other" stem.
  - Notes on the same step become chords, including 10 identical-note
    duplicates such as `[hh,hh]`.
  - The one-note-at-a-time stems gained stacked onsets: 13 in song 1's bass,
    10 in its vocals, 2 in song 2's bass and 2 in its vocals.
- **Moved notes.** Notes in the last 5% of a bar are moved onto the next
  downbeat: 621 of 9,008. This causes the 0.198-beat maximum error.
- **Velocity.** Dropped entirely; the MIDI has 47–74 distinct velocities per
  track.
- **Instruments.** Program changes are ignored unless `-g` is passed, so every
  track came out as `piano`. Post-processing replaced them.
- **Uneven lengths.** Each track's `<…>` has its own bar count (34, 39, 41, 39
  and 38 in song 1), so once the shortest loops the tracks stop lining up.

## Checking Strudel in Node

`@strudel/core` imports a browser-only export from `@kabelsalat/web`. The check
scripts stand in an empty `SalatRepl` class, as ODM's
`src/strudel/evaluate-node.ts` does. Without it the transpiler import fails.
This check confirms the code is valid Strudel and lists the notes it plays; it
says nothing about sound.

## Rerun

1. Clone the converter into its own scratch folder, at the commit above.
2. Make a venv with `mido`.
3. Run `scripts/literal-run.sh <session dir> <node_modules>` with `B` set to
   the scratch folder, laid out as that script's header describes.

Output goes next to the input, under `strudel/`, outside the repository.
