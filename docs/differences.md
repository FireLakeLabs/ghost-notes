# Differences on the timeline

Notes uses the converter's change records, with their original and written
seconds: moved, moved across a bar line, shortened and merged. One event can
have several marks. A moved onset has a line back; a crossing has a vertical
boundary mark; a shortened note has a hollow tail; a merge has stacked marks.
Every mark explains its endpoint evidence on hover.
Outside the lens, pitched annotations share a bottom rail while the music
keeps its contour. Inside, they follow piano-roll pitches. Drums stay in lanes.

Mine compares its actual queried notes with the original MIDI onsets in each
arranged bar. The same session settings used by copy/simplify control timing
tolerance, exact pitch or any octave, and whether quiet recorded notes count.
Quiet notes in Mine still count; the option concerns recorded notes. Drums
match within their five lanes; classes outside those lanes are excluded.
Pairing is one-to-one and retains duplicate
hits. The shared maximum-cardinality matcher also serves simplify's counts.

The match strip is the intersection divided by the union: matched /
(recording + Mine − matched). Two empty arranged sets give 100%. Bar ownership
is half-open by onset seconds, so matching does not reach into another bar.
Unmatched Mine events are orange. Unmatched recorded events are hollow blue
in Mine. Unarranged bars have neither missing-note claims nor a match strip.
Pending, failed or partially unmapped answers have no comparison until they
can be placed. Conversion marks remain independent of Mine's question.

The strip follows Main: 4 px high, 2 px from the bottom; cream from 90%, amber
from 70%, orange below. Hovering gives the percentage and all three counts.
Focusing Notes or Mine and pressing up/down cycles through the same
explanations, including the strip. Escape hides the explanation. Overlapping
marks explain all their changes on pointer hover. The row's accessible
description lists change kinds and per-bar matches. The
[synthetic mockup](../design-study/sketches/difference-marks.html) records the
new hover card.

Only drawing is sampled. Mine and hollow recording events share one
200-event allowance per bar cell; conversion marks attach to sampled literal
events by their converter lineage. Match counts always use complete data.
Rows and layers share these rules. Explanations are prepared before animation;
the closed overview retains its hit regions. Match-setting changes invalidate
the drawing cache. Keyboard explanations follow the focused row through scroll
and layout changes; pointer explanations close when the view moves.
Keyboard navigation visits each distinct explanation once and keeps the
chosen explanation while it remains visible during horizontal scrolling.
Pointer movement reads the last painted hit regions. Only keyboard input can
flush a newly revealed source before its first scheduled paint; an empty hit
list in a painted quiet passage never triggers a redraw.

Outside bars use one cached blurred context, including their grid and gaps.
Only the focus redraws waveform, notes and uncertainty marks. Converter marks
have prepared timeline positions for clipping before projection. Hatch images
are cached by row size; one-column piano grids are prepared with the rows.
Row heights change in one batch before reading actual bounds, so scroll
anchoring cannot make a visible row look off-screen to the renderer. Only the
visible vertical band is painted; complete data remains available.
Layers share one visible surface per instrument and draw their grid once.
Their source samples and hover regions stay separate; hovering the combined
image explains both conversion and arrangement marks. Its static outside
image combines the three sources with the same opacity as the focused view.

`compareMaterial` is a pure port over full material. `matchNotePairs` returns
original/written indices; `differenceDrawing` selects the visible sample.
None changes the arrangement. Row speakers can use full material, and simplify
can reuse the pairing/evidence without reading painted pixels. The final lens
editing wave still owes repeated qualification; the
[intermediate measurements](difference-measurements.md) record one pass per view.
