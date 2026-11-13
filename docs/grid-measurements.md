# Consistent grid measurements — 2026-11-13

Measured on all six local version 1 folders, Node 24.22.2. Deterministic
counts, not a performance comparison. No source manifests, music, note data or
titles are printed. The tool metadata reassembly reads existing beat arrays;
no separation, beat-model inference or transcription ran again.

The target is `localBarLengths`: initial five meter-matching bars, then a
trailing seven-bar median after near-octave folding. The same original-time
estimate is used for both sides, matched at each bar's midpoint. This measures
consistency with a heuristic, not correct musical meter or tempo. Complete
positive-length bars only; pickups, short terminal segments and final partial
markers are excluded. Counts are therefore different from step 5's summary,
which included its final zero-length partial marker. BPM is the bar's beat
coordinate span × 60 / elapsed seconds, including uncertain gap bars.

| Input                      | Complete bars before → after |       Within ±10% before → after | Bar BPM before → after        | Merge / split / fill / thin | Tool gaps before → after | Level runs |
| -------------------------- | ---------------------------: | -------------------------------: | ----------------------------- | --------------------------: | -----------------------: | ---------: |
| first test session, song 1 |                      44 → 33 |    24/44 (54.5%) → 31/33 (93.9%) | 28.57–150.00 → 40.54–127.66   |              10 / 0 / 3 / 6 |                    3 → 3 |          6 |
| first test session, song 2 |                      75 → 74 |    71/75 (94.7%) → 71/74 (95.9%) | 70.31–122.45 → 70.31–157.89   |               0 / 0 / 6 / 4 |                    1 → 1 |          0 |
| first test session, song 3 |                      82 → 80 |     79/82 (96.3%) → 80/80 (100%) | 150.00–162.16 → 151.90–162.16 |               1 / 0 / 0 / 0 |                    0 → 0 |          0 |
| first test session, song 4 |                      72 → 61 |     50/72 (69.4%) → 61/61 (100%) | 112.15–235.29 → 112.15–205.88 |             11 / 0 / 0 / 59 |                 160 → 10 |         21 |
| diversity-1                |                    180 → 242 | 88/180 (48.9%) → 234/242 (96.7%) | 83.92–140.62 → 62.50–187.50   |              9 / 71 / 5 / 8 |                    0 → 0 |          2 |
| diversity-2                |                      67 → 49 |      35/67 (52.2%) → 48/49 (98%) | 77.92–160.71 → 77.92–109.09   |             17 / 0 / 3 / 54 |                    0 → 0 |          1 |

Merge counts removed downbeats; split counts added downbeats; fill/thin count
added/removed beats. A split line can reuse a detected beat. A new line's
reason explains that beat too. All records carry their source time interval.
The two-beat meter of diversity-1 is the folder's declared meter, preserved.

Unresolved bars remain in the denominator. Gaps block missing-beat inference;
their BPMs still reflect uncertain counts, explaining song 4's residual high
range. Isolated holes still flagged there have 0.50–0.54 s intervals surrounded
by roughly 0.26 s intervals, unlike sustained half-rate runs. Neither an
agent nor this heuristic establishes whether those are missing musical beats.
Irregular edges and non-octave lengths can also remain. No manual beat labels,
hardware playback, perceived output or step 9 time warping were measured.

Proof commands:

```sh
npm test -- tests/reference-grid-local.test.ts --silent=false
python3 tools/audio-to-midi/measure_beats.py ~/projects/ghost-notes/reference
python3 -m unittest discover -s tools/audio-to-midi -p 'test_*.py'
npm run check
npm run test:browser
```

The optional Node check skips without local material and writes an anonymous
report to `/tmp/ghost-grid-report.json`. Python independently reports the same
gap counts and confirms detected beats/downbeats unchanged in all six inputs.
CI uses invented merge, split, fill, thin, drift, deliberate change, true gap,
pickup and tempo-choice fixtures. Shared interval fixtures run in both languages.
The summary/choice assertions extend an existing browser test.

Review tightened beat snapping from 35% to 15% of a derived beat and
requires beat evidence at a two-bar merge's split point. Two regression tests
failed before those fixes and pass afterwards. The table includes the stricter
rule; rejected merges remain unresolved rather than shifting bar phase.

Final local gates: `npm run check` passed 533 Node tests, one skipped;
Python passed 10 model-free tests. `npm run test:browser` passed 67 tests,
one skipped, in 110.097 seconds of its 180-second budget (lock queue excluded).
The earlier run was 103.123 seconds; these are single-run observations under
shared-machine load, not a speed comparison. The actual app screenshot was
inspected: summary and tempo controls fit the existing shell. Opus approved
round 2 after two inference fixes; its optional accepted-merge test was added.
A full Node run hit an unchanged editing-test timeout; the isolated test and
subsequent full gates passed, with all limits unchanged. Integration and
uncertainty follow-ups are [on #11](https://github.com/FireLakeLabs/ghost-notes/issues/11#issuecomment-6866652436).
