# Ghost Notes

Arrange a transcribed recording into Strudel: per instrument, the MIDI, a literal
Strudel conversion, and the user's own arrangement, one above the other.

## Read first

- [The idea](docs/idea.md): what the app is and the workflow it serves.
- [Decisions](docs/decisions.md): what is settled.
- [Next steps](docs/next-steps.md): the plan, in order, with what each step needs.
- [Design study](design-study/README.md): the current phase.
- [Research](research/README.md): evidence, not authority.

## Current phase

Phase 0, design study. There is no application code. The study is run with
the owner present; do not start it, and do not start code, until asked.

## Working rules

- Use the Node version in `.node-version` and npm.
- When code arrives, Strudel stays pinned as in ODM: `@strudel/core`,
  `@strudel/mini`, `@strudel/tonal`, `@strudel/transpiler` at 1.2.6;
  `@strudel/web`, `@strudel/webaudio`, `superdough` at 1.3.0.
- Never bind a fixed port. Dev servers and browser tests take a free one.
- Other people's music stays out of the repository (G4). Test from a local path.
- Report what was measured separately from what was seen. No agent can hear;
  never describe how something sounds.
- Write to the owner in plain language, and show a mockup before asking them to
  choose between designs.
- Do not commit or push unless asked.
