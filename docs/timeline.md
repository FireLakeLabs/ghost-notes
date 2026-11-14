# Whole-song timeline

`src/timeline/layout.ts` owns pure coordinates, row order, drum lanes and
per-bar drawing samples. `render.ts` combines reference rows with the app-supplied arrangement answers;
it never imports Strudel or retains another copy of PCM. The app listens
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

Each instrument has optional audio then MIDI, Notes and Mine. Rows remain
explicit data, independently of the chosen row/layer view. Contours are a
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
The host is reserved for moving the linked sheet/editor into the lens. Linked
places currently select the score below; programs without resolved links remain
an explained whole-program draft (G85). `?inspect` exposes `ghostTimeline`.

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

## Notes and Mine (part 3, rows)

The default rows are audio (optional), MIDI, Notes, Mine. `settings.viewMode`
is `rows` or `layers`; `setSettings` can switch all instruments and clear
per-stem overrides. Each heading has an override. Main's closed/open heights
are retained: audio 32/44, MIDI 44/58, Notes 44/50, Mine 58/100, layers 100/150.
Layers share a pitch range: faint MIDI, outlined Notes, solid Mine. Closed
pitched rows show contours; the lens shows piano-roll positions. Drum rows
keep five lanes. Mine reserves a footer for its place labels.

`setScore(TimelineScore)` receives the document's instruments, resolved authored
places, current query answers, link status and conversion grid. The app's
controller questions through `src/strudel/`; `scoredNotes` reads those answers,
including the pinned duration/clip rule, note names, frequencies and known drum
samples. Failed or unmapped answers say so. The controller keeps existing sheet/editor
answers while `pendingRows` identifies new questions. `settledEvents` masks
those rows for Mine until their answers arrive; wait for `pendingRows.size === 0`
when checking the latest score. G115 asks multi-row documents in full context,
including after edits, because group rewrites can couple neighbouring rows.
`createMaterial` caches Notes by reference/grid independently of Mine. It maps
queried canonical cycles back to seconds through the full conversion map and
keeps copied fill provenance in coverage. Queried notes remain visible even
when a rewrite moves them beyond a linked place, or a copied fill plays in an
unarranged range. It never derives Mine from the input text.

Unarranged ranges have dashed borders and a label when width permits. Arranged
silence retains its named place border. Canvas descriptions give full note
counts and unarranged-range counts; drawing samples retain the per-source,
per-bar 200-event cap. Cached drawing buffers are reused when data is unchanged.
Only visible vertical bands are painted; page scrolling and changes to the
reference/header height request a redraw through `observeLayout`.
Whole-timeline screenshots must visit each instrument before capture.

`materialFor(stemId)` supplies unsampled Notes/Mine, conversion change records
and authored places independently of view mode. This is the hook for row
speakers (step 9 part 2), simplify proposals (step 11 part 2), and differences.
A Mine/layers click dispatches `placeopen` with the place id; the app selects
that occurrence and opens its source bars. One editor still belongs to the
app; moving it into the lens follows in the editing PR.

The row PR passed `npm run check` (611 Node tests, seven opt-in skips) and
`npm run test:browser` (77 passed, one skip; 134.643 s / 180 s). The fixture
walk switches both view controls and checks that changing keys' view leaves
an unchanged drums canvas intact. Pure integration checks query pinned Strudel
rewrites and durations, keep Mine unchanged when the Notes grid changes, and
show failed questions explicitly. A private production-browser save/reopen
walk retained all 362 Mine notes on the first test session, song 1, with zero
runtime errors. Both synthetic views and the private rows were inspected.
[Frame evidence and limits](rows-measurements.md) include the failed first
experiment; this intermediate PR does not claim the final repeated proof.

Inspected synthetic captures: [rows](../design-study/sketches/arrangement-rows.png)
and [layers](../design-study/sketches/arrangement-layers.png). The additional
[state mockup](../design-study/sketches/row-states.html) records the waiting,
failed and unarranged states for later owner review.

A second private walk selected literal unarranged fills: 1,357 queried notes
were also 1,357 Mine notes, before and after a second copy/paste, with zero
runtime errors. The authored place/tempo remained and fills remained unarranged.
An explicit stem on an imported pattern group now preserves that instrument
boundary, as G96 requires. Fixture regressions first failed and then passed
for notes shifted beyond linked bars and for copied literal fills.

Captures are opt-in artifacts. Set `GHOST_ROWS_SHOT=/tmp/rows.png` for the
arrangement walk (also writes `-rows` and `-places` views), or set
`GHOST_TIMELINE_SHOT`, `GHOST_LENS_SHOT`, `GHOST_SECTION_SHOT`, `GHOST_GRID_SHOT`
to local PNG paths. Default browser checks retain their real canvas-pixel and
interaction assertions without taking whole-page images.

The [difference contract](differences.md) adds converter evidence, same-bar
matches and shared hover regions in Layers. Its sources retain separate data,
but use one visible canvas per instrument. The
[intermediate timing report](difference-measurements.md) qualifies one pass per
view with the working row still in view after every operation. Set
`GHOST_DIFFERENCES_SHOT` to capture the invented six-mark walk.

The [lens editing contract](lens-editing.md) puts queried drum cells in Mine
and the existing native editors in the selected place's workspace. G117–G120
cover shared edits, independent copies, scope changes and safe cell coordinates.
Set `GHOST_LENS_EDIT_SHOT` for the invented editing walk's PNG.
