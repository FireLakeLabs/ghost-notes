# Literal conversion

`convertInstrument` in `src/convert/index.ts` takes `{ song, bars?, stemId,
range?, includeUncovered?, grid? }`. `bars` defaults to `song.bars`; its beat coordinates
must agree with `song.beatMap`. A range is `{ fromBar, toBar }`, half-open by
bar number. Source onsets own their bar before quantization. A sustain starting
before the range is excluded; one starting inside keeps its full duration.
No range means the whole song, including explicitly uncovered edges by default.
`includeUncovered: false` excludes those edges. An empty selection is silence. A missing/empty bar grid fails explicitly; this
API requires a numbered grid and its query map.

The result supplies:

- `expression`: a plain Strudel pattern for a section or instrument definition.
- `source`: that expression in a standalone program, with an `@odm-shared`
  instrument boundary. ODM retains a drum kit as one instrument after import
  and generation. No section, link, or copy-panel implementation is included.
- `spans`: selected bars, the fractional pickup, and any uncovered edge sections,
  rebased to cycle zero. Every stem has the same spans, including silent ones.
- `grid`: the full song mapping, rebased to the selection start. Use
  `secondsToCycle`/`cycleToSeconds` with this mapping for sustained tails beyond
  a selected range. No inferred beat is added to the reference song.
- `notes`: one record per selected source index, retaining original notes, owning
  span, step, cycle endpoints and written seconds. `velocity` is the written
  velocity; `mergedInto` is null for emitted events, otherwise the representative
  source index. Filter on null to draw or schedule the Notes row once.
- `resolutions`: subdivisions per selected span; `quantization`: the requested
  setting. The existing `grid` result remains the full seconds/cycle mapping.
- `changes`: `kind`, `noteIndices`, `original` and `written` endpoint arrays in
  seconds. `moved` marks changed onsets; `shortened` marks a shorter final duration.
  `moved-across-bar-line` additionally marks any written sustain end crossing a numbered
  boundary. An end exactly on the boundary belongs to the preceding bar.
  `merged` lists every contributing index and original endpoint pair, with one
  final written pair. Kinds may overlap; these are change records, not disjoint
  note counts. Floating differences below 1e-10 seconds are numerical noise.

## Session grid (G67–G69)

`ConversionGrid` offers 1, 2, 3, 4, 6, 8 and 16 steps per beat, plus `'exact'`.
The default is **4 (sixteenths)**. The pure converter takes the setting on each
call and stores nothing; the composing UI owns session state (G23). Changing
this reference setting recomputes Notes, not an existing user arrangement (G13).
No setting control or section creation is implemented in this module.

On covered bars and pickup, round to the nearest step, ties later, clamped
between zero and the final step inside the original owning span. Thus no onset
crosses a bar line, including the last 5% (G57). Count steps from the span's
observed beat count, including partial bars; do not fill missing beats.

First shift the end by the onset's movement in seconds. Floor that shifted end
on the grid of the bar containing it, retaining the result only if it remains
strictly after the onset. Sub-step/zero durations and uncovered ends keep their
shifted seconds; notes never become longer solely to fit a grid. Tails may
still cross bars and the selection end. Same pitch + span + step merges into
one event: lowest source index represents it, highest velocity and longest
snapped tail win. Different pitches remain simultaneous events. Every input is
emitted once or explicitly mapped to this merge; originals remain untouched.

Grid output packs distinct steps into ordinary editable sequences, with extra
voices for simultaneous pitches and aligned gain/legato values. Five sample
lanes remain one drum instrument. ODM rhythm and values edits are queried in
CI, beyond simply importing and regenerating the text.

`'exact'` retains G57/G59's previous algorithm: start at 16 subdivisions and
double until every onset is within both 1 ms and 1/1024 beat, clamp below the
owning span's end, preserve seconds duration and separate identical notes.
The 1,048,576-subdivision ceiling fails explicitly. Uncovered edges always use
this exact behavior (G58), even with a musical setting: they have no observed
musical grid. `timingError(song, result.notes)` measures all original notes,
including merge contributors: nearest-rank median / p95 / maximum absolute
onset errors in milliseconds and beats. Outside coverage, nearest observed beat
intervals supply error units only.

Each numbered bar occupies one cycle, including the short final partial bar,
regardless of its observed length or beats per bar. The pickup occupies its beat count / nominal beats per bar.
Uncovered edge sections use the adjacent bar's seconds per observed beat ×
nominal beats per bar to supply a reversible seconds/cycle mapping; they are not numbered musical bars. A zero-duration note
at the final endpoint gets 1 ms of section space so its onset is included.
Fractional arrangements are first-pass only: reset before replay (G37).
Step 9 must warp event times through the grid to follow recorded seconds;
pasting the text at constant tempo does not reproduce recorded tempo drift.

Pitched notes use a replaceable `triangle` preset. Drums are a single `stack`
with five lines: tool classes 35/38/42/47/49 become `bd/sd/hh/lt/cr`.
Other drum pitches fail explicitly. Velocity is `gain(velocity/127)`;
`legato` preserves the cycle duration, including overlaps and bar-crossing tails.
No source note IDs are embedded in the text.

## Proof

`npm test -- tests/convert.test.ts` queries real pinned Strudel through the Node
seam, and imports/generates the text through ODM. Invented fixtures cover pickup,
variable tempo, gaps, uncovered edges, near-boundary onsets, duplicates, chords,
overlap, duration, gain, silence, drum lanes, and bar-range selection.

Run the private corpus separately (it skips without the opt-in/local folder):

```sh
GHOST_CONVERT_ROOT="$HOME/projects/ghost-notes/reference" npm test -- tests/convert-local.test.ts --silent=false
```

The test matches pitch/gain multisets ordered by onset and duration, retaining
identical-note multiplicity in exact mode. Grid proof checks emitted pitch/gain
multisets against written endpoints before and after ODM generation, plus every
source identity and merge representative. Synthetic tests independently fix the
expected rounding, duration and collision outcomes. It compares queried onsets and effective ends
(`whole` duration × `clip`) to source seconds, not just the converter's records.
Onset/duration precision refers to `ReferenceStem.notes` (notes JSON first, G46).
The private proof also matches pitch/gain multiplicity against every stem's MIDI;
MIDI's tick/tempo serialization can differ from notes JSON by milliseconds.
Reports contain only anonymous labels, counts, error distributions and byte
sizes; no names, paths, notes, audio or generated conversions enter git.
Measured results for every grid and song are in
[the grid report](convert-grid-measurements.md) and [next steps](next-steps.md).
Reproduce each grid separately, within the Node wall budget:

```sh
GHOST_CONVERT_ROOT="$HOME/projects/ghost-notes/reference" GHOST_CONVERT_GRID=4 npm test -- tests/convert-grid-local.test.ts --silent=false
```

Repeat with 1, 2, 3, 6, 8, 16 and exact. For a bounded all-grid run,
add `GHOST_CONVERT_SONG=N` and run each option for N=1 through 6; numbering
follows the anonymous order in the report. The local check skips without both
variables and the local folder; CI uses invented fixtures only. No browser scheduling,
export tempo fidelity, speaker timing or perceived output is established here.

## Grid measurements (#23)

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
