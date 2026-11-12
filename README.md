# Ghost Notes

Arrange a real recording into [Strudel](https://strudel.cc). A Fire Lake Labs project.

Ghost notes are the quiet notes a drummer plays between the main hits. Here
they are the original performance: transcribed from a recording, drawn faintly
under each instrument, while you write your own Strudel version on top.

For each instrument you see three rows on one timeline:

1. **MIDI**: what the transcription heard.
2. **Notes**: a literal, note-by-note Strudel conversion of that MIDI.
3. **Mine**: your arrangement, built section by section. You pick a range of
   bars in the rows above, make it a section, and rewrite it the way a
   Strudel player would: repeats, alternation, patterns, scales.

When you are done you copy your Strudel out. The app does not save anything.

Status: **design study.** No application code yet. Start with
[the idea](docs/idea.md), then [next steps](docs/next-steps.md).

Ghost Notes starts as a fork of
[Order Doesn't Matter](https://github.com/FireLakeLabs/order-doesnt-matter)
(ODM), a visual instrument for Strudel. It keeps ODM's score sheet and editors
and is free to drift from them.

## Layout

```
docs/          the idea, decisions, next steps
design-study/  the design study: brief, sketches, outcomes
research/      evidence gathered before the repo existed, with scripts
```

## Licence

MIT; see [LICENSE](LICENSE). Strudel itself is AGPL-3.0, and that question is
open: see [next steps](docs/next-steps.md#licence).
