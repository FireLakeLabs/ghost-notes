# Playback

Step 9 part 1 implements beat-map scheduling; row speakers and presets in the
interface belong to part 2. Issue #7 stays open.

## Node proof

`npm test -- tests/warp.test.ts` queries pinned Strudel over the whole invented
song and again in 50 ms windows. The 28 notes include chords, pickup, tempo
changes, a long marked gap, sustained tails and uncovered edges. Every note is
retained, chord split is zero, and maximum onset error from the original fixture
is 0.390625 ms (including literal conversion). Sustains retain their seconds
length across tempo changes. The warp follows within-bar beat times too.

The opt-in local proof never prints source names, paths, notes or conversions:

```sh
GHOST_CONVERT_ROOT="$HOME/projects/ghost-notes/reference" npm test -- tests/warp-local.test.ts --silent=false
```

All stems, first pass, all six songs. Errors are absolute milliseconds;
percentiles use nearest rank. Warp error compares each queried warped onset to
the grid's time of the original Strudel onset. Source error also includes the
literal converter's snapping. Counts and pitch/settings equality are checked.

| Input                      | Notes | Warp max ms | Source median / p95 / max ms | Chord pairs | Split ms |
| -------------------------- | ----: | ----------: | ---------------------------: | ----------: | -------: |
| First test session, song 1 |  1433 | 0.000000710 |  .276563 / .792187 / .976563 |         153 |        0 |
| First test session, song 2 |  2203 | 0.000027024 |  .273437 / .468750 / .946875 |         304 |        0 |
| First test session, song 3 |  1805 | 0.000000705 |  .174219 / .351563 / .406250 |         263 |        0 |
| First test session, song 4 |  3282 | 0.000012059 |  .226563 / .471875 / .526563 |         589 |        0 |
| diversity-1                |  3947 | 0.000002424 |  .254687 / .600000 / .925000 |         364 |        0 |
| diversity-2                |  1377 | 0.000001516 |  .390625 / .703125 / .760938 |         226 |        0 |

These are queried event times, not browser, audio-device or perceived timing.
Browser scheduling and the public transport API are the next integration layer.

Known voice limit: pinned superdough's `sbd` and wavetable voices multiply short
legato a second time inside their envelopes. Warping normalizes explicit legato
to an effective duration, so those voices use that duration rather than the
upstream double multiplication. Plain samples retain their unset clip and play
full slices; converted synth notes and drum samples are covered above. Envelope
and speaker behavior are not established by the onset timing proof.
