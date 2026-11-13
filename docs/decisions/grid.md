# Decisions: consistent bar grid

Decided for the owner during issue #19, 2026-11-13. G12, G15, G27–G29
and the detected evidence of G42 remain settled.

- **G53: use the derived 1× grid by default.** Seed the local bar length from
  the first five gap-free bars with the declared beat count (all bars if none
  qualify). Fold near-octave lengths toward a trailing seven-bar median.
  Merge short runs that fit one or two local bars; split near-double or
  quadruple lengths. Respect the folder's meter, including two-beat bars.
  The tempo question's ½× and 2× grids use this same derivation with twice or
  half the target duration. A two-bar merge needs nearby beat evidence at its
  split point; otherwise its detected lines remain unresolved. Bar 1 stays at the first detected downbeat.
- **G54: explain derivation, retain uncertainty.** Each removed line, added
  line, added beat and removed beat records its kind, seconds and evidence
  interval. Snap inferred lines to nearby detected beats; retain within-bar
  timing when its count fits. Fill/thin other complete bars to the declared
  meter. Pickup and short terminal segments remain partial; uncovered edges
  are never extended. Bars containing true gaps retain observed beat counts
  and gap flags rather than guessing how many beats are missing (G45).
  Gradual drift and non-octave tempo changes survive. An exact octave tempo
  change and a tracking switch can be indistinguishable from timestamps;
  the default treats near-octave changes as level switches. This is a
  heuristic, not a musical judgement; detected bars and alternatives remain
  available. Measurements include unresolved irregular bars.
- **G55: additive version 1 interval reporting.** `coverage.level_switches`
  contains sustained runs at another metrical level; `coverage.gaps` contains
  isolated large holes relative to local and song medians. A run needs two
  similar intervals, within 15%; neighbors span four intervals either side.
  This refines G42's gap heuristic without changing detected timestamps or
  the folder version. Old folders remain readable: the app derives the
  refined coverage when the additive field is absent, retaining the original
  coverage under `detectedBeatMap`. Shared synthetic fixtures keep the Python
  tool and TypeScript fallback aligned. Measurement reassembles metadata from
  existing detected arrays; separation and transcription need no rerun.
- **G56: a small grid summary and one tempo choice.** Keep the step 5 shell,
  adding the grid multiplier and added/removed bar-line counts. Flagged songs
  offer ½×, 1×, 2× once per opening; choosing updates note coordinates and
  bars while retaining decoded audio. The choice lasts for that opened song,
  following G23; no new persistence. The timeline owns inference drawing.
  The [mockup](../../design-study/sketches/consistent-grid.html) records this.
