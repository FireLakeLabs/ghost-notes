# Sections and links

- **G91 (2026-11-13) Store source and place links in ODM's existing comments.**
  Patterns own the original half-open source range, edited flag and optional
  stem id. Arrangement parts own each place's half-open range and tempo in
  cycles per minute. Store a local folder basename, never a path or notes.
  Reopening explicitly matches that folder, its numbered bars and stem ids;
  unresolved links remain visible as unresolved data. Optional fields extend
  document v2 and keep older ODM imports valid. This implements G3/G25/G28
  without introducing a second saved document.

- **G92 (2026-11-13) Separate song cycles from copied tempo.** `generate`
  retains one numbered bar per cycle, including silent unarranged space and
  uncovered edges, and the converter's fractional pickup. G72's warp receives
  exactly these coordinates. `generateCopy` stretches each place by
  `base cpm / place cpm` in both its `arrange` duration and `.slow()` wrapper.
  ODM part comments identify that exact wrapper so paste restores song cycles
  without accumulating stretch on repeated copies. Tempo is cycles per minute:
  selected cycle count × 60 / recorded seconds, including partial bars.
  A place's tempo edit changes its copied pacing, not the reference grid.
  Fractional arrangements remain first-pass only (G37).

- **G93 (2026-11-13) Take over whole overlapping places.** Match the
  owner-tested prototype: any overlap removes the whole old place, across all
  its instruments. Return its id, original range and warning text with the
  proposed document, so the timeline can warn before applying. Other places
  remain. An own copy clones the section and instrument content, grouped
  by stem for one row per stem; section-local changes stay separate.
  Remove retired, unreachable linked definitions, retaining any legacy
  origin dependencies still needed by another place.

- **G94 (2026-11-13) Offer nonoverlapping onset/pitch matches at 50% Jaccard.**
  Compare original reference onsets in beats, separately by stem and pitch;
  count maximum one-to-one pairs within the tolerance. Score is matched /
  (reference count + candidate count − matched). Ignore duration and velocity
  differences except the prototype's optional exclusion of velocities below 40.
  Defaults match the prototype: 0.13 beat, quiet notes counted, exact pitch.
  Any-octave matching uses pitch class on pitched stems, never drum classes.
  Keep duplicate multiplicity; silence alone offers nothing. Equal-length,
  equal-beat windows start at numbered bars. At score ≥0.5 offer all disjoint
  windows, best score first to suppress overlaps, then in song order,
  pre-ticked. Beat-limited selections and pickups have no automatic reuse.
  Native offers need user judgment; planted real-note repeats measure recall
  without pretending they label the songs' actual form.

- **G95 (2026-11-13) Mark sections edited at document mutation.** A new
  section starts literal and unedited. Existing editors' shared mutation path, including instrument deletion,
  compares section note content through shared references and marks changed
  definitions edited. Source edits count, including opaque source. Names,
  links and tempo edits alone do not. Splitting preserves the current flag;
  it does not itself change notes. Undo restores the prior document and flag.

- **G96 (2026-11-13) Stem identity groups independent section content.**
  Sections made from different bars and split-off copies share a stem row,
  never note-edit propagation. Derived rows list all their independent patterns;
  row isolation, tags, mute, rename and deletion address those members together.
  Section note edits address only that section's pattern. Keep ODM's legacy
  `origin` semantics for imported ODM copies; creating or splitting a linked
  reference section does not assign an origin. This prevents first-made section
  notes becoming a template that changes unrelated sections.

- **G113 (2026-11-13) Review section places before applying.** The timeline's
  Make section dialog shows pre-ticked offers and requires an explicit checkbox
  for whole-place takeover. Place chips open their linked bars; Split off makes
  an independent copy through the existing edit. Starting content consumes the
  session preference, default literal. Match offers use the session quiet
  threshold and pitch rule; seconds tolerance becomes beats using the selected
  range's mean beat duration, since G94 compares musical positions. Missing
  folder/grid links remain an explained draft. The controls mockup is
  `design-study/sketches/linked-sections.html`. Decided for the absent owner.
