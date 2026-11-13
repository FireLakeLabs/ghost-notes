# Simplify logic

Part 1 of #9 is pure TypeScript in `src/simplify/`. Timeline controls remain
part 2, after step 7 part 3. Suggestions are proposals, never applied edits.

`simplifyDrums({song, conversion, settings?, match?})` consumes the public
`ConvertedInstrument` from `src/convert/`. Pass the conversion of the chosen
grid and range; simplify does not choose or modify that grid. The converter
default is 4 steps per beat. It emits only `mergedInto === null` records, reads
the written `velocity`, and retains every merge contributor in change records. It preserves
pickups, partial bars, gaps and uncovered edges as individual spans. Reset
before replaying fractional arrangements (G37).

Drum bars use greedy nearest-representative Jaccard clustering on onset/pitch
sets, then deterministic `arrange` with adjacent run lengths and reusable
patterns. Silence matches silence. Source multiplicity and gain
remain in the output; matched template durations may change within the endpoint limit; Jaccard alone does not authorize removing duplicates.
Templates must also satisfy endpoint movement and global dropped/added budgets.
Fill protection requires the same number of events and no inserted/deleted hits.
The drum kit stays one `@odm-shared` instrument with five sample lanes (G26).

Each result supplies a self-contained `expression`, standalone `source`,
written `notes`, `changes`, resolved settings and `report`. `shorter` compares
UTF-8 standalone bytes including definitions and metadata. A candidate that
expands is reported honestly; callers should only offer it as a shorter rewrite
when `shorter` is true. No generated private code is saved by the measurements.

`report.keptShare` is matched / counted original notes; `matchShare` is matched /
counted suggested notes (the full output remains in `notes`). Matches use maximum-cardinality, one-to-one onset comparison
in recorded seconds and exact MIDI pitch or pitch class (any octave). Velocity
and duration are not match criteria. Quiet filtering excludes original quiet notes and proposals whose sources are
all quiet. Added notes still count against match share. An empty
denominator has share 1. Reports include both denominators and matched count.

Change records extend the converter shape: `kind`, source `noteIndices`,
`original` and `written` endpoint arrays in seconds, plus parallel pitch and
velocity arrays. Added notes have no source index/original; dropped notes have
no written endpoint. `merged` retains every contributing index. `moved` also
covers pitch/gain changes and extended durations; `shortened` and bar-crossing
marks may accompany it. Records compare source evidence directly with the
final proposal, including converter movement, rather than hiding grid losses.

Limits and match settings are arguments, kept only by the caller's session
(G16/G21/G23). Defaults: 50 ms extra movement at each endpoint, 10% drops,
10% additions, fill protection on, Jaccard distance 0.25; matches within 50 ms,
quiet notes included (threshold 32 when excluded), exact pitch. These are
conservative proposal limits, not a claim of recovered intent.

Proof: `npm test -- tests/simplify.test.ts` queries pinned Strudel and checks
ODM import/generation. The private proof skips without its local opt-in:

```sh
GHOST_SIMPLIFY_ROOT="$HOME/projects/ghost-notes/reference" npm test -- tests/simplify-local.test.ts --silent=false
```

[Measurements](simplify-measurements.md) distinguish the old onset-only study
from full-note proposals. No listening, perceived quality or playback timing is
established by these tests.

## Pitched proposals

`simplifyPitched(input)` returns seven independent suggestions for bass, keys
and every other pitched stem. Each is also exported as its own function:

- `cleanStrays`: remove short weak notes, stopping at the drop budget.
- `joinSplitNotes`: join same-pitch weak fragments within the gap limit in
  the same bar, provided no intervening strong attack exists. Retain all IDs.
- `correctOctaves`: correct a short weak ±12-semitone excursion between two
  equal, nonoverlapping neighbor pitches. It is a hypothesis, never ground truth.
- `intervalRiffs`: share exact rhythm/duration/gain patterns of pitch intervals,
  then transpose each occurrence in semitones. Chords stay intact.
- `scaleDegrees`: choose the duration×velocity-weighted best of 12 roots ×
  major/minor, write degrees and preserve chromatic exceptions literally.
  This is an encoding choice, not an inferred key assertion.
- `euclideanFits`: search exact pulse/step/rotation fits at 4–64 steps, grouping
  equal pitch/gain/duration, retaining exceptions. The seam supplies pinned
  Bjorklund orientation; actual queries check the emitted operator.
- `phraseRepeats`: compare exact two/four/eight-bar pattern definitions including
  overhead, choosing the shortest encoding. Incomplete/uncertain spans stay
  separate. Templates are phase-checked over their complete output range.

Cleaning thresholds are settings: weak velocity below 32, stray length at most
80 ms, split gap at most 30 ms, octave excursion at most 200 ms. Structural
proposals preserve pitch, multiplicity, gain and durations on the chosen grid.
All change records still include that grid's deviations from original seconds.
