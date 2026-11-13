# Project skills

Twenty agent skills in `.agents/skills/`, copied on 2026-11-13 from
`monkeyboys-modular-synth` at commit `af7040f`, where they were installed and
adapted. Nine come from [tstack](https://github.com/t3dotgg/tstack), eight
are adapted from [pstack](https://github.com/cursor/plugins/tree/ae5650febf4320793844c12c4adaa937f417f8da/pstack),
and three were written by that project. Its `show-me` skill was not taken: the
Artifact tool and HTML preview cover it.

## Routing

Read the selected `SKILL.md` and its dependencies when a request triggers it.
Installing, documenting, or discussing a workflow is not an instruction to run it.

| Request                           | Skill                                                       | Finish                                                                       |
| --------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| "full send"                       | [full-send](skills/full-send/SKILL.md)                     | Implement, prove, review, file, babysit, and merge after its gate passes.    |
| "full stop"                       | [full-stop](skills/full-stop/SKILL.md)                     | The same preparation, with an open PR ready for the owner to merge.          |
| "orchestrate"                     | [orchestrate](skills/orchestrate/SKILL.md)                 | Run waves in their own threads, review each, land lessons; the owner approves. |
| "review loop"                     | [review-loop](skills/review-loop/SKILL.md)                 | Bounded review using the reviewer policy below.                              |
| "sol loop" / "opus loop"          | [sol-loop](skills/sol-loop/SKILL.md), [opus-loop](skills/opus-loop/SKILL.md) | Bounded review by GPT Sol / Claude Opus.                  |
| "council"                         | [council](skills/council/SKILL.md)                         | Review by three providers, findings reconciled.                              |
| File, open, or create a PR        | [file-pr](skills/file-pr/SKILL.md)                         | A concise PR: problem, outcome, how it was verified.                         |
| Monitor, watch, or babysit a PR   | [babysit-pr](skills/babysit-pr/SKILL.md)                   | CI and review findings handled; merge only when authorized.                  |
| Take over a PR, branch, or thread | [takeover](skills/takeover/SKILL.md)                       | Finish the scope, keeping contributor credit.                                |
| Modernize or rebase an old PR     | [modernize](skills/modernize/SKILL.md)                     | Reassess intent, then update the branch within scope.                        |
| Post a GitHub comment             | [leaving-pr-comments](skills/leaving-pr-comments/SKILL.md) | An attributed, evidence-backed comment.                                      |

Engineering skills apply without a trigger phrase:

- TypeScript work: [typescript-best-practices](skills/typescript-best-practices/SKILL.md)
  and the principles it links. Test changes:
  [test behavior](skills/principle-test-behavior-not-implementation/SKILL.md).
- A preventable correction: [correct](skills/correct/SKILL.md). A bug with a cheap
  local test: [tdd](skills/tdd/SKILL.md). A measured performance claim:
  [benchmark-checklist](skills/benchmark-checklist/SKILL.md).

Ordinary development requests do not start shipping or multi-model review
workflows. Ghost Notes' own rules in [AGENTS.md](../AGENTS.md) still apply inside
every skill: plain language for the owner, a mockup before a design choice, and
no claim about how anything sounds.

## Reviewers

A review loop uses one reviewer. The owner's explicit choice wins; `sol-loop`
otherwise selects GPT Sol and `opus-loop` Claude Opus. For `review-loop`,
including inside full-send and full-stop, choose Opus for work Sol wrote and Sol
for work Opus wrote. Mixed or unknown provenance defaults to Sol; report it rather
than claim the reviewer was independent. Judge provenance from the task, not Git
author names. Resolve model availability when invoked, and report an unavailable
reviewer rather than substitute one. No fixed model IDs are configured here.
`council` keeps its three-provider default.

## Harnesses

The skills name T3 Code's tools where they help (`watch_pull_request`,
`delegate_task`, `t3_thread_launch`, `link_pull_request`) and say what to do
without them. `babysit-pr`'s `pr-wait` script is the waiting path outside T3 and
needs Python 3 on a Unix-like system. PR workflows need an authenticated GitHub
CLI (`gh`). Claude Code does not discover `.agents/skills/` on its own; it reaches
these skills through this file, which [AGENTS.md](../AGENTS.md) points to.

## Ghost Notes adaptations

Changed from the synth project's copies, all recorded in the lockfile:

- `orchestrate`: Ghost Notes' checks instead of the synth project's CI docs and
  hosted browser check; a non-T3 path for launching and monitoring waves.
- `file-pr`: link the new PR to the thread in T3 Code. Now marked adapted.
- `typescript-best-practices`, its patterns, `principle-boundary-discipline`,
  `principle-test-behavior-not-implementation`: Ghost Notes' document, edits,
  queried events and `src/strudel/` boundary instead of the synth project's
  patch, rack, graph and React.

## Provenance and checking

- tstack: revision `1085050f3baed1ac724caa4a8166145fb2ac88af`, MIT, copyright
  Theo Browne ([TSTACK-LICENSE](TSTACK-LICENSE)). `sol-loop` and `full-send`
  were adapted in the synth project to share `review-loop`.
- pstack: revision `ae5650febf4320793844c12c4adaa937f417f8da` (0.15.36), MIT,
  copyright Lauren Tan ([PSTACK-LICENSE](PSTACK-LICENSE)). The synth project's
  [adoption review](pstack-review.md) explains each adaptation and exclusion.
- `orchestrate`, `review-loop`, `opus-loop`: written in the synth project, so they
  have no upstream hashes; Git history is their record. `review-loop` derives from
  tstack's Sol loop and stays under its notice.

[skills-lock.json](skills-lock.json) records each file's source, upstream hash,
installed hash and executable bit, and each skill's dependencies.
`npm run check:skills` verifies them and the links between skills, and runs the
checker's own tests; `npm run check` includes it. After a reviewed edit to an
adapted file, run `node scripts/check-skills.mts --update-hashes`. Mark a newly
edited vendored file `"adapted": true` first. The check cannot judge whether
prose is right, and it does not catch an edit that changes a file and its hash
together; those are for review.
