# Editing the linked arrangement

The timeline owns the arrangement's view. Clicking a place opens its bars in
G85's lens. One existing score/editor workspace moves into the lens host;
without resolved links it remains the explicitly unlinked draft. A closed
linked lens hides its last workspace without rebuilding a whole-program table. A new reference or settings change refreshes
that relationship immediately.

Drum Mine shows Main's five-lane cells inside the lens, in Rows and Layers.
Click a cell, or Tab to the grid, use arrows and press Enter/Space. Home/End
reach the first/last visible column. The accessible active cell gives lane,
bar, step and occupancy; hover gives the same information. Empty cells are
visible. A pending or failed question cannot become an edit to stale notes.
Exact conversion offers source editing plus a musical-grid hint. Queued playback
edits block further cell changes until their refreshed answers can be used. Muted
places keep their borders and ownership, with an unmute hint. Outer callbacks,
time rewrites, lane overrides or definition sound settings use source editing rather than a cell mapping
that could change the wrong written position. The pure edit enforces this too.

Cells compare literal Notes and actual queried Mine on the chosen grid,
with the quiet-recording setting. They group onsets by nearest step within
their original bar; the first/last cells retain the bar edges. The match strip
keeps its separate original-MIDI/tolerance contract. Full data supplies cell
state and editing. At most 200 filled cells per bar are painted; grid lines
and empty cells are not note events. One grid and active-cell node avoid a
DOM element for every event or step. The corpus reaches 243 bars and 3,947
notes in one song; the editor does not truncate its source.

`setDrumCell` changes the chosen place's actual instrument definition, through
ODM's common history/mutation boundary. An off cell filters that lane and local
interval after the existing rewrites. An on cell adds one hit, velocity 90,
lasting one grid step. The original program remains intact. Query the result
again through `src/strudel/`; never draw Mine from the inserted text. A shared
section changes at every place; split copies retain their independent patterns.
The seam owns the pinned Hap/filter/layer details and the sample/lane catalog.

For bass, keys and other parts, choose an instrument and bar, then a part
for concurrent voices. The native workspace contains one instrument row;
the timeline keeps them all. The existing sheet's native rhythm, values and source editors address
that definition while keeping the full stem's query id and actual answers.
Adding, listing or removing a native rewrite uses that exact score-part address.
The edit and editor share `scorePart` for references and groups; removing a
use-level or callback rewrite returns Add to the instrument.
Inherited settings remain named use-site controls. Opaque, across-time or repeating nested arrangements offer whole-pattern source
instead of guessed bar ownership.
The sheet retains its 200-event cap; its separate arrangement builder is hidden
here because sections are made on the timeline.

Changing bar, part or the lens range closes the active editor and releases Paste.
Follow cannot change an open editor to a neighbouring place. Unapplied
source text stays only in memory, at the same address and unchanged source
baseline, until another piece loads. Successfully applied text is not relabelled as a draft. Revert restores current document text;
Copy includes applied document changes. A closed one-bar lens and a whole
program can share the same cycle window, so the sheet cache also keys its scope.

One-instrument scores now receive the same full-program question as multi-row
scores. Expanding a shared initializer while isolating each occurrence can
change its values; the canary proves 61/61 in playback versus 62/63 on the old
path. Isolated fallback remains explicit in the score-query contract. All
questions retain their five-second budget.

The [mockup](../design-study/sketches/lens-editing.html) records G117–G118;
the [invented-fixture capture](../design-study/sketches/lens-editing.png) shows
the implemented cells and one native instrument row.
Only invented-fixture screenshots may be committed. Static outside contexts
are prepared in the settled view before shrinking rows can reveal them during
an animation. The [proof report](lens-editing-measurements.md) records end-to-end results,
the repeated frame qualification and its shared-machine limits.

## Next steps' hooks

Row speakers (step 9 part 2) can consume complete `materialFor(stemId)` data,
source kind and place links. Mine audition must use the controller's full query
values and document row ids: canonical painted notes omit effects, and G115/G119
explain why isolated/solo results can differ from whole playback. Selection and
cell edits are separate ports; speaker buttons need not intercept them.

Simplify controls (step 11 part 2) can target the selected place's actual
patterns, preserve its shared uses and mark it edited through the same mutation
boundary. `compareMaterial`/`matchNotePairs` supply complete evidence;
`sheetModel`'s scoped rows and `sectionControls` separate native editing from
arrangement controls. Neither follow-up should read painted pixels or flatten
an independent split copy back into the first stem pattern.
