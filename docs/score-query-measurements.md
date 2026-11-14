# Score queries: scope and measurements

PR #39's browser gate passed locally but repeatedly reached the unchanged 180 s
CI limit. One required check passed in 153.895 s while the same head's hosting
job reached the limit twice. The evidence remains on tracking issue #11.
This prerequisite removes repeated whole-score questions; it changes no test
deadlines, drawing limits, Strudel pins or hosting gates.

A full refresh formerly generated and evaluated the program separately for
each row, with two fresh workers at a time. The new path asks one tagged
program, then partitions queried events by the playback identity in Hap context.
Edits refresh all rows in context too: a group rewrite can couple neighbours.
At this measurement, single-row documents stayed isolated (G119 below
supersedes that exception). Broken, opaque or unattributed answers fall
back. Cancellation is checked before that fallback can launch work.

## Production browser comparison

Claim: every row still receives its queried notes, with less repeated work
before the score becomes ready. Five old/new pairs alternated on this 16-core
Linux machine, Chromium 158.0.8127.18, 1440×1100. Each sample used a fresh page,
production build, offline routes and pinned dependencies; the suite lock
excluded other Node/browser runs. Control was main at 0a7d06f. No profiler was
active in these reported samples. Pre-run load was below one on 16 cores.

| Input                                       | Old answer-ready median / range, ms | New answer-ready median / range, ms | Worker starts old → new | Notes retained |
| ------------------------------------------- | ----------------------------------: | ----------------------------------: | ----------------------: | -------------: |
| Synthetic six-voice fixture                 |                 316.8 / 313.5–320.7 |                 145.7 / 144.5–148.8 |                   7 → 2 |             96 |
| First test session, song 1: make eight bars |           4,339.9 / 4,304.2–4,346.7 |           1,058.7 / 1,036.2–1,082.4 |                   9 → 3 |            362 |

All 20 samples had zero runtime/query errors and the expected note count.
An earlier five-pair repeat found the same direction and worker counts.
The real flow includes section conversion, document editing and asking Strudel.
Waiting additionally for the lens to finish gave 4,345.2 / 4,309.8–4,352.4 ms
old versus 1,064.1 / 1,042.0–1,089.4 ms new. Thus the difference survives the
end-to-end lens wait. Worker counts include independent preflight and the
cancelled question started before selecting the new place. Notes were not
sampled to obtain these times.

A separate excluded CPU trace found about 8.1 s of worker CPU across seven
completed question contexts in the old real flow, versus 0.81 s across two in
the new flow. The old two-slot pool accounts for about four seconds of wall
work. The controller's repeated generation/evaluation loop is the limiter
removed here. Main-thread paint/audio-peak work was similar. Most worker samples
were in a minified function; its original source mapping was not reliable,
so no particular upstream function is blamed.

## Fidelity and limits

Four ordinary seam tests cover identical voices, silence, reuse, shifts, the
existing arranged fixture, explicit fallback and a group arpeggio. That
arpeggio produces four events per row in full context versus eight isolated
over two cycles. Multi-row edits must use the same full context, including
unchanged neighbours. A controller regression failed before that fix (16
edited-row events instead of eight over four cycles) and passed after it;
controller checks also cover fallback and superseded requests. An opt-in repository survey
checked 85 programs: tagged answers agreed with isolated row answers in 82,
and three needed fallback. This includes single-row programs, although the app
uses the combined path only for multiple rows.

Every real-material run constructs the same first-eight-bar document edit as
Make section. All 36 rows across six songs agreed with their isolated-query
oracle, including spans, values, tempo, errors and event multiplicity. The
arranged onset counts were 362 / 156 / 154 / 439 / 96 / 136 (1,343 total);
source input remained 14,047 notes. Each song ran separately inside the
unchanged Node budget. The longest complete command took 28.871 s / 60 s;
each individual test has a 55 s limit.

An earlier raw-conversion experiment queried whole literal programs, including
unnumbered edges, rather than the document edit the app performs. Its combined
run exceeded the 55 s test limit; the largest full-range case also reached a
five-second question deadline on the old isolated path. These runs do not
establish full-program responsiveness. No range cutoff was added. This report
does not prove arbitrary opaque programs, audio alignment, speaker output,
physical display timing or perceived musical quality. No listening claim.
An unsuccessful combined question can add up to five seconds before the old
isolated fallback begins. Those fallback rows describe isolated/solo playback,
which can differ from full context for transforms that look across rows.

## Reproduce

Use GHOST_QUERY_CONTROL with a checkout/archive of 0a7d06f and installed
dependencies, then run node scripts/profile-score-query.mjs. It writes only an
anonymous report under /tmp/ghost-score-query-bench.json, uses ports chosen
by the OS, and closes browser/server processes. Keep real reference files local.

Run GHOST_SCORE_SURVEY=fixtures npm test -- tests/score-query-local.test.ts
--silent=false. For each N=1 through 6, run GHOST_SCORE_SURVEY=references
GHOST_SCORE_SONG=N npm test -- tests/score-query-local.test.ts --silent=false.
Source fields, names, conversions and real pixels are never printed or committed.
These measurements precede CI qualification and are not reliability evidence.

## Lens wave: shared one-instrument evaluation

G119 extends whole-program questions to one row. A synthetic shared initializer
ran repeatedly when its isolated score expanded references, returning 62/63
instead of playback's 61/61. The controller canary first failed, then passed
on load and edit. Redundant tracking of partially refreshed rows was removed.

On the first test session, song 1, accepting 21 native one-bar drum offers
previously hit the existing five-second timeout. One complete question
returned 242 onsets; an actual grid edit added one at all 22 places. Two
copies and explicit folder reopening retained 264 queried/Mine onsets, every
link and tempo, and zero onsets in unarranged bars. This is one correctness
walk, not a paired speedup claim. Full-question timeout followed by isolated
fallback can still add five seconds, including for one row.
