# Literal conversion

`convertInstrument` in `src/convert/index.ts` takes `{ song, bars?, stemId,
range?, includeUncovered? }`. `bars` defaults to `song.bars`; its beat coordinates
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
- `notes`: source indices (in the stem's notes array), original notes, owning
  span indices, grid steps, written cycle endpoints and written seconds.
- `resolutions`: subdivisions per selected span, chosen per instrument.
- `changes`: `kind`, `noteIndices`, `original` and `written` endpoint arrays,
  in seconds. A moved onset shifts its end by the same seconds to preserve
  duration. `moved-across-bar-line` additionally marks a sustain end crossing
  a numbered bar boundary. An end exactly on the boundary belongs to the
  preceding bar. Onsets never cross. `shortened` and `merged` are
  reserved kinds; this converter does neither. Identical notes remain distinct.

Subdivision starts at 16 and doubles until every onset is within both 1 ms and
1/1024 beat. A rounded onset is clamped below its owning bar's end. The
1,048,576-subdivision ceiling fails explicitly rather than dropping notes.
`timingError(song, result.notes)` returns nearest-rank median, 95th percentile,
and maximum absolute onset error in milliseconds and beats. Outside coverage,
beat fractions use the nearest observed beat interval only as an error unit.

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
identical-note multiplicity. It compares queried onsets and effective ends
(`whole` duration × `clip`) to source seconds, not just the converter's records.
Onset/duration precision refers to `ReferenceStem.notes` (notes JSON first, G46).
The private proof also matches pitch/gain multiplicity against every stem's MIDI;
MIDI's tick/tempo serialization can differ from notes JSON by milliseconds.
Reports contain only anonymous labels, counts, error distributions and byte
sizes; no names, paths, notes, audio or generated conversions enter git.
Measured results are in [next steps](next-steps.md). No browser scheduling,
export tempo fidelity, speaker timing or perceived output is established here.
