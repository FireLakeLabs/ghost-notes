# Decisions: whole-song timeline

Decided for the owner during step 7 part 1, 2026-11-13.

- **G61: share the chosen grid, keep uncovered edges unnumbered.** The
  timeline consumes `ReferenceBar[]` and the reference position queries.
  Covered beats have equal horizontal spacing. Outside coverage, seconds use
  the map's median beat interval solely for screen width; queries still return
  `uncovered`, with no invented beats or bars. True gaps are hatched and named.
  Without downbeats, the entire recording is unnumbered. This differs from the
  prototype's invented median-tempo bars after detection stops: grid inference
  belongs to #19, never to drawing.
- **G62: draw the viewport, cap each bar cell.** Canvas surfaces stay the
  viewport's width, at device pixel density. The original sheet keeps its
  200-event cap. Timeline note cells also retain at most 200 evenly spaced
  events, including both ends, per instrument/bar, with true counts and a
  visible sampling warning. Uncovered notes share an unnumbered cell. No song
  is truncated at 200 notes. Cached coordinates belong to one immutable grid;
  reopening or choosing a grid rebuilds them.
- **G63: keep the prototype's recording rows and sizes.** Drums, bass, keys
  (or the other stem), then remaining stems in folder order; one instrument per
  stem. Audio starts shown, with a working session checkbox. Labels are 150 px,
  overview 32 px, ruler 28 px, instrument header 46 px including its 8 px gap,
  audio 32 px and MIDI 44 px. Drum lanes run crash, hi-hat, snare, tom, kick,
  as in Main; pitched contours take low chord notes for bass and high notes
  otherwise. Quiet means skipped by the tool or below its default −30 dB
  threshold; it is a warning about evidence, not a new transcription decision.
- **G64: use the song strip to navigate the viewport.** Before sections exist,
  the 32 px strip shows recording density and the visible window. Drag or
  click to navigate; arrow keys move half a window, Home/End reach the edges.
  Fit and zoom work around the current center. Section chips, speakers, lens,
  selection, Notes/Mine and difference controls wait for their owning steps.
  Blue recording, cream arrangement and orange differences are CSS roles.
  The surrounding inherited shell remains for step 10.
- **G65: mark grid changes on affected bars.** Optional inference records put
  an orange ≈ beside the bar number and a dotted orange grid line. A title
  lists the grid's reasons (merge/split/fill/thin); drawing never computes its
  own inference. True gap hatching is separate. Ruler text is clipped to the song extent;
  tail labels face left so even short uncovered tails have readable marks. The mark says that this bar's
  grid was inferred, not that every line in the bar was detected.
