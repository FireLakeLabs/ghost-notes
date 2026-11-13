# Simplify measurements

Pre-integration baseline, 2026-11-13: exact converter on the chosen 1× bar grid.
All six songs, all 36 stems; every emitted candidate queried through pinned
Strudel and compared with its claimed onset, pitch, gain and effective end.
No private notes or source code retained. Default-grid results will replace
this baseline after #23 lands. No listening or playback timing measured.

## Onset-only study reproduction

| Input                      | Bars | Exact → tolerant | Literal → compressed characters |
| -------------------------- | ---: | ---------------: | ------------------------------: |
| first test session, song 1 |   33 |          26 → 17 |                     2226 → 1687 |
| first test session, song 2 |   73 |          53 → 25 |                     4903 → 2650 |
| first test session, song 3 |   80 |          44 → 24 |                     4655 → 2645 |
| first test session, song 4 |   82 |          60 → 42 |                     5350 → 4310 |
| diversity-1                |  121 |          60 → 34 |                     6946 → 3758 |
| diversity-2                |   63 |          62 → 57 |                     3819 → 5259 |

The current Python study script and the TypeScript reproduction agree on song 3:
44 → 24, 4,655 → 2,645 (43.2% shorter). The written study says 26 / 2,772;
that historical number could not be reproduced on this corpus. Python uses
ties-to-even snapping. These onset-only figures omit duration/gain and exclude
uncovered edges; they are not full-note simplification results.

## Full-note proposals

Keys/other aggregates guitar, other, piano and vocals, including empty stems.
Each percentage uses summed matched counts and denominators, never averaged
percentages. M/S/G/D/A are moved, shortened, merged, dropped and added records;
one note can have multiple marks. These include converter changes.

| Input                      | Instrument | Technique      | Original / proposed / matched |  Kept / match % | Literal → proposed bytes | M/S/G/D/A    |
| -------------------------- | ---------- | -------------- | ----------------------------: | --------------: | -----------------------: | ------------ |
| first test session, song 1 | bass       | stray-notes    |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 21860 | 291/0/0/0/0  |
| first test session, song 1 | bass       | split-notes    |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 21860 | 291/0/0/0/0  |
| first test session, song 1 | bass       | octave-errors  |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 21860 | 291/0/0/0/0  |
| first test session, song 1 | bass       | interval-riffs |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 22255 | 291/0/0/0/0  |
| first test session, song 1 | bass       | scale-degrees  |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 22257 | 291/0/0/0/0  |
| first test session, song 1 | bass       | euclidean-fits |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 21854 | 291/0/0/0/0  |
| first test session, song 1 | bass       | phrase-repeats |               291 / 291 / 291 | 100.00 / 100.00 |            19431 → 21541 | 291/0/0/0/0  |
| first test session, song 1 | drums      | drum-bars      |               405 / 405 / 405 | 100.00 / 100.00 |            28141 → 30411 | 358/0/0/0/0  |
| first test session, song 1 | keys/other | stray-notes    |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 56186 | 733/0/0/0/0  |
| first test session, song 1 | keys/other | split-notes    |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 56186 | 733/0/0/0/0  |
| first test session, song 1 | keys/other | octave-errors  |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 56186 | 733/0/0/0/0  |
| first test session, song 1 | keys/other | interval-riffs |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 57462 | 733/0/0/0/0  |
| first test session, song 1 | keys/other | scale-degrees  |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 57228 | 733/0/0/0/0  |
| first test session, song 1 | keys/other | euclidean-fits |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 56179 | 733/0/0/0/0  |
| first test session, song 1 | keys/other | phrase-repeats |               737 / 737 / 737 | 100.00 / 100.00 |            50367 → 55362 | 733/0/0/0/0  |
| first test session, song 2 | bass       | stray-notes    |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 22016 | 280/0/0/0/0  |
| first test session, song 2 | bass       | split-notes    |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 22016 | 280/0/0/0/0  |
| first test session, song 2 | bass       | interval-riffs |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 22826 | 280/0/0/0/0  |
| first test session, song 2 | bass       | octave-errors  |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 22016 | 280/0/0/0/0  |
| first test session, song 2 | bass       | scale-degrees  |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 23093 | 280/0/0/0/0  |
| first test session, song 2 | bass       | euclidean-fits |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 22002 | 280/0/0/0/0  |
| first test session, song 2 | bass       | phrase-repeats |               280 / 280 / 280 | 100.00 / 100.00 |            19342 → 20935 | 280/0/0/0/0  |
| first test session, song 2 | drums      | drum-bars      |               806 / 806 / 806 | 100.00 / 100.00 |            55719 → 58678 | 716/0/0/0/0  |
| first test session, song 2 | keys/other | stray-notes    |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 87099 | 1113/0/0/0/0 |
| first test session, song 2 | keys/other | split-notes    |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 87099 | 1113/0/0/0/0 |
| first test session, song 2 | keys/other | octave-errors  |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 87099 | 1113/0/0/0/0 |
| first test session, song 2 | keys/other | interval-riffs |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 90277 | 1113/0/0/0/0 |
| first test session, song 2 | keys/other | euclidean-fits |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 87035 | 1113/0/0/0/0 |
| first test session, song 2 | keys/other | scale-degrees  |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 90780 | 1113/0/0/0/0 |
| first test session, song 2 | keys/other | phrase-repeats |            1117 / 1117 / 1117 | 100.00 / 100.00 |            77029 → 83648 | 1113/0/0/0/0 |
| first test session, song 3 | bass       | stray-notes    |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 35138 | 460/0/0/0/0  |
| first test session, song 3 | bass       | split-notes    |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 35138 | 460/0/0/0/0  |
| first test session, song 3 | bass       | octave-errors  |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 35138 | 460/0/0/0/0  |
| first test session, song 3 | bass       | interval-riffs |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 36101 | 460/0/0/0/0  |
| first test session, song 3 | bass       | euclidean-fits |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 35105 | 460/0/0/0/0  |
| first test session, song 3 | bass       | scale-degrees  |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 36213 | 460/0/0/0/0  |
| first test session, song 3 | bass       | phrase-repeats |               461 / 461 / 461 | 100.00 / 100.00 |            31005 → 34054 | 460/0/0/0/0  |
| first test session, song 3 | drums      | drum-bars      |               645 / 645 / 645 | 100.00 / 100.00 |            45101 → 48954 | 518/0/0/0/0  |
| first test session, song 3 | keys/other | stray-notes    |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 54779 | 698/0/0/0/0  |
| first test session, song 3 | keys/other | split-notes    |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 54779 | 698/0/0/0/0  |
| first test session, song 3 | keys/other | octave-errors  |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 54779 | 698/0/0/0/0  |
| first test session, song 3 | keys/other | interval-riffs |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 56575 | 698/0/0/0/0  |
| first test session, song 3 | keys/other | scale-degrees  |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 56424 | 698/0/0/0/0  |
| first test session, song 3 | keys/other | euclidean-fits |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 54744 | 698/0/0/0/0  |
| first test session, song 3 | keys/other | phrase-repeats |               699 / 699 / 699 | 100.00 / 100.00 |            50790 → 52720 | 698/0/0/0/0  |
| first test session, song 4 | bass       | split-notes    |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 29330 | 384/0/0/0/0  |
| first test session, song 4 | bass       | stray-notes    |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 29330 | 384/0/0/0/0  |
| first test session, song 4 | bass       | interval-riffs |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 30008 | 384/0/0/0/0  |
| first test session, song 4 | bass       | octave-errors  |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 29330 | 384/0/0/0/0  |
| first test session, song 4 | bass       | euclidean-fits |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 29319 | 384/0/0/0/0  |
| first test session, song 4 | bass       | scale-degrees  |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 29684 | 384/0/0/0/0  |
| first test session, song 4 | bass       | phrase-repeats |               385 / 385 / 385 | 100.00 / 100.00 |            25823 → 28919 | 384/0/0/0/0  |
| first test session, song 4 | drums      | drum-bars      |               858 / 858 / 858 | 100.00 / 100.00 |            57613 → 63606 | 792/0/0/0/0  |
| first test session, song 4 | keys/other | split-notes    |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 151285 | 2035/0/0/0/0 |
| first test session, song 4 | keys/other | stray-notes    |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 151285 | 2035/0/0/0/0 |
| first test session, song 4 | keys/other | interval-riffs |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 153059 | 2035/0/0/0/0 |
| first test session, song 4 | keys/other | octave-errors  |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 151285 | 2035/0/0/0/0 |
| first test session, song 4 | keys/other | euclidean-fits |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 151254 | 2035/0/0/0/0 |
| first test session, song 4 | keys/other | scale-degrees  |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 149187 | 2035/0/0/0/0 |
| first test session, song 4 | keys/other | phrase-repeats |            2039 / 2039 / 2039 | 100.00 / 100.00 |          135662 → 150417 | 2035/0/0/0/0 |
| diversity-1                | bass       | stray-notes    |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 35273 | 418/0/0/0/0  |
| diversity-1                | bass       | split-notes    |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 35273 | 418/0/0/0/0  |
| diversity-1                | bass       | octave-errors  |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 35273 | 418/0/0/0/0  |
| diversity-1                | bass       | interval-riffs |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 37809 | 418/0/0/0/0  |
| diversity-1                | bass       | scale-degrees  |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 37767 | 418/0/0/0/0  |
| diversity-1                | bass       | euclidean-fits |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 35229 | 418/0/0/0/0  |
| diversity-1                | bass       | phrase-repeats |               434 / 434 / 434 | 100.00 / 100.00 |            29975 → 32709 | 418/0/0/0/0  |
| diversity-1                | drums      | drum-bars      |               944 / 944 / 944 | 100.00 / 100.00 |            65190 → 63916 | 331/0/0/0/0  |
| diversity-1                | keys/other | split-notes    |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 195968 | 2509/0/0/0/0 |
| diversity-1                | keys/other | stray-notes    |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 195968 | 2509/0/0/0/0 |
| diversity-1                | keys/other | octave-errors  |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 195968 | 2509/0/0/0/0 |
| diversity-1                | keys/other | interval-riffs |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 203915 | 2509/0/0/0/0 |
| diversity-1                | keys/other | euclidean-fits |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 195650 | 2509/0/0/0/0 |
| diversity-1                | keys/other | scale-degrees  |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 199507 | 2509/0/0/0/0 |
| diversity-1                | keys/other | phrase-repeats |            2569 / 2569 / 2569 | 100.00 / 100.00 |          174715 → 190019 | 2509/0/0/0/0 |
| diversity-2                | bass       | stray-notes    |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 12872 | 164/0/0/0/0  |
| diversity-2                | bass       | split-notes    |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 12872 | 164/0/0/0/0  |
| diversity-2                | bass       | octave-errors  |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 12872 | 164/0/0/0/0  |
| diversity-2                | bass       | interval-riffs |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 13361 | 164/0/0/0/0  |
| diversity-2                | bass       | euclidean-fits |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 12865 | 164/0/0/0/0  |
| diversity-2                | bass       | scale-degrees  |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 13594 | 164/0/0/0/0  |
| diversity-2                | bass       | phrase-repeats |               164 / 164 / 164 | 100.00 / 100.00 |            11379 → 12386 | 164/0/0/0/0  |
| diversity-2                | drums      | drum-bars      |               561 / 561 / 561 | 100.00 / 100.00 |            38122 → 41422 | 464/0/0/0/0  |
| diversity-2                | keys/other | split-notes    |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 50909 | 650/0/0/0/0  |
| diversity-2                | keys/other | stray-notes    |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 50909 | 650/0/0/0/0  |
| diversity-2                | keys/other | octave-errors  |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 50909 | 650/0/0/0/0  |
| diversity-2                | keys/other | interval-riffs |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 52426 | 650/0/0/0/0  |
| diversity-2                | keys/other | euclidean-fits |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 50889 | 650/0/0/0/0  |
| diversity-2                | keys/other | scale-degrees  |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 51920 | 650/0/0/0/0  |
| diversity-2                | keys/other | phrase-repeats |               652 / 652 / 652 | 100.00 / 100.00 |            45552 → 49196 | 650/0/0/0/0  |

## Default-limit trials

All six songs, every pitched stem: weak velocity thresholds with the same 80 ms stray, 30 ms split-gap and 200 ms octave limits. Each cell is dropped / joined groups / pitch corrections. Trials are measured data transformations; only default proposals above are runtime queried. A joined group is not a dropped source ID. Default 32 avoids asserting any of these uncertain repairs on this corpus; 48 and 64 remain user choices.

| Input                      | Velocity <32 | <48     | <64      |
| -------------------------- | ------------ | ------- | -------- |
| first test session, song 1 | 0/0/0        | 11/11/0 | 41/47/4  |
| first test session, song 2 | 0/0/0        | 7/21/1  | 10/83/3  |
| first test session, song 3 | 0/0/0        | 17/9/3  | 42/67/9  |
| first test session, song 4 | 0/0/0        | 13/32/2 | 26/178/2 |
| diversity-1                | 0/0/0        | 4/16/2  | 12/160/2 |
| diversity-2                | 0/0/0        | 1/6/0   | 11/26/2  |

Drum movement/fill trials, with 10% source-drop/add budgets, unchanged matched gain and Jaccard 0.25. Each cell is proposed notes / matched source notes / drops / additions / UTF-8 bytes. The default is 50 ms with fills protected. A larger endpoint limit does not establish a better suggestion.

| Input                      | Max ms | Fills protected | Notes / matched / dropped / added / bytes |
| -------------------------- | -----: | --------------- | ----------------------------------------- |
| first test session, song 1 |     25 | True            | 405/405/0/0/30411                         |
| first test session, song 1 |     25 | False           | 405/405/0/0/30411                         |
| first test session, song 1 |     50 | True            | 405/405/0/0/30411                         |
| first test session, song 1 |     50 | False           | 405/405/0/0/30411                         |
| first test session, song 1 |    100 | True            | 405/405/0/0/30411                         |
| first test session, song 1 |    100 | False           | 405/405/0/0/30411                         |
| first test session, song 2 |     25 | True            | 806/806/0/0/58678                         |
| first test session, song 2 |     25 | False           | 806/806/0/0/58678                         |
| first test session, song 2 |     50 | True            | 806/806/0/0/58678                         |
| first test session, song 2 |     50 | False           | 806/806/0/0/58678                         |
| first test session, song 2 |    100 | True            | 806/806/0/0/58678                         |
| first test session, song 2 |    100 | False           | 806/806/0/0/58678                         |
| first test session, song 3 |     25 | True            | 645/645/0/0/48954                         |
| first test session, song 3 |     25 | False           | 645/645/0/0/48954                         |
| first test session, song 3 |     50 | True            | 645/645/0/0/48954                         |
| first test session, song 3 |     50 | False           | 645/645/0/0/48954                         |
| first test session, song 3 |    100 | True            | 645/645/0/0/48954                         |
| first test session, song 3 |    100 | False           | 645/645/0/0/48954                         |
| first test session, song 4 |     25 | True            | 858/858/0/0/63606                         |
| first test session, song 4 |     25 | False           | 858/858/0/0/63606                         |
| first test session, song 4 |     50 | True            | 858/858/0/0/63606                         |
| first test session, song 4 |     50 | False           | 858/858/0/0/63606                         |
| first test session, song 4 |    100 | True            | 858/858/0/0/63606                         |
| first test session, song 4 |    100 | False           | 858/858/0/0/63606                         |
| diversity-1                |     25 | True            | 944/944/0/0/63916                         |
| diversity-1                |     25 | False           | 944/944/0/0/63916                         |
| diversity-1                |     50 | True            | 944/944/0/0/63916                         |
| diversity-1                |     50 | False           | 944/944/0/0/63916                         |
| diversity-1                |    100 | True            | 944/944/0/0/63916                         |
| diversity-1                |    100 | False           | 944/944/0/0/63916                         |
| diversity-2                |     25 | True            | 561/561/0/0/41422                         |
| diversity-2                |     25 | False           | 561/561/0/0/41422                         |
| diversity-2                |     50 | True            | 561/561/0/0/41422                         |
| diversity-2                |     50 | False           | 561/561/0/0/41422                         |
| diversity-2                |    100 | True            | 561/561/0/0/41422                         |
| diversity-2                |    100 | False           | 561/561/0/0/41422                         |
