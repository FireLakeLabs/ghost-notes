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

## Lens and selection (part 2)

`range.ts` owns selection and a piecewise projection. Main's lens takes 68%
with the rest divided in proportion to the remaining song. Each drawing frame
interpolates coordinates and displayed row heights with Main’s 450 ms easing
(160 ms while dragging). Fixed canvas buffers avoid per-frame reallocation.
Waveforms cache a beat-spaced min/max drawing (64 px/beat, at most 30,000 px);
the piecewise projection draws its slices. Softened outside contours are cached
before interaction. The closed rows scale these final-height buffers down;
waveform amplitude and stroke thickness scale with them. These are drawing summaries; source PCM and notes remain intact. The original per-bar 200-event drawing cap and original counts
remain in force, including inside the lens. Outside pitched contours and all
inside pitches use the same sampled data. No conversion data is sampled.

The port adds `selection`, `lens`, `openLens({firstBar,lastBar} | null)`,
`moveLens(deltaBars)` and `lensHost`. The inclusive bar range can be supplied by
step 8's section chips. `selectionchange` and `lenschange` carry the new state
in event detail. Selection endpoints are half-open positions in the chosen
map; containing bars stay inclusive even for beat selections. The source
coordinates exposed by part 1 remain whole-song pixels, before lens projection.
Session controls are not persisted. New references reset ranges and lens state.
The host is reserved for the linked sheet/editor; the program/score are
explicitly an unlinked draft for now (G85). `?inspect` exposes `ghostTimeline`.

## Session settings and the shell

The shell may move `settingsHost` (`#timeline-settings`) into its Settings
panel. Move the element rather than clone its controls: the same scope, snap
and stem-audio handlers remain attached. `settings` reads a `TimelineSettings`
snapshot; `setSettings(partial)` applies central session-store updates. The
fields are `selectionScope: 'band' | 'instrument'`,
`selectionSnap: 'bars' | 'beats'`, and `showAudio: boolean`. The timeline root
emits `settingschange` with that snapshot for both UI and programmatic changes.
Scope/snap changes clear the selection; audio changes rebuild the rows.
Settings survive reference changes, and `destroy()` removes the moved host.
The instrument picker, range, zoom and lens actions stay on the timeline.
Conversion grid, match and simplify settings use their owning modules' types;
they are not duplicate timeline preferences. Tempo/meter review is song-specific.

## Tempo, grouping and ruler labels

`grid-review.ts` asks once on opening a flagged tempo or substantially split
detected meter, and keeps a session control. Three 300×96 previews share the
same seconds and source marks; group size and beat-one phase apply together
with the chosen tempo. `grid-choice.ts` owns the pure transformation; the
reference mount dispatches the same `referencechange` used by the timeline,
converter and copy panel. The folder link and decoded audio are retained.

G88 replaces G65's orange grid inferences with neutral dotted ruler underlines,
explained on hover. Numbers and uncertainty labels occupy separate lines;
crowded numbers are hidden, and overlapping uncertainty descriptions share a
tooltip. No per-row inference stripes compete with part 3's difference marks.
