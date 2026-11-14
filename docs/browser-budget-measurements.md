# Browser budget qualification

G121 separates existing UI and serial audio projects onto isolated CI runners.
It changes no application code, assertions, observations, worker counts or test
limits. Check and Deploy call the same reusable workflow; their gate jobs fail
if either browser group fails. Publication still waits for hosting.

## Before (observed CI, #42 final head)

| Run                                                                             | Complete browser command | Headroom / 180 s |
| ------------------------------------------------------------------------------- | -----------------------: | ---------------: |
| [Check](https://github.com/FireLakeLabs/ghost-notes/actions/runs/43624384119)   |                172.443 s |          7.557 s |
| [Hosting](https://github.com/FireLakeLabs/ghost-notes/actions/runs/43624384131) |                147.358 s |         32.642 s |

The logs' test-start timestamps put the 62 UI cases at approximately 86.237 s
and 66.543 s respectively, followed by approximately 82.802 s and 78.546 s of
audio work through Playwright completion. These phase spans include worker
startup/cleanup; they are not sums of parallel case durations. Build and runner
cost remain in the complete command. CI reports 83 passed and two platform/local
skips; local #42 reported 84 passed/one skip in 133.919 s.

Check's five slowest cases: arrangement walk 15.305 s; infinite-pattern worker
isolation 14.990 s; copy scheduling 11.924 s; tempo diagnostic 11.650 s; drifting
chord canary 11.643 s. The held-chord case takes another approximately 11.6 s.
Three tempo canaries plus copy therefore occupy approximately 47 s of the serial
phase. They wait for actual scheduled events, including control runs. Removing
those waits would remove proof. The current warp test adds about 10 s.

## Alternatives weighed

- **More shared setup:** five fixture groups already report shared setup
  (1.061–1.512 s each in Check). Further reuse may help specific fixtures, but
  cannot remove the 79–83 s serial audio floor. The largest UI case is now below
  20 s after #42 separated independent fixtures. No additional sharing was timed
  here; these numbers do not predict savings from a cache or fixture rewrite.
- **Separate only measurement canaries:** moving the approximately 47 s to its
  own runner would leave UI plus roughly 32–36 s of audio serially on the other.
  That estimate is arithmetic from logs, not a measured alternative run. The
  natural UI/audio project boundary removes the whole serial dependency without
  reclassifying or weakening a canary.
- **Independent runners:** selected. Audio retains one worker; UI retains three.
  Both run every existing case once across their disjoint projects. Each group
  builds/serves/cleans up inside its own unchanged 180 s budget and retains 20 s
  per-case accounting. Extra runner/build cost is explicit. No application or
  CPU-efficiency speedup is claimed.

## Local observations (2026-11-14)

On this idle 16-core machine (load average 0.04/0.07/0.27 at setup), the complete
production-built command passed 84 tests/one skip in **134.367 s / 180 s**.
Chromium 158.0.8127.18 opened all six local folders and checked 36 retained stems.
The isolated UI entry point passed 61 cases/one skip in 46.691 s / 180 s.
After the review fixes, the complete command passed again in 134.491 s / 180 s
(84 passed, one skip).
The timing artifact attributes 68.171 s of audio's 84.420 summed test-seconds to
observation. UI's parallel case durations sum to 118.939 s; that sum is not its
wall time. These are single-run observations, not a repeatable speedup claim.

Playwright collection comparison: **85 = 62 UI + 23 audio**, with disjoint
case identities and no omissions. Actionlint passes the reusable workflow and
both callers. The timing reporter now writes after every completed case, so
completed rows survive a wall-limit kill; a regression checks retention and
20 s rejection without calling the end-of-suite callback.

## Acceptance and reproduction

Target: each CI group at most **135 s / 180 s**, on two consecutive runs,
leaving at least 25% for runner variation and upcoming tests. Qualification
results and run links are recorded in the budget PR before merge. No unchanged
rerun is used to hide a failure. Both Check and Deploy must qualify.

`npm run test:browser` remains one honest complete command under the abstract
socket lock, including UI then serial audio, within 180 s. The explicit CI
entry points are `npm run test:browser -- ci-ui` and `-- ci-audio`; they use the
existing Playwright projects without dependencies. Every timing/phase row is
retained in CI's `browser-ui-…` / `browser-audio-…` artifacts, including failures.
`ODM_PROFILE_PATH` can retain the same JSON locally. The existing lower-only
`ODM_BROWSER_LIMIT_SECONDS` still exercises failure; 20 s accounting is unchanged.

The real-material end-to-end check is the existing six-folder browser decode
walk in the complete local suite. It retains all six stems per song and checks
frames/duration. No music, paths, names or pixels enter this report. Source,
physical display, speaker output and perceived latency are not measured by this
CI infrastructure change. Cross-project enforcement of the machine lock remains
outside this repository; both local entry points here acquire it.
