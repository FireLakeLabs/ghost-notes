# Whole-song timeline

`src/timeline/layout.ts` owns pure coordinates, row order, drum lanes and
per-bar drawing samples. `render.ts` mounts recording rows from the reference
port; it never imports Strudel or retains another copy of PCM. The app listens
for `referencechange`, including clearing the reference before a new decode.
A failed open hides the prior timeline. The existing sheet stays in place for
the lens in part 2.

The returned viewport port exposes `visibleBars(): ReferenceBar[]`,
`positionAtX(x): Position | null` and `xAtPosition(position): number | null`.
X is a pixel offset in the whole song track, excluding the 150 px labels.
A pointer's x is `clientX - scrollRect.left - 150 + scrollLeft`, using the
scroll viewport's rectangle (not the moving track's rectangle). Width changes with zoom;
keep positions, not pixels, in selection state. Positions come from the chosen
map, including gap and uncovered variants. Reopening or changing grids resets
fit and rebuilds coordinate caches. `destroy()` releases observers and data.

Each instrument has optional audio then MIDI. Rows are explicit data, so parts
2/3 can add Notes/Mine without inventing fake controls now. Contours are a
summary; full notes remain in the reference port for the lens. Per-bar drawing
caps never change conversion input. Tokens `--tl-recording`, `--tl-mine` and
`--tl-difference` carry G22's roles; surface, text and line tokens carry theme.

The synthetic screenshot beside Main documents the narrower part 1 structure.
A new strip/zoom mockup records its deliberate navigation change (G64).
Performance protocol and anonymous results are in
[timeline measurements](timeline-measurements.md). Real-song pixels and data
stay local. `npm run measure:timeline` skips when local material is absent;
the ordinary browser suite runs only the lean synthetic timeline test.
