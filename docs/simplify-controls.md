# Reviewing a simplify proposal

Use **Simplify…** in the timeline or the selected place's lens. Choose a section
place and instrument, then **Ask for suggestions**. Input is that place's original
recording notes on the session's chosen grid, as in Main and the Simplify study
board. This proposes replacing current note edits; it does not simplify arbitrary
authored code. All seven pitched techniques are inspectable independently; drums
offer their bar-template proposal. Initially select the smallest standalone
program, and say “not shorter” when it expands. No random fills or hidden repair.

The report shows matched/countable source/countable proposal counts and both
shares (G77), every change kind, standalone UTF-8 sizes and inspectable expression.
The drawing calls the timeline's G31 renderer: cream proposals, faint blue source,
orange changes, movement lines, hollow shortened tails and dropped notes, merge
stacks and bar-crossing lines. Up/down or pointer reveals explanations. Raster
sampling stays at 200 events per bar; counts and validation use complete notes.

**Limits…** opens the existing session Settings, including quiet and match rules.
Changing settings, grid, document or reference invalidates the preview. Changing
scope or closing the dialog cancels bounded query workers. Reload resets limits.

**Apply to section** retains the instrument identity, links, outer sound/effects
and existing shared-edit rules. Every place using that section changes. Split off
a place first for an independent section. One Undo restores the prior document;
**Discard** makes no edit. Several definitions for one instrument at a place
require its source editor rather than an arbitrary first definition.

Before enabling Apply, evaluate the complete tagged candidate in a fresh worker
over this place. Compare all scheduled onset/pitch/effective-end tuples with the
proposal, including duplicates. Unknown instrument identities, unmapped values,
query failures and inherited rewrites that change those tuples leave Apply
disabled with a reason. Sound and gain remain user choices; the proposal report
describes notes before those effects. A mute or time/pitch rewrite can therefore
require the source editor. This is not a claim about how anything sounds.

## Evidence, 2026-11-14

- `tests/browser/simplify.spec.ts`: invented eight-bar drums/bass, each 33 → 32
  notes at explicit expected onset/pitch tuples; other instrument unchanged;
  Discard, Apply, Undo, session limits and stale-preview rejection. Focused
  cases took 1.5–2.2 seconds locally, under the unchanged 20-second budget.
- `tests/simplify-section.test.ts`: full-context candidate proof, independent
  split-copy isolation, source-link round-trip and rejection of a global transpose
  or failed query. Existing API tests prove the individual emitted techniques.
- Inspected the actual dialog at 1440 px and 390 px; horizontal content fits,
  the small dialog scrolls, controls remain reachable. Retained screenshots and
  `design-study/sketches/simplify-report.html` contain invented notes only.
- `npm run measure:simplify` opts into a real local folder; it is excluded from
  the ordinary suite and emits only anonymous aggregates to `/tmp`. Two visits
  per instrument on the first test session, song 1, bars 1–8, included opening
  the checked report and two animation frames. Chromium, production Vite build,
  default 4-step grid, 50 ms exact match, quiet notes included; shared suite lock.
  Second run host: 16 logical cores, load 1.50/4.79/5.62. No audio was requested.

| Instrument | Proposals | Original / proposed / matched |  Kept / match | Standalone bytes | Painted-report visits |
| ---------- | --------: | ----------------------------: | ------------: | ---------------: | --------------------: |
| Drums      |         1 |                  79 / 77 / 67 | 84.8% / 87.0% |      6315 → 4443 |           919, 936 ms |
| Bass       |         7 |                  56 / 56 / 27 | 48.2% / 48.2% |      3794 → 3060 |           922, 954 ms |

Both real Apply paths completed and Undo restored the exact document. Zero
browser runtime errors. The second run's whole optional command took 9.807 s;
its case took 8.145 s. Private screenshots were inspected locally and stay out
of git/PRs. The low bass match includes existing grid movement, reported honestly
rather than interpreted as intent. No general latency improvement, listening,
perceived quality, full-song UI scaling or physical device output was measured.
