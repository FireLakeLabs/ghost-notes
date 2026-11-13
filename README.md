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

Status: **step 2 of [next steps](docs/next-steps.md) done.** The design study
is finished and ODM's code is in; the Ghost Notes features come next. Start
with [the idea](docs/idea.md).

Ghost Notes starts as a fork of
[Order Doesn't Matter](https://github.com/FireLakeLabs/order-doesnt-matter)
(ODM), a visual instrument for Strudel. It keeps ODM's score sheet and editors
and is free to drift from them. ODM's code was copied from `main` at commit
`26c3689f7f23b24fede19be8c9bf7f4a6332fc8f` on 2026-11-13; ODM's Now
constellation and Watch spiral were then removed (G17).

## Layout

```
src/           the app (from ODM): document, import, generate, sheet, editors, engine
tests/         Node tests (vitest) and browser tests (Playwright)
scripts/       check, browser-suite, docs, boundary and licence scripts
harness/       one page per part of the app, for browser tests
corpus/        Strudel programs the tests import (G33)
docs/          the idea, decisions, next steps; ODM's model, standards, lessons
design-study/  the design study: brief, sketches, outcomes
research/      evidence gathered before the repo existed, with scripts
```

`npm ci`, then `npm run check` (format, lint, types, Node tests, docs,
boundaries, build) and `npm run test:browser`. `npm run dev` serves the app on
a free port.

## Licence

Our code is MIT; see [LICENSE](LICENSE). The app uses Strudel, which is
AGPL-3.0-or-later; the hosted app meets those terms by keeping this source
public and saying so in the app (decision G8).
