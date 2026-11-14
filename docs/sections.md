# Sections and reference links

The document remains ODM version 2. Optional fields extend its existing
`@odm-pattern` and `@odm-part` comments; other Strudel editors ignore them.
A pattern can carry `source: {folder, fromBar, toBar}`, `edited: boolean`,
and `stem: string`. Each arrangement part can carry its own `source` and
`tempo` (cycles per minute). Bar ranges are half-open; bar 0 means the pickup.
The folder is a basename, never a path. Comments contain no reference notes.
Unknown or malformed link fields do not prevent importing the music.

A section definition owns its original source and edited flag. Several
arrangement parts can reference that definition; each place retains its own
source bars and tempo. An instrument pattern owns its stem id. Missing fields
remain absent, so older ODM text stays valid. `referenceLinks(doc, folder, song)`
resolves these links against an explicitly reopened local folder and reports
missing bars or stems without changing the arrangement or reference.

## Document operations

`makeSectionFromRange({doc, song, folder, range, name, stemIds?, beats?,
places?, grid?})` returns `{doc, sectionId, placeIds, warnings}` as one undoable
proposal. `placeIds` are in song order; `selectedPlaceId` identifies the
original selection even when an accepted reuse place comes earlier. It accepts an empty document or a linked reference arrangement.
`range` and accepted reuse `places` are half-open whole bars; select pickup
`{fromBar: 0, toBar: 1}` alone. `stemIds` defaults to the whole band.
`beats: {fromBeat, toBeat}` limits original onsets inside those bars, without
shortening the section. Conversion uses the session grid, default four steps
per beat. Existing reference notes remain untouched. Unarranged space is
explicit silence for now; step 10 owns copy-panel choices for those bars.

`findSectionMatches({song, range, stemIds?, settings?})` offers disjoint
whole-bar windows with original reference onset/pitch Jaccard score ≥0.5.
The returned counts expose the denominator; `selected: true` lets the UI
pre-tick each offer. Settings are `timingBeats` (default 0.13), `quiet`
(`count` or `ignore`, below velocity 40) and `pitch` (`exact` or `class`).
Silence supplies no evidence. The UI passes only accepted places to the edit;
it does not silently apply offers. No offers are made for pickup; the UI
must also skip offers when a beat-limited selection is supplied.

Any overlap takes over the **whole prior place**, as in the prototype.
Warnings list every removed place and range, even for one-instrument selection.
The returned document is a proposal: show the warnings before committing it.
`splitSectionPlace(doc, placeId)` clones section content and its instruments;
`setSectionTempo(doc, placeId, cpm)` changes that place's steady export tempo.
Both return a document or a refusal. Stem ids group independent patterns into one instrument row. Note edits stay
inside the selected section, including split copies. Row isolation, playback
tags, mute, rename and deletion cover all member patterns. ODM origins retain
their existing meaning for imported ODM documents; linked section operations
do not create them.
Content edits through ODM's common mutation helper mark affected sections
`edited: true`; metadata-only changes do not. Undo restores the old snapshot.

## Copy and playback

`generate(doc)` preserves the converter's full song-cycle coordinates, including
silent gaps, pickup and uncovered edges. Use it for queries and G72 playback.
`generateCopy(doc)` writes tempo-stretched `arrange` entries and `.slow(factor)`
wrappers with the place tempo and the exact canonical duration in `@odm-part`.
Paste through `importStrudel` unwraps only a wrapper whose factor, literal
argument and duration all agree. Hand-edited code that no longer agrees remains
code, with a warning and its tempo link removed so another copy cannot
stretch it again. A second copy does not accumulate tempo stretches. Steady copied tempo
does not reproduce the band's within-section drift; reference playback warps
the canonical cycles. Fractional pickup output is first-pass only (G37).

## Proof

`npm test -- tests/section-operations.test.ts tests/section-links.test.ts` checks
invented fixtures end to end in pinned Strudel. The opt-in private proof uses
all six songs without writing their names, paths, notes or generated programs:

```sh
GHOST_SECTIONS_ROOT="$HOME/projects/ghost-notes/reference" GHOST_SECTIONS_SONG=1 npm test -- tests/sections-local.test.ts --silent=false
```

Repeat with `GHOST_SECTIONS_SONG=N` for each anonymous song (1–6), keeping
each run within the Node wall budget. The combined run can exceed that budget.
Each makes the first eight bars, accepts native offers, copies, pastes and
reopens the same folder, comparing every metadata field and queried note.
It separately plants two known copies of each song's real reference notes in
memory and measures recovery. This tests controlled recall; actual song form
has no independent ground-truth labels. Native-offer precision and recall,
UI warnings/selection, speaker output and perceived results are unmeasured.
