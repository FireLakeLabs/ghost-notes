# Ghost Notes

Arrange a transcribed recording into Strudel: per instrument, the MIDI, a literal
Strudel conversion, and the user's own arrangement, one above the other.

## Read first

- [The idea](docs/idea.md): what the app is and the workflow it serves.
- [Decisions](docs/decisions.md): what is settled.
- [Next steps](docs/next-steps.md): the plan, in order, with what each step needs.
- [Model](docs/model.md), [standards](docs/standards.md) and
  [lessons](docs/lessons.md): inherited from ODM; how the code works and is tested.
- [Design study](design-study/outcomes.md): what was chosen, and why.
- [Research](research/README.md): evidence, not authority.

## Current phase

Steps 1 and 2 of [next steps](docs/next-steps.md) are done: the design study,
and ODM's code copied in with the constellation and spiral removed (G17).
Step 3 (prove the Strudel assumptions) is next; start it only when asked.
`npm run check` and `npm run test:browser` must pass before any commit.

## Skills

Project skills live in `.agents/skills/`. [.agents/README.md](.agents/README.md)
routes requests to them ("full send", "full stop", "orchestrate", "review loop",
PR work) and sets the reviewer policy. For TypeScript work, apply
[typescript-best-practices](.agents/skills/typescript-best-practices/SKILL.md) and
the principles it links.

## Working rules

- Use the Node version in `.node-version` and npm.
- Strudel stays pinned as in ODM: `@strudel/core`,
  `@strudel/mini`, `@strudel/tonal`, `@strudel/transpiler` at 1.2.6;
  `@strudel/web`, `@strudel/webaudio`, `superdough` at 1.3.0.
- Never bind a fixed port. Dev servers and browser tests take a free one.
- Other people's music stays out of the repository (G4). Test from a local path.
- Report what was measured separately from what was seen. No agent can hear;
  never describe how something sounds.
- Write to the owner in plain language, and show a mockup before asking them to
  choose between designs.
- Do not commit or push unless asked.
