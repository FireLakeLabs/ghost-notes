# Research

Evidence gathered on 2026-11-12, before this repository existed. It is
evidence, not authority: decisions live in [docs/decisions.md](../docs/decisions.md).
No transcribed notes, conversions or recordings are kept here (G4).

| Report | Question | Headline |
| --- | --- | --- |
| [midi-to-strudel-literal.md](midi-to-strudel-literal.md) | What does an existing MIDI-to-Strudel converter produce from our transcriptions? | Every note survives, but tempo changes, pickups, durations and velocity are lost. |
| [finding-structure.md](finding-structure.md) | Can the pile of notes be reduced to its structure? | Drums: 44 → 26 distinct bars, 40% shorter code on song 3. Bass needs interval matching and cleaning first. |
| [pipeline-in-typescript.md](pipeline-in-typescript.md) | How much of the audio-to-MIDI pipeline could be TypeScript? | All the logic, and the pitch model; the stem splitter and drum model are hard. Keep Python for now. |

## Scripts

`scripts/` holds the scripts behind the measurements. Paths are arguments, and
input stays outside the repository.

- `structure-experiment.py`: groups bars and compresses them (finding-structure).
- `literal-run.sh`: runs the third-party converter (cloned separately, never
  copied in), then post-processes and checks the result.
- `literal-postprocess.py`: sets the tempo, labels stems, maps drums, picks
  synths.
- `literal-compare.py`: compares the MIDI with the converted output note by
  note.
- `strudel-check.mjs`, `strudel-dump.mjs`: load Strudel in Node and list the
  notes it plays.
