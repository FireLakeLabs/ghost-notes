# Copy and shell

- **G107 (2026-11-13) Copy timing uses one fixed 60 cpm clock.** Each place
  multiplies its musical length and pattern speed by 60 / place tempo. Missing
  tempos use the place's average seconds per cycle. Positive numbered places
  follow their reference order; overlaps fail explicitly. Step 8's `generateCopy` records
  `tempoScale` and `songCycles` in `@odm-part`; its importer restores canonical
  cycles on reopening, so repeated copying does not multiply tempo twice. Original
  section definitions and stem links remain. Edited sections are never replaced.
- **G108 (2026-11-13) Copy choices default to as-made and silence.** Simplified
  chooses the shortest complete proposal that actually shortens the literal,
  under the session limits; otherwise it retains literal. The preview reports
  silent bars and the pickup replay limit. Whole-program drafts without complete
  place links copy as written with an explanation. Clipboard failure exposes
  selectable text and an explicit Mark copied action.
- **G109 (2026-11-13) Settings live in one session dialog.** Selection, snap,
  conversion grid, match criteria, simplify limits and starting content share one
  in-memory object; reload resets it. Copy choices stay in the copy panel. The
  changed marker compares the document, open reference and copy-affecting settings
  with the last successful copy. Undo back to the copied state clears it.
  Renaming does not mark music edited; muting does, so regeneration cannot
  unmute a section. No music or settings enter persistent storage.

Generated fills retain an inert `@ghost-notes-unarranged` marker in the
existing pattern comment, so reopening does not turn gaps into sections.
The next copy applies the unarranged choice again and retains an edited place
tempo. A musical edit marks the fill edited and makes it the user's own.
The marker alone is not trusted after a paste: only bare silence or content
matching a current literal/simplified fill remains unarranged. Mismatches are
kept as the user's own, including when changed settings caused the mismatch.
Names given to gap places are retained.
