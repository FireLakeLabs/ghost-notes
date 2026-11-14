# Playback

Step 9 implements beat-map scheduling and the row speakers/presets. The
[row control contract and integrated proof](row-playback.md) cover part 2;
the original transport evidence below remains part 1's measured scope.

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
literal converter's exact-mode snapping. Counts and pitch/settings equality are checked.

| Input                      | Notes | Warp max ms | Source median / p95 / max ms | Chord pairs | Split ms |
| -------------------------- | ----: | ----------: | ---------------------------: | ----------: | -------: |
| First test session, song 1 |  1433 | 0.000000710 |  .276563 / .792187 / .976563 |         153 |        0 |
| First test session, song 2 |  2203 | 0.000027024 |  .273437 / .468750 / .946875 |         304 |        0 |
| First test session, song 3 |  1805 | 0.000000705 |  .174219 / .351563 / .406250 |         263 |        0 |
| First test session, song 4 |  3282 | 0.000012059 |  .226563 / .471875 / .526563 |         589 |        0 |
| diversity-1                |  3947 | 0.000002424 |  .254687 / .600000 / .925000 |         364 |        0 |
| diversity-2                |  1377 | 0.000001516 |  .390625 / .703125 / .760938 |         226 |        0 |

These are queried event times, not browser, audio-device or perceived timing.
The browser scheduling proof below covers the integrated transport.

Known voice limit: pinned superdough's `sbd` and wavetable voices multiply short
legato a second time inside their envelopes. Warping normalizes explicit legato
to an effective duration, so those voices use that duration rather than the
upstream double multiplication. Plain samples retain their unset clip and play
full slices; converted synth notes and drum samples are covered above. Envelope
and speaker behavior are not established by the onset timing proof.

## Playback API for the timeline and copy panel

Import `createSongPlayback` from `src/engine/playback.ts`. Construct it with the
current `ReferenceSong` and step 5's retained `audio` map (`StemAudio<AudioBuffer>`).
Dispose the old instance before opening another song or changing the chosen grid;
construct a fresh one for the new grid. The API does not mutate a document or
encode export tempos. Step 10 still owns per-place tempo in copied Strudel.

- `play({code, fromBar?, mode?, stemIds?})`: full song code, with cycle zero as
  `conversionSpans` defines it. The default mode is `both`; `recording` does not
  evaluate Mine. `mine` schedules no stems. `stemIds` selects recording stems,
  defaulting to all; row controls can generate the corresponding Mine code.
- Omit `fromBar` to include uncovered leading audio and bar 0. An explicit bar
  seeks to its exact start seconds. It restarts transport, schedules fresh buffer
  sources at that offset and uses a fresh clock origin. It does not retrigger
  sustained notes that began earlier. Replay starts the pickup from the beginning.
- `update(code)` preserves the clock and recording sources during a live Mine
  revision. Its revision promise and `swapped`/`committed` events have ODM's
  semantics. Rejected edits retain the previous revision. Call it only while
  playback is running. Recording commits silence without evaluating the new
  code, so document editing remains possible while monitoring stems.
- `stop()` cancels pending starts, stops the scheduler and stem sources, and
  clears the end timer. Previously scheduled voices/effect tails follow ODM's
  existing behavior. Playback ends at the full grid mapping's end, including
  uncovered edges and converted note tails, with no automatic loop.
- `dispose()` stops playback, cancels outstanding query workers and releases the
  output-tap worklet and its rolling PCM buffer. Disposed instances cannot play
  again. It keeps the shared AudioContext available for the next transport.
- `state()` returns `playing`, active recording stem IDs, `mine`, and `position`
  (reference seconds, bar and zero-based `beatInBar`, with `detected`/`gap`/
  `uncovered` status). Stopped position is null; edges do not invent beats.
- `subscribe(listener)` returns an unsubscribe function. Trigger, swap and
  committed events report source musical cycles and audio-clock seconds;
  `state().position` follows the current audio clock, independently of lookahead.

The scheduler stays at one cycle per second. Pattern queries run in musical
cycles; returned onsets and effective durations run in recording seconds.
The warp precedes the inherited late-window recovery and safety guards. A new
clock-start hook uses the scheduler's actual phase plus latency, including its
rounding, to start every retained stem in Strudel's own AudioContext. Merely
calling `currentTime` twice would not establish the same origin.

Part 2 adds a canonical `fromCycle` start, mutually exclusive with `fromBar`,
and a read-only canonical `clock` port for the existing editor/controller. The
optional third constructor argument supplies selected Mine ids and finite
reference voices. The audio seam filters tagged Mine after full evaluation,
then adds MIDI/Notes before the same warp. Preflight checks selected values
and refuses unattributed Mine onsets. The default API without that argument
retains part 1's behavior.

## Browser proof

`npm run test:browser -- ci tests/browser/playback.spec.ts --no-deps` runs a
real advancing Chromium audio clock. It captures superdough sound trigger times
and native `AudioBufferSourceNode.start` calls for two synthetic retained stems,
decoded through step 5 and kept after closing their decoding context. No trigger
or source is replaced with a timing stub; capture forwards the original calls.

| Measurement                                  |                 Result |
| -------------------------------------------- | ---------------------: |
| Whole fixture song / note triggers           |         8 seconds / 28 |
| Maximum added schedule error vs written grid |                   0 ms |
| Maximum error including exact conversion     |            0.390625 ms |
| Maximum simultaneous chord split             |                   0 ms |
| Maximum stem-start deviation                 |                   0 ms |
| Bar 2 note vs stem seek start                |                   0 ms |
| Minimum trigger scheduling lead              |              88.633 ms |
| Targeted command / test time                 | 11.088 / 9.243 seconds |

The 1 ms tolerance is far below this observed scheduling lead. Both stems run at
rate 1. A live tempo-setting revision retains their phase; the whole-song count
has no dropped or duplicate notes. Stop, bar seek, pickup restart, active bar
position and all three API modes are checked. Recording mode never evaluates
Mine. The fixture includes within-bar drift, tempo changes, a gap and uncovered
edges. Values above are scheduled AudioContext times, not audio-device timing.
Speaker output, perceived timing and every sample/synth envelope remain unverified.
