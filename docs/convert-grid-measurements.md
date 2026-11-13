# Chosen-grid conversion measurements

2026-11-13, all six local songs, six stems each, chosen 1× beat maps. No source
names, paths, notes or generated programs are retained. One deterministic
all-stem run per option; these are score comparisons, not speed benchmarks.

Each source either emits once or contributes to a recorded same-pitch merge.
Every emitted event's pitch, gain, onset and effective end matched the written
records through real pinned Strudel, both before and after ODM import/generation.
There were no missing or duplicated events. Exact mode retains the separate
MIDI pitch/gain multiplicity check in `tests/convert-local.test.ts`.

Changes below are record counts: M = moved, B = moved across a bar line (sustain
end), S = shortened, G = merge groups. Records overlap; G is not the count of
removed events. “Merged” counts contributors beyond their representative.
Moved % uses all source notes; onset error includes those contributors.
Errors are median / p95 / maximum, nearest rank, measured against notes JSON.
Bytes sum six standalone programs, including silent spans and instrument markers.
Uncovered edges retain exact mode at every setting; their beat units extrapolate
the nearest observed interval for measurement only. Musical bar ownership clamps
late notes to the preceding step, so maxima can approach a full step.

| Input                      | Grid (steps/beat) | Notes | Once | Merged | M / B / S / G           | Moved % | Error ms (median / p95 / max) | Error beats (median / p95 / max) |  Code B |
| -------------------------- | ----------------: | ----: | ---: | -----: | ----------------------- | ------: | ----------------------------- | -------------------------------- | ------: |
| first test session, song 1 |                 1 |  1433 | 1015 |    418 | 1406 / 84 / 1 / 279     |   98.12 | 220.500 / 840.000 / 2070.000  | 0.259767 / 0.883429 / 0.999884   |  66,297 |
| first test session, song 1 |                 2 |  1433 | 1231 |    202 | 1388 / 80 / 35 / 160    |   96.86 | 90.300 / 400.000 / 1020.000   | 0.104886 / 0.383429 / 0.499884   |  78,698 |
| first test session, song 1 |                 3 |  1433 | 1298 |    135 | 1406 / 79 / 117 / 114   |   98.12 | 71.400 / 253.333 / 670.000    | 0.083977 / 0.216762 / 0.333217   |  85,188 |
| first test session, song 1 |                 4 |  1433 | 1357 |     76 | 1384 / 77 / 235 / 67    |   96.58 | 38.300 / 185.000 / 495.000    | 0.044643 / 0.133429 / 0.249884   |  91,002 |
| first test session, song 1 |                 6 |  1433 | 1397 |     36 | 1387 / 76 / 485 / 32    |   96.79 | 30.000 / 113.333 / 320.000    | 0.034884 / 0.082689 / 0.166550   | 101,034 |
| first test session, song 1 |                 8 |  1433 | 1419 |     14 | 1384 / 73 / 739 / 13    |   96.58 | 22.000 / 80.000 / 232.500     | 0.025465 / 0.062093 / 0.124884   | 110,157 |
| first test session, song 1 |                16 |  1433 | 1432 |      1 | 1383 / 61 / 1297 / 1    |   96.51 | 12.950 / 32.500 / 101.250     | 0.015341 / 0.030476 / 0.062384   | 147,402 |
| first test session, song 1 |             exact |  1433 | 1433 |      0 | 1382 / 0 / 0 / 0        |   96.44 | 0.277 / 0.792 / 0.977         | 0.000322 / 0.000916 / 0.000973   |  97,939 |
| first test session, song 2 |                 1 |  2203 | 1727 |    476 | 2152 / 166 / 18 / 335   |   97.68 | 116.700 / 417.900 / 520.000   | 0.230600 / 0.839583 / 0.999000   | 113,600 |
| first test session, song 2 |                 2 |  2203 | 2011 |    192 | 2116 / 164 / 148 / 180  |   96.05 | 31.000 / 170.000 / 250.000    | 0.062000 / 0.339583 / 0.499000   | 130,976 |
| first test session, song 2 |                 3 |  2203 | 2071 |    132 | 2152 / 158 / 462 / 132  |   97.68 | 40.333 / 94.967 / 182.500     | 0.080667 / 0.172917 / 0.332333   | 140,297 |
| first test session, song 2 |                 4 |  2203 | 2184 |     19 | 2114 / 151 / 884 / 19   |   95.96 | 20.000 / 64.400 / 182.500     | 0.040000 / 0.123846 / 0.249000   | 148,325 |
| first test session, song 2 |                 6 |  2203 | 2197 |      6 | 2114 / 141 / 2058 / 6   |   95.96 | 20.000 / 41.567 / 124.400     | 0.040000 / 0.082533 / 0.165667   | 153,733 |
| first test session, song 2 |                 8 |  2203 | 2200 |      3 | 2114 / 122 / 2061 / 3   |   95.96 | 16.000 / 30.800 / 89.600      | 0.031600 / 0.061200 / 0.124000   | 180,140 |
| first test session, song 2 |                16 |  2203 | 2203 |      0 | 2113 / 22 / 2067 / 0    |   95.91 | 9.300 / 15.000 / 30.800       | 0.018500 / 0.030000 / 0.061500   | 278,294 |
| first test session, song 2 |             exact |  2203 | 2203 |      0 | 2109 / 2 / 0 / 0        |   95.73 | 0.273 / 0.469 / 0.947         | 0.000547 / 0.000937 / 0.000975   | 152,090 |
| first test session, song 3 |                 1 |  1805 | 1555 |    250 | 1693 / 195 / 26 / 233   |   93.80 | 87.800 / 370.000 / 410.000    | 0.230750 / 0.950000 / 0.999737   | 100,532 |
| first test session, song 3 |                 2 |  1805 | 1746 |     59 | 1677 / 192 / 296 / 59   |   92.91 | 30.000 / 180.000 / 200.000    | 0.078684 / 0.450000 / 0.499737   | 110,613 |
| first test session, song 3 |                 3 |  1805 | 1795 |     10 | 1693 / 184 / 731 / 10   |   93.80 | 30.000 / 113.333 / 132.033    | 0.078947 / 0.283333 / 0.333070   | 115,313 |
| first test session, song 3 |                 4 |  1805 | 1804 |      1 | 1677 / 159 / 1439 / 1   |   92.91 | 20.000 / 80.000 / 98.700      | 0.052632 / 0.200000 / 0.249737   | 111,626 |
| first test session, song 3 |                 6 |  1805 | 1805 |      0 | 1677 / 159 / 1757 / 0   |   92.91 | 16.933 / 46.667 / 65.367      | 0.044167 / 0.116667 / 0.166404   | 133,085 |
| first test session, song 3 |                 8 |  1805 | 1805 |      0 | 1676 / 28 / 1586 / 0    |   92.85 | 11.300 / 30.000 / 48.700      | 0.029500 / 0.075000 / 0.124737   | 154,046 |
| first test session, song 3 |                16 |  1805 | 1805 |      0 | 1676 / 15 / 1642 / 0    |   92.85 | 5.800 / 11.800 / 23.700       | 0.015250 / 0.030526 / 0.062237   | 246,320 |
| first test session, song 3 |             exact |  1805 | 1805 |      0 | 1676 / 0 / 0 / 0        |   92.85 | 0.174 / 0.352 / 0.406         | 0.000452 / 0.000925 / 0.000975   | 126,896 |
| first test session, song 4 |                 1 |  3282 | 2129 |   1153 | 3252 / 239 / 130 / 788  |   99.09 | 130.500 / 403.300 / 533.900   | 0.271296 / 0.829423 / 0.998846   | 121,656 |
| first test session, song 4 |                 2 |  3282 | 2777 |    505 | 3212 / 229 / 598 / 458  |   97.87 | 39.100 / 142.700 / 263.900    | 0.081731 / 0.329423 / 0.498846   | 147,584 |
| first test session, song 4 |                 3 |  3282 | 3053 |    229 | 3252 / 216 / 1253 / 228 |   99.09 | 42.267 / 89.800 / 173.900     | 0.090926 / 0.166667 / 0.332179   | 158,229 |
| first test session, song 4 |                 4 |  3282 | 3257 |     25 | 3209 / 201 / 1802 / 25  |   97.78 | 20.000 / 64.700 / 129.400     | 0.040385 / 0.124444 / 0.248846   | 169,298 |
| first test session, song 4 |                 6 |  3282 | 3282 |      0 | 3212 / 176 / 3237 / 0   |   97.87 | 20.000 / 43.200 / 86.067      | 0.041296 / 0.083148 / 0.165513   | 171,556 |
| first test session, song 4 |                 8 |  3282 | 3282 |      0 | 3209 / 138 / 3240 / 0   |   97.78 | 15.600 / 32.200 / 64.400      | 0.034630 / 0.061852 / 0.123846   | 193,464 |
| first test session, song 4 |                16 |  3282 | 3282 |      0 | 3207 / 27 / 3198 / 0    |   97.71 | 7.500 / 15.400 / 31.900       | 0.016154 / 0.029808 / 0.061346   | 295,269 |
| first test session, song 4 |             exact |  3282 | 3282 |      0 | 3211 / 1 / 0 / 0        |   97.84 | 0.227 / 0.472 / 0.527         | 0.000498 / 0.000907 / 0.000975   | 219,098 |
| diversity-1                |                 1 |  3947 | 2909 |   1038 | 3930 / 732 / 125 / 725  |   99.57 | 202.600 / 620.000 / 950.400   | 0.316562 / 0.968750 / 0.999844   | 211,370 |
| diversity-1                |                 2 |  3947 | 3464 |    483 | 3921 / 693 / 868 / 405  |   99.34 | 86.500 / 300.000 / 470.400    | 0.135417 / 0.468750 / 0.499844   | 223,170 |
| diversity-1                |                 3 |  3947 | 3674 |    273 | 3930 / 598 / 1497 / 264 |   99.57 | 52.433 / 193.333 / 310.400    | 0.082121 / 0.302083 / 0.333177   | 234,831 |
| diversity-1                |                 4 |  3947 | 3821 |    126 | 3919 / 533 / 2028 / 126 |   99.29 | 22.700 / 140.000 / 230.400    | 0.035156 / 0.218750 / 0.249844   | 246,085 |
| diversity-1                |                 6 |  3947 | 3938 |      9 | 3921 / 448 / 2798 / 9   |   99.34 | 26.433 / 86.667 / 150.400     | 0.041250 / 0.135417 / 0.166510   | 269,425 |
| diversity-1                |                 8 |  3947 | 3946 |      1 | 3918 / 376 / 3891 / 1   |   99.27 | 18.700 / 60.000 / 110.400     | 0.029219 / 0.093750 / 0.124844   | 290,824 |
| diversity-1                |                16 |  3947 | 3947 |      0 | 3905 / 107 / 3927 / 0   |   98.94 | 10.500 / 20.500 / 50.400      | 0.016562 / 0.031250 / 0.062344   | 425,854 |
| diversity-1                |             exact |  3947 | 3947 |      0 | 3258 / 2 / 0 / 0        |   82.54 | 0.255 / 0.600 / 0.925         | 0.000402 / 0.000937 / 0.000975   | 269,880 |
| diversity-2                |                 1 |  1377 | 1082 |    295 | 1336 / 80 / 7 / 228     |   97.02 | 190.000 / 663.900 / 760.000   | 0.252763 / 0.862105 / 0.999324   |  71,587 |
| diversity-2                |                 2 |  1377 | 1258 |    119 | 1292 / 79 / 25 / 107    |   93.83 | 63.100 / 275.200 / 374.600    | 0.084079 / 0.362105 / 0.499324   |  84,322 |
| diversity-2                |                 3 |  1377 | 1303 |     74 | 1336 / 79 / 96 / 72     |   97.02 | 68.333 / 148.533 / 247.933    | 0.090570 / 0.195439 / 0.332658   |  92,329 |
| diversity-2                |                 4 |  1377 | 1344 |     33 | 1279 / 78 / 195 / 33    |   92.88 | 20.000 / 95.600 / 184.600     | 0.027027 / 0.124079 / 0.249324   |  99,070 |
| diversity-2                |                 6 |  1377 | 1375 |      2 | 1292 / 77 / 508 / 2     |   93.83 | 23.200 / 64.400 / 122.833     | 0.031360 / 0.083333 / 0.165991   | 110,833 |
| diversity-2                |                 8 |  1377 | 1374 |      3 | 1279 / 77 / 1279 / 3    |   92.88 | 16.700 / 47.500 / 92.000      | 0.022368 / 0.062368 / 0.124324   | 112,789 |
| diversity-2                |                16 |  1377 | 1377 |      0 | 1278 / 9 / 1293 / 0     |   92.81 | 10.000 / 23.250 / 45.750      | 0.013158 / 0.030658 / 0.061824   | 174,525 |
| diversity-2                |             exact |  1377 | 1377 |      0 | 1278 / 0 / 0 / 0        |   92.81 | 0.391 / 0.703 / 0.761         | 0.000514 / 0.000925 / 0.000976   |  95,053 |

## Choice and editor check

Default: **4 steps per beat (sixteenths)**, decided for the owner as G67.
Coarse settings remove more events through merging; fine settings preserve more
onset detail but make larger text and denser editing targets. Exact remains
available. This is an editable starting point, not a musical accuracy claim.

Observed in Chromium at 1280×800 with synthetic sequences: the rhythm editor's
Boxes region was 1154 px wide. Sixteen steps appeared together; 64 steps zoomed
to the selected first part with a whole-cycle overview. Source inspection confirms
20 px minimum mouse targets and 44 px touch targets (`rhythmZoom`): 16 steps
need 320/704 px; 64 need 1280/2816 px. List mode and keyboard navigation remain
available. Synthetic conversion tests edit pitch and gain through ODM operations
and query the changed output. No new browser test was added to the timed suite.

## Reproduce and limits

Use Node 24.22.2 and npm. Run each option and anonymous song separately; no test or suite budget is raised:

```sh
for grid in 1 2 3 4 6 8 16 exact; do
  for song in 1 2 3 4 5 6; do
    GHOST_CONVERT_ROOT="$HOME/projects/ghost-notes/reference" GHOST_CONVERT_GRID="$grid" GHOST_CONVERT_SONG="$song" npm test -- tests/convert-grid-local.test.ts --silent=false || exit 1
  done
done
```

Exact mode's original MIDI/notes proof:

```sh
GHOST_CONVERT_ROOT="$HOME/projects/ghost-notes/reference" npm test -- tests/convert-local.test.ts --silent=false
```

Absent local material skips; CI covers invented notes, triplets, pickup, near-end
clamping, collisions, durations, ranges, sustain-end boundaries and ODM edits.
This measures score events and text size. Transcription accuracy, musical
correctness, scheduling against stems, speaker timing, perceived output, mobile
usability and real-song interaction in a completed lens were not measured.
Grid uncertainty and the pickup replay limit remain (G37/G54).

The initial all-song grid-16 command exceeded its 55-second local-test limit.
The final run selects one anonymous song per command, retaining that limit and
the 60-second Node-suite budget. No failed run is counted as proof. A later
shell interruption stopped the batch after its 41st completed case; the remaining
seven cases were run explicitly, each with passing exit status.
