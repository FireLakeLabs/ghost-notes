# Decisions: whole-song timeline

- **G116 (2026-11-14) Explain converter evidence and compare same-bar onsets.**
  Decided for the absent owner. Notes' four marks use converter lineage and
  original/written seconds, including sustain-end crossings. Mine compares
  original MIDI onsets with actual queried events, one-to-one within each
  half-open authored bar, using the session match settings. Quiet filtering
  applies to recorded notes; drums compare by lane, excluding classes outside
  the five displayed lanes. The strip uses matched /
  union, with two empty arranged sets at 100%; unarranged or unanswered bars
  have no comparison. Its 4 px height, 2 px bottom inset and 90/70% colours
  follow Main. Hollow recording notes share Mine's 200-event drawing allowance;
  counts retain all events. Hover explains every mark, with up/down keys as
  an equivalent. Outside the lens, pitched annotations use a bottom rail while
  the music remains a contour; inside, they follow the piano roll. Focusing
  lens controls preserves the working row's scroll position. Animated row
  heights use whole CSS pixels between the existing sizes; the 450/160 ms
  projection stays eased. The outside view uses one cached blurred context.
  Layers shares its visible surface and grid while keeping separate source
  data and hit regions. The
  [mockup](../../design-study/sketches/difference-marks.html) records the rail
  and hover card; [the contract](../differences.md) defines the ports.

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

Decided for the owner during step 7 part 2, 2026-11-13:

- **G85: one reference lens, with a host for the linked score.** Keep Main's
  68% lens width, 150 px labels, 36 px header and 450 ms eased growth/movement (160 ms while dragging).
  Audio grows from 32 to 44 px, MIDI from 44 to 58 px. Outside bars remain
  squeezed, dimmed and blurred; pitched notes become a piano roll inside.
  Opening temporarily fits the song; closing restores the previous zoom and
  scroll. Reduced motion finishes on the next drawing frame. Until step 8
  provides source links, the existing program and score are explicitly one
  unlinked whole-program draft below the reference. Do not pretend its cycles
  match these bars. The lens exposes a host for the linked sheet and its editor;
  step 8 can move that workspace there without making another score view.
- **G86: share a selection contract with sections.** Session controls choose
  band/instrument and bar/beat snap; dragging either audio or MIDI selects.
  Typed first/last bars also work. Retain a half-open note interval in positions,
  plus inclusive containing bars and a discriminated scope. Look closer opens
  those containing bars; Make section will use the same contract. A section
  can call the lens's bar-range port directly. Changing settings clears the
  previous selection. Uncovered tails cannot invent selectable bars. The
  coordinate cache is bounded at 50,000 entries before handling live pointers.

- **G88: quiet inference marks and two ruler lines.** Supersede G65's orange
  approximation labels and dotted lines through every row. A neutral dotted
  underline on the bar number explains the inference on hover; row grid lines
  stay neutral. Orange remains reserved for recording/arrangement differences
  (G22, part 3). Numbers use the ruler's upper 12 px; uncertainty labels use the
  lower 11 px at y=15. Skip crowded numbers. Clamp uncertainty text within the
  viewport only while its region is visible; combine overlapping explanations
  in the retained label's tooltip, prioritising uncovered edges. The same
  [mockup](../../design-study/sketches/tempo-meter.html) records this treatment.

- **G114 (2026-11-13) Draw Mine from queried score values.** The Strudel seam
  resolves queried pitch/sample values and scored duration; the timeline maps
  canonical cycles through the converter's full reference map. It never parses
  program text to draw Mine. Conversion stays independently cached on the
  chosen grid. Missing links, pending/failed questions and unmapped events are
  explicit states. Unarranged describes link ownership; queried notes still draw
  there after rewrites or copied fills. Unarranged bars have dashed borders and labels; an arranged
  silent place retains its border/name. Row/layer heights follow Main, with
  18 px inside Mine/layers reserved for labels. A setting switches all views;
  each stem can override it for the session. The 200-event cap applies per
  source/bar and never to query or conversion input. Only rows near the window
  are rasterized, with scroll-triggered redraw; every row retains its source
  data and animated height. Decided for the absent owner.

- **G117 (2026-11-14) Edit shared drum cells from the queried arrangement.**
  Decided for the absent owner. Main's five-lane cells appear in Mine inside
  the lens, in Rows or Layers. Cell occupancy comes from full queried Mine
  and literal Notes, with the quiet-recording setting. Onsets use their nearest
  step within their owning bar; first/last cells retain that bar's edges.
  The match strip still compares original MIDI using its stated tolerance.
  An off cell filters that lane and local interval after the existing pattern's
  rewrites. An on cell adds one hit at velocity 90, lasting one grid step.
  Both preserve the original program and edit the shared definition through
  document history. Exact mode offers source editing and a musical-grid hint
  rather than inventing editable exact cells. One focusable grid and active
  cell serve keyboard navigation without per-event DOM. At most 200 filled
  cells per bar are painted; counts and edits use complete data. The
  [mockup](../../design-study/sketches/lens-editing.html) records the controls.

- **G120 (2026-11-14) Keep ownership separate from mute; guard cell coordinates.**
  Decided for the absent owner. A muted instrument still owns its arranged
  bars, even though its queried output is empty. Keep the place borders and
  comparison; do not label it unarranged. Direct drum cells require one unmuted
  definition use with unchanged outer lane/time coordinates. Whole-program
  callbacks, outer time rewrites, lane overrides and nested arrangements use
  the source editor instead; muting offers an explicit unmute hint. Definition
  sound settings also use source editing, so a new hit cannot bypass its bank
  or effects. Queued playback edits block further cells until fresh answers. The edit
  itself enforces the same rule. This prevents a visible cell change from
  silently modifying another position before an outer transform runs.
