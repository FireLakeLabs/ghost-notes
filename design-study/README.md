# Design study

Phase 0. Sketch the app before building it, with the owner in the room.

## Scope

The questions are listed in [next steps, step 1](../docs/next-steps.md#1-design-study-with-the-owner).
In short:

- how the whole-song timeline and ODM's one-section score sheet live together;
- the three rows per instrument and how differences are marked;
- selecting a range and making a section;
- what a new section starts with;
- reuse;
- stems and instruments;
- bar lines and tempo;
- the simplify controls;
- which ODM views stay;
- copy out;
- sounds.

## Material

- **Real data,** from a local path only (G4): the first test session, four
  songs, transcribed by the audio-to-midi tool. Song 3 has the steadiest beat
  grid (gaps 0.36–0.42 s). Use it first.
- **The literal conversion** of all four songs, and its measured faults:
  [research](../research/midi-to-strudel-literal.md).
- **The structure-finding experiment** on song 3's bass and drums:
  [research](../research/finding-structure.md).

Mockups may draw real notes on screen during the session, but no real notes,
screenshots of them, or conversions of them are committed. Sketches committed
here use invented notes or abstract marks.

## Layout

```
design-study/
  README.md      this brief
  sketches/      committed sketches (invented notes only)
  outcomes.md    written after the session: what was decided, and why
```

## Done when

The outcomes are written, each one is a G-decision in
[decisions](../docs/decisions.md), and the [next steps](../docs/next-steps.md)
are revised to match.
