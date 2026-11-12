# Finding structure in transcribed band notes

> Provenance: written 2026-11-12 by a research agent working in the ODM repository, before Ghost Notes existed. "AGENTS.md", "docs/" and D-numbers refer to ODM. The output files it lists contain transcribed notes and were not copied; the script is `scripts/structure-experiment.py`. Copied with song and band names removed (G4).

Yes: treat this as choosing a short explanation of uncertain events, rather than formatting MIDI. Minimize reconstruction error plus a weighted program-complexity cost. Keep several explanations when meter, scale, or voice assignment is ambiguous. A shorter program is a hypothesis, not recovered authorial intent.

Read AGENTS.md and docs/model.md first. This fits ODM's model: generate a program tree, query its events, and compare those events with evidence. Do not make quantization a restriction on the app's representation of notes.

## Measured experiment

Reproduce: Node 24.22.2; run Python with isolation:
`python -I research/scripts/structure-experiment.py <notes.json> <beats.json> <out dir>`.
Input is song 3's notes.json and beats.json from the first test session (local only). No repository changes.

The beat file has 324 beats, from 0.06 to 123.60 seconds, despite duration 142 seconds. Gaps are 0.36–0.42 seconds. First downbeat is 0.42 seconds. Analyze only 80 complete four-beat bars starting there; do not invent the uncovered ending. Use piecewise-linear interpolation between adjacent beat times and nearest sixteenth-note snapping (four subdivisions per detected beat). Preserve pitch and simultaneous onset sets; omit velocities and durations in both comparison representations.

| Stem | Input notes | Notes in window | Quantized unique events | Exact distinct bars | Tolerant representatives | Exact repeated occurrences | Reused occurrences with tolerance |
|---|---:|---:|---:|---:|---:|---:|---:|
| bass |447|442|442|78|78|2|2|
| drums |645|644|643|44|26|36|54|

Tolerance is Jaccard distance: symmetric-difference size divided by union size, at most 0.25. Assign to the nearest existing representative, otherwise create one. This greedy procedure is order dependent and is not a claim of optimal clustering. Empty bars match only empty bars. Counts include silence. Median absolute onset snapping error: bass 0.0646 beats; drums 0.0263 beats.

Literal baseline writes every bar in angle brackets, with 16 explicit slots. Compressed output defines representative bars and uses arrange with run lengths. Bass expands from 4,055 to 7,637 characters: reject that candidate. Drums initially measured 4,655 versus 2,772 characters before correcting MIDI sample labels; consult measurements.json for final exact lengths. Compression is relative to an already quantized onset-only baseline, not faithful MIDI conversion. The representative replacement can add as well as remove notes. These results support drum templates; they do not establish a recurring bass riff.

Files: bass/drums-literal.js, bass/drums-compressed.js, measurements.json, experiment.py, check.mjs, check-isolated.mjs, transpile.log. Drum mapping is GM 35→bd, 38→sd, 42→hh, 47→mt, 49→cr. These are sample choices, not original timbres. Programs loop the analyzed span. No listening was performed.

The checkout has no node_modules. The main project node_modules contains transpiler 1.2.6, but importing it fails because @kabelsalat/web lacks SalatRepl. check.mjs preserves that attempted check. An isolated installation of the same transpiler version is the fallback; see transpile.log. Transpilation alone does not prove event equivalence or mini-notation/runtime validity.

## Techniques and prior work

The following are proposed methods, not measured improvements on this recording.

| Technique | What it gives and noise behavior | TypeScript feasibility |
|---|---|---|
| Beat-map quantization | Convert seconds to fractional beats, compare binary/ternary subdivisions, retain timing residuals. Robustly repair implausible gaps; never interpolate blindly across missing sections. Test half/current/double beat rates and downbeat phases using accent alignment and shortest-description cost. Tempo alone cannot determine meter. | Straightforward arrays, robust statistics and dynamic programming. |
| Cleaning | Merge same-pitch fragments only across short gaps with no strong intervening attack; preserve source IDs. Reject short weak isolated notes using local, per-stem thresholds. Quiet stem level is evidence of bleed, not proof: compare coincident pitches/onsets with louder stems. | Straightforward; audio-informed attack evidence requires upstream features. |
| Chord/voice reduction | Cluster near-simultaneous notes; select a bass voice by register, continuity and confidence, or retain pitch-class sets/root alternatives. A lowest-note rule alone can select octave errors. | Dynamic programming over candidate notes. |
| Key/scale inference | Duration/confidence-weighted pitch-class profiles per section, then test degree encodings. Keep chromatic exceptions and competing keys; do not force every passing note into a scale. | Small vector operations; no heavy ML needed. |
| Self-similarity | Bar/beat features (onsets, pitch classes, bass intervals) reveal repeated diagonal blocks and section boundaries. Normalize dynamics and allow local time alignment; silence must not dominate similarity. | O(B²) practical for songs; typed arrays. |
| SIATEC/COSIATEC | Point sets in onset/pitch space identify translated patterns, including transposition. Exact geometric equality is brittle under jitter, insertions and deletions: quantize first, verify approximate matches, penalize sparse accidental matches. | Possible; more implementation and memory work than bar matching. |
| MorpheuS | Uses discovered pattern constraints in generating structured music; useful precedent for separating structure from surface realization, not an off-the-shelf noisy transcription cleaner. | Port the pattern ideas, not necessarily its optimization system. |
| Sequitur / Lempel–Ziv | Recurring token phrases become reusable rules; hierarchical section structure can emerge from bar labels. Exact tokens are brittle, so cluster near-equal bars first. Grammar size is not identical to readable Strudel size. | Straightforward; Sequitur needs careful rule bookkeeping. |
| Bar edit distance | Weighted insert/delete/substitute operations distinguish fills from new riffs; compare rhythms and pitches separately, permit one-slot onset shifts. Medoids avoid chain clusters drifting away from every member. | Straightforward DP; constrain candidate pairs for speed. |
| Euclidean fit | Enumerate pulses, steps and rotation; score weighted missing/extra hits against each drum lane. Only emit (k,n,rotation) when simpler and sufficiently accurate; regular backbeats need not be Euclidean. | Tiny search. |
| Onset templates | Consensus occupancy across repeated bars separates backbone hits from occasional fills. Confidence-weighted probabilities cope with missing and extra detections. | Straightforward. |
| Interval/contour matching | Compare successive pitch differences for transposed riffs, or up/same/down contours for coarser identity. Contour alone conflates many melodies. Joint rhythm matching and exception counts prevent overgeneralization. | Straightforward sequence alignment. |
| Program synthesis | Enumerate short DSL candidates, execute finite windows, match event sets, rank error versus code complexity. Can combine deterministic motifs with learned proposals; require bounded execution and reject unsupported syntax. | Native Strudel runtime is ideal for verification; learned model inference usually external. |

Primary references:
- Meredith's geometric compression poster: https://titanmusic.com/papers/public/MeredithMIREX2013Poster.pdf
- SIATEC-C paper: https://archives.ismir.net/ismir2022/paper/000006.pdf
- MorpheuS authors' manuscript: https://qmro.qmul.ac.uk/xmlui/bitstream/handle/123456789/31990/Chew%20MorpheuS%20generating%20structured%202017%20Accepted.pdf?sequence=1
- Sequitur authors' project: https://www.sequitur.info/ (fetch failed during this research).
- Toussaint's rhythm paper: https://chromatone.center/media/pdf/banff.pdf
- Strudel notation documentation: https://strudel.cc/learn/mini-notation/

## Decomposer and code recovery

The July 2026 paper directly targets MIDI-to-Strudel. Its framework uses synthetic paired program/MIDI supervision, followed by reinforcement learning balancing reconstruction and readability. It is relevant precisely because literal event reconstruction can defeat readability. This is evidence for execution-based candidate ranking, not proof it will clean Demucs/Basic Pitch output. Source: https://arxiv.org/html/2607.01849v1

The official implementation provides inference with a Qwen3-8B-derived model, multiple sampled candidates, instrument/time-window selection and tempo/meter overrides. It recommends 24GB+ GPU memory and CUDA 12.4+. It was not run here. TypeScript can orchestrate inference and validate outputs; porting model training is unnecessary. Source: https://github.com/elianakim/Decomposer

Strudel itself inherits Tidal's compact temporal notation; it is an output language rather than a transcription-denoising algorithm. Use exact structural rewrites first: repeated adjacent cycle tokens → !; recurring cycle choices → angle brackets; within-cycle repetition → *; longer spans → / or arrange. A two-bar riff repeated four times should be arrange([8, riff]) when riff itself spans two cycles, with phase tested by querying all eight cycles. Scale degrees and add express pitch structure only after choosing whether transposition means semitones or degrees. Reference: https://strudel.cc/learn/mini-notation/

## Suggested pipeline and interaction

1. Preserve immutable source notes and confidence/provenance. Audit beat coverage, gaps and stem levels automatically.
2. Offer meter, beat-rate and downbeat alternatives with scores. User chooses ambiguous alternatives; do not conceal unsupported ending bars.
3. Generate several cleaning levels, retaining every dropped/merged event's reason. Infer voices and scale candidates per section.
4. Discover bar templates, then two/four/eight-bar phrases, transpositions and section order. Compare exact and tolerant explanations.
5. Search small Strudel expressions and choose the shortest under a user-set error budget. Include definition overhead: the bass experiment shows why counting unique patterns is insufficient.
6. Query generated patterns across the full selected span. Report onset/pitch precision and recall, duration error separately, and section coverage. Transpilation is only the first gate.
7. Show original notes faintly behind the simplified score. Mark removed notes, inserted template notes, merged fragments and moved attacks distinctly; selecting a mark reveals source/time/reason. Give each motif its occurrence list and similarity score.

A simplify slider should control explicit error budgets (allowed onset displacement, dropped weak-note fraction, pitch substitutions), not an opaque percentage. Expose independent locks for melody, rhythm, durations and section boundaries. Default to deterministic exceptions. sometimes/degradeBy describe a distribution, not the observed location of a fill: offer them only as a deliberate generative interpretation, with measured occurrence rate and a stated loss of exact arrangement. ODM's cycle-query semantics let the user inspect any resulting cycle, including time-fixed random choices.

Final validation: isolated install had the same dependency export failure. The successful check uses the main project's actual transpiler 1.2.6 with loader.mjs replacing only @kabelsalat/web with an empty SalatRepl class to bypass its unrelated audio dependency import. The same stand-in is used by `research/scripts/strudel-check.mjs` and by ODM's `src/strudel/evaluate-node.ts`. All four outputs pass transpiler syntax processing; this is a qualified check, not an unmodified runtime execution. Final drum character counts remain 4,655 versus 2,772 (40.5% shorter); corrected labels have equal lengths.
