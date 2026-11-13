# Step 5 measurements — 2026-11-13

Measured in the passing full browser run on Linux, 16 logical CPUs, Node
24.22.2, Chromium 158.0.8127.18. One run per song, 44.1 kHz stereo decode.
The OS file cache was not cleared; other worktrees were active. This is a
local capacity/timing observation, not a speed comparison or a latency promise.

| Input                      | Bars | Bar BPM range | Gaps | Stems | Decode ms | Peaks ms | Open ms | WAV MiB | PCM MiB |
| -------------------------- | ---: | ------------- | ---: | ----: | --------: | -------: | ------: | ------: | ------: |
| First test session, song 1 |   45 | 28.57–150.00  |    3 |     6 |       620 |      101 |     885 |  125.14 |  250.28 |
| First test session, song 2 |   76 | 70.31–122.45  |    1 |     6 |       816 |      104 |    1103 |  167.56 |  335.11 |
| First test session, song 3 |   83 | 150.00–166.67 |    0 |     6 |       712 |       88 |     956 |  143.33 |  286.66 |
| First test session, song 4 |   73 | 111.11–235.29 |  160 |     6 |       691 |       87 |     975 |  141.84 |  283.68 |
| diversity-1                |  181 | 83.92–140.62  |    0 |     6 |      1528 |      198 |    1995 |  313.66 |  627.32 |
| diversity-2                |   68 | 77.92–166.67  |    0 |     6 |       813 |      108 |    1069 |  162.18 |  324.35 |

Decode sums awaited native `decodeAudioData` calls; peaks sums the actual scans.
Open includes chooser/file-list handling, JSON/MIDI reading, decoding, peak
computation and summary publication. All 36 stem buffers were retained and
checked against song duration within 0.01 seconds. Zero import/decode failures.
Bar counts include the documented final zero-length partial marker. BPM ranges
are observed per-bar averages, including uneven detection; they are not claims
about musical tempo. Gaps are exactly the tool’s G42 flags (including 160 in
the fourth song), without a new heuristic.

Retained PCM counts frames × channels × 4 bytes, not JS heap size or process
RSS. Song 1 retained 262,438,752 PCM bytes plus 256,320 peak bytes; its six WAVs
totalled 131,219,640 bytes (21,869,940 each). Across the whole six-song corpus,
PCM ranges from 250.28 to 627.32 MiB; peak arrays from 256,320 to 642,384 bytes.
The largest input has 313.66 MiB of WAVs. No arbitrary size cap was introduced.
Sequential decode limits application-held encoded input to one stem at a time.
Peak process memory, browser decoder scratch allocations, GC release timing,
mobile memory capacity, hardware playback and perceived audio were not measured.

Proof: `npm run check` passed (516 Node tests, one skipped);
`npm run test:browser` passed (67 browser tests, one skipped; 107.108 seconds
of the 180-second budget). The synthetic fixture checks exact pickup, gap and
tempo-change coordinates; generated audio checks native decoding, buffer
retention and peaks. Picker tests use real OPFS handles, persisted through
reload; permission grant/denial are simulated on those native handles. Native
CDP folder drops and fallback directory input are exercised in Chromium.
The actual system permission dialog and Firefox/Safari were not automated.

Both local checks read `~/projects/ghost-notes/reference/` and skip cleanly
when absent; no song names, provenance, recordings or transcription data enter
these reports. The Node check is `tests/reference-local.test.ts`; the browser
check is `tests/browser/reference.spec.ts`. The latter writes an anonymous JSON
report under `/tmp`. The [synthetic screenshot](../design-study/sketches/reference-open.png)
was inspected: open/reopen controls and text summary fit the existing shell.

Integration: this passing run includes step 3 (#15), the pure reader (#16)
and the scheduler/timing fix (#18, main `fa1efe1`).
PR #16 was merged before rebasing onto the just-landed step 3; this combined
check supplies the integration proof that should have preceded that merge.

A concurrent Node/browser check attempt timed out the unchanged 5-second
whole-song instrument-removal Node test; it was not called green. The Node
gate was then run separately, matching CI’s sequential commands. This
[overlap observation](https://github.com/FireLakeLabs/ghost-notes/issues/11#issuecomment-6865970256)
is distinct from #18’s overloaded browser-deletion experiment. No limits were
increased. #18’s exceptional live-commit rollback path remains unverified.
