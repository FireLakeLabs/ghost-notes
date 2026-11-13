# Simplify measurements

Final chosen-grid integration, 2026-11-13: converter default **4 steps per beat**,
on the chosen 1× bar grid, after #26 (issue #23).
All six songs, all 36 stems; every emitted candidate queried through pinned
Strudel and compared with its claimed onset, pitch, gain and effective end.
No private notes or source code retained. Reports compare with original recording
coordinates, including grid movement and merges. No listening or playback timing measured.

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
percentages. M/X/S/G/D/A are moved, crossed a bar line, shortened, merged, dropped and added records;
one note can have multiple marks. These include converter changes.

| Input                      | Instrument | Technique      | Original / proposed / matched | Kept / match % | Literal → proposed bytes | M/X/S/G/D/A          |
| -------------------------- | ---------- | -------------- | ----------------------------: | -------------: | -----------------------: | -------------------- |
| first test session, song 1 | drums      | drum-bars      |               405 / 372 / 315 |  77.78 / 84.68 |            27609 → 20512 | 326/49/0/25/0/0      |
| first test session, song 1 | bass       | stray-notes    |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 14661 | 278/6/69/13/0/0      |
| first test session, song 1 | bass       | split-notes    |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 14661 | 278/6/69/13/0/0      |
| first test session, song 1 | bass       | octave-errors  |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 14661 | 278/6/69/13/0/0      |
| first test session, song 1 | bass       | interval-riffs |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 15055 | 278/6/69/13/0/0      |
| first test session, song 1 | bass       | scale-degrees  |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 15045 | 278/6/69/13/0/0      |
| first test session, song 1 | bass       | euclidean-fits |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 14450 | 278/6/69/13/0/0      |
| first test session, song 1 | bass       | phrase-repeats |               291 / 278 / 140 |  48.11 / 50.36 |            16848 → 14661 | 278/6/69/13/0/0      |
| first test session, song 1 | keys/other | stray-notes    |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 38289 | 705/22/166/29/0/0    |
| first test session, song 1 | keys/other | split-notes    |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 38289 | 705/22/166/29/0/0    |
| first test session, song 1 | keys/other | octave-errors  |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 38289 | 705/22/166/29/0/0    |
| first test session, song 1 | keys/other | interval-riffs |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 39537 | 705/22/166/29/0/0    |
| first test session, song 1 | keys/other | scale-degrees  |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 39384 | 705/22/166/29/0/0    |
| first test session, song 1 | keys/other | euclidean-fits |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 37811 | 705/22/166/29/0/0    |
| first test session, song 1 | keys/other | phrase-repeats |               737 / 707 / 379 |  51.42 / 53.61 |            46545 → 37749 | 705/22/166/29/0/0    |
| first test session, song 2 | drums      | drum-bars      |               806 / 796 / 733 |  90.94 / 92.09 |            54838 → 37517 | 707/76/0/10/0/0      |
| first test session, song 2 | bass       | stray-notes    |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 14424 | 276/16/198/4/0/0     |
| first test session, song 2 | bass       | split-notes    |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 14424 | 276/16/198/4/0/0     |
| first test session, song 2 | bass       | octave-errors  |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 14424 | 276/16/198/4/0/0     |
| first test session, song 2 | bass       | interval-riffs |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 15237 | 276/16/198/4/0/0     |
| first test session, song 2 | bass       | scale-degrees  |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 15569 | 276/16/198/4/0/0     |
| first test session, song 2 | bass       | euclidean-fits |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 14277 | 276/16/198/4/0/0     |
| first test session, song 2 | bass       | phrase-repeats |               280 / 276 / 233 |  83.21 / 84.42 |            16549 → 13107 | 276/16/198/4/0/0     |
| first test session, song 2 | keys/other | stray-notes    |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 57827 | 1112/56/686/5/0/0    |
| first test session, song 2 | keys/other | split-notes    |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 57827 | 1112/56/686/5/0/0    |
| first test session, song 2 | keys/other | octave-errors  |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 57827 | 1112/56/686/5/0/0    |
| first test session, song 2 | keys/other | interval-riffs |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 60976 | 1112/56/686/5/0/0    |
| first test session, song 2 | keys/other | scale-degrees  |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 61846 | 1112/56/686/5/0/0    |
| first test session, song 2 | keys/other | euclidean-fits |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 57168 | 1112/56/686/5/0/0    |
| first test session, song 2 | keys/other | phrase-repeats |             1117 / 1112 / 894 |  80.04 / 80.40 |            76938 → 53712 | 1112/56/686/5/0/0    |
| first test session, song 3 | drums      | drum-bars      |               645 / 644 / 531 |  82.33 / 82.45 |            46150 → 30791 | 518/113/368/1/0/0    |
| first test session, song 3 | bass       | stray-notes    |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 21896 | 460/26/394/0/0/0     |
| first test session, song 3 | bass       | split-notes    |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 21896 | 460/26/394/0/0/0     |
| first test session, song 3 | bass       | octave-errors  |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 21896 | 460/26/394/0/0/0     |
| first test session, song 3 | bass       | interval-riffs |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 22842 | 460/26/394/0/0/0     |
| first test session, song 3 | bass       | scale-degrees  |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 23040 | 460/26/394/0/0/0     |
| first test session, song 3 | bass       | euclidean-fits |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 21577 | 460/26/394/0/0/0     |
| first test session, song 3 | bass       | phrase-repeats |               461 / 461 / 446 |  96.75 / 96.75 |            23022 → 20396 | 460/26/394/0/0/0     |
| first test session, song 3 | keys/other | stray-notes    |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 33189 | 698/35/677/0/0/0     |
| first test session, song 3 | keys/other | split-notes    |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 33189 | 698/35/677/0/0/0     |
| first test session, song 3 | keys/other | octave-errors  |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 33189 | 698/35/677/0/0/0     |
| first test session, song 3 | keys/other | interval-riffs |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 34952 | 698/35/677/0/0/0     |
| first test session, song 3 | keys/other | scale-degrees  |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 35261 | 698/35/677/0/0/0     |
| first test session, song 3 | keys/other | euclidean-fits |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 32953 | 698/35/677/0/0/0     |
| first test session, song 3 | keys/other | phrase-repeats |               699 / 699 / 674 |  96.42 / 96.42 |            42454 → 29627 | 698/35/677/0/0/0     |
| first test session, song 4 | drums      | drum-bars      |               858 / 852 / 775 |  90.33 / 90.96 |            54141 → 42033 | 782/86/92/6/0/0      |
| first test session, song 4 | bass       | stray-notes    |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 18494 | 380/15/256/4/0/0     |
| first test session, song 4 | bass       | split-notes    |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 18494 | 380/15/256/4/0/0     |
| first test session, song 4 | bass       | octave-errors  |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 18494 | 380/15/256/4/0/0     |
| first test session, song 4 | bass       | interval-riffs |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 19173 | 380/15/256/4/0/0     |
| first test session, song 4 | bass       | scale-degrees  |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 18879 | 380/15/256/4/0/0     |
| first test session, song 4 | bass       | euclidean-fits |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 18166 | 380/15/256/4/0/0     |
| first test session, song 4 | bass       | phrase-repeats |               385 / 381 / 310 |  80.52 / 81.36 |            19644 → 17965 | 380/15/256/4/0/0     |
| first test session, song 4 | keys/other | stray-notes    |            2039 / 2022 / 1784 |  87.49 / 88.23 |            95513 → 92647 | 2020/100/1450/15/2/0 |
| first test session, song 4 | keys/other | split-notes    |            2039 / 2024 / 1786 |  87.59 / 88.24 |            95513 → 92735 | 2022/100/1452/15/0/0 |
| first test session, song 4 | keys/other | octave-errors  |            2039 / 2024 / 1786 |  87.59 / 88.24 |            95513 → 92735 | 2022/100/1452/15/0/0 |
| first test session, song 4 | keys/other | interval-riffs |            2039 / 2024 / 1786 |  87.59 / 88.24 |            95513 → 94411 | 2022/100/1452/15/0/0 |
| first test session, song 4 | keys/other | scale-degrees  |            2039 / 2024 / 1786 |  87.59 / 88.24 |            95513 → 91570 | 2022/100/1452/15/0/0 |
| first test session, song 4 | keys/other | euclidean-fits |            2039 / 2024 / 1786 |  87.59 / 88.24 |            95513 → 91466 | 2022/100/1452/15/0/0 |
| first test session, song 4 | keys/other | phrase-repeats |            2039 / 2024 / 1786 |  87.59 / 88.24 |            95513 → 88199 | 2022/100/1452/15/0/0 |
| diversity-1                | drums      | drum-bars      |               944 / 889 / 766 |  81.14 / 86.16 |            70275 → 45836 | 864/154/3/55/0/0     |
| diversity-1                | bass       | stray-notes    |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 23289 | 426/51/272/7/0/0     |
| diversity-1                | bass       | split-notes    |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 23289 | 426/51/272/7/0/0     |
| diversity-1                | bass       | octave-errors  |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 23289 | 426/51/272/7/0/0     |
| diversity-1                | bass       | interval-riffs |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 25829 | 426/51/272/7/0/0     |
| diversity-1                | bass       | scale-degrees  |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 25790 | 426/51/272/7/0/0     |
| diversity-1                | bass       | euclidean-fits |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 23088 | 426/51/272/7/0/0     |
| diversity-1                | bass       | phrase-repeats |               434 / 427 / 285 |  65.67 / 66.74 |            28319 → 20895 | 426/51/272/7/0/0     |
| diversity-1                | keys/other | stray-notes    |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 122566 | 2503/328/1746/64/0/0 |
| diversity-1                | keys/other | split-notes    |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 122566 | 2503/328/1746/64/0/0 |
| diversity-1                | keys/other | octave-errors  |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 122566 | 2503/328/1746/64/0/0 |
| diversity-1                | keys/other | interval-riffs |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 130352 | 2503/328/1746/64/0/0 |
| diversity-1                | keys/other | scale-degrees  |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 126428 | 2503/328/1746/64/0/0 |
| diversity-1                | keys/other | euclidean-fits |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 121033 | 2503/328/1746/64/0/0 |
| diversity-1                | keys/other | phrase-repeats |            2569 / 2505 / 1816 |  70.69 / 72.50 |          147491 → 112422 | 2503/328/1746/64/0/0 |
| diversity-2                | drums      | drum-bars      |               561 / 545 / 496 |  88.41 / 91.01 |            39822 → 29289 | 448/56/7/16/0/0      |
| diversity-2                | bass       | stray-notes    |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 9202 | 162/4/45/2/0/0       |
| diversity-2                | bass       | split-notes    |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 9202 | 162/4/45/2/0/0       |
| diversity-2                | bass       | octave-errors  |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 9202 | 162/4/45/2/0/0       |
| diversity-2                | bass       | interval-riffs |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 9692 | 162/4/45/2/0/0       |
| diversity-2                | bass       | scale-degrees  |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 9941 | 162/4/45/2/0/0       |
| diversity-2                | bass       | euclidean-fits |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 9103 | 162/4/45/2/0/0       |
| diversity-2                | bass       | phrase-repeats |               164 / 162 / 115 |  70.12 / 70.99 |             12323 → 8977 | 162/4/45/2/0/0       |
| diversity-2                | keys/other | stray-notes    |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 35874 | 636/18/143/15/0/0    |
| diversity-2                | keys/other | split-notes    |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 35874 | 636/18/143/15/0/0    |
| diversity-2                | keys/other | octave-errors  |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 35874 | 636/18/143/15/0/0    |
| diversity-2                | keys/other | interval-riffs |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 37374 | 636/18/143/15/0/0    |
| diversity-2                | keys/other | scale-degrees  |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 36961 | 636/18/143/15/0/0    |
| diversity-2                | keys/other | euclidean-fits |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 35474 | 636/18/143/15/0/0    |
| diversity-2                | keys/other | phrase-repeats |               652 / 637 / 393 |  60.28 / 61.70 |            46925 → 35296 | 636/18/143/15/0/0    |

## Default-limit trials

All six songs, every pitched stem: weak velocity thresholds with the same 80 ms stray, 30 ms split-gap and 200 ms octave limits. Each cell is dropped / joined fragments / pitch corrections. Trials are measured data transformations; only default proposals above are runtime queried. A joined fragment retains its source ID; these trial counts exclude converter collisions. Default 32 avoids asserting any of these uncertain repairs on this corpus; 48 and 64 remain user choices.

| Input                      | Velocity <32 | <48      | <64       |
| -------------------------- | ------------ | -------- | --------- |
| first test session, song 1 | 0/0/0        | 10/9/0   | 41/35/2   |
| first test session, song 2 | 0/0/0        | 7/28/3   | 10/121/5  |
| first test session, song 3 | 0/0/0        | 17/18/6  | 42/86/17  |
| first test session, song 4 | 2/0/0        | 35/64/10 | 72/325/29 |
| diversity-1                | 0/0/0        | 4/29/8   | 12/193/15 |
| diversity-2                | 0/0/0        | 1/4/0    | 11/19/3   |

Drum movement/fill trials, with 10% source-drop/add budgets, unchanged matched gain and Jaccard 0.25. Each cell is proposed notes / matched source notes / drops / additions / UTF-8 bytes. The default is 50 ms with fills protected. A larger endpoint limit does not establish a better suggestion.

| Input                      | Max ms | Fills protected | Notes / matched / dropped / added / bytes |
| -------------------------- | -----: | --------------- | ----------------------------------------- |
| first test session, song 1 |     25 | True            | 372/315/0/0/20512                         |
| first test session, song 1 |     25 | False           | 372/315/0/0/20512                         |
| first test session, song 1 |     50 | True            | 372/315/0/0/20512                         |
| first test session, song 1 |     50 | False           | 372/315/0/0/20512                         |
| first test session, song 1 |    100 | True            | 372/315/0/0/20512                         |
| first test session, song 1 |    100 | False           | 372/315/0/0/20512                         |
| first test session, song 2 |     25 | True            | 796/733/0/0/37517                         |
| first test session, song 2 |     25 | False           | 796/733/0/0/37517                         |
| first test session, song 2 |     50 | True            | 796/733/0/0/37517                         |
| first test session, song 2 |     50 | False           | 796/733/0/0/37517                         |
| first test session, song 2 |    100 | True            | 796/733/0/0/37517                         |
| first test session, song 2 |    100 | False           | 796/733/0/0/37517                         |
| first test session, song 3 |     25 | True            | 644/531/0/0/30791                         |
| first test session, song 3 |     25 | False           | 644/531/0/0/30791                         |
| first test session, song 3 |     50 | True            | 644/531/0/0/30791                         |
| first test session, song 3 |     50 | False           | 644/531/0/0/30791                         |
| first test session, song 3 |    100 | True            | 644/531/0/0/30791                         |
| first test session, song 3 |    100 | False           | 644/531/0/0/30791                         |
| first test session, song 4 |     25 | True            | 852/775/0/0/42033                         |
| first test session, song 4 |     25 | False           | 852/775/0/0/42033                         |
| first test session, song 4 |     50 | True            | 852/775/0/0/42033                         |
| first test session, song 4 |     50 | False           | 852/775/0/0/42033                         |
| first test session, song 4 |    100 | True            | 852/775/0/0/42033                         |
| first test session, song 4 |    100 | False           | 852/775/0/0/42033                         |
| diversity-1                |     25 | True            | 889/766/0/0/45836                         |
| diversity-1                |     25 | False           | 889/766/0/0/45836                         |
| diversity-1                |     50 | True            | 889/766/0/0/45836                         |
| diversity-1                |     50 | False           | 889/766/0/0/45836                         |
| diversity-1                |    100 | True            | 889/766/0/0/45836                         |
| diversity-1                |    100 | False           | 889/766/0/0/45836                         |
| diversity-2                |     25 | True            | 545/496/0/0/29289                         |
| diversity-2                |     25 | False           | 545/496/0/0/29289                         |
| diversity-2                |     50 | True            | 545/496/0/0/29289                         |
| diversity-2                |     50 | False           | 545/496/0/0/29289                         |
| diversity-2                |    100 | True            | 545/496/0/0/29289                         |
| diversity-2                |    100 | False           | 545/496/0/0/29289                         |
