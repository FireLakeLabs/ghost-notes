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

- **G110 (2026-11-13) Keep the lens and draft relationship from G85.** The
  shell has one timeline and the explicitly unlinked whole-program draft below
  it until section links reach the UI. Move the timeline's live settings host
  into Settings, preserving its handlers. Selection, snap and stem-audio state
  stay with the timeline; conversion, match, simplify and starting-content state
  stay with their owner. This refines G109's single-object detail: there is one
  settings place, with no cloned controls or persistence.
- **G111 (2026-11-13) Install through the browser without a service worker.**
  A standalone manifest, original blue lines and cream note marks, and 192/512
  PNG icons identify the app. Chromium's installability check reports no
  errors without a worker, so none is added. Installing does not add offline
  music storage; the existing retained folder handle remains G48's exception.
- **G112 (2026-11-13) Use the prototype palette across the shell.** Near-black
  canvas, gray panels, cream text, blue recording and orange differences share
  CSS tokens. Gold identifies transport/focus actions. The original icon repeats
  the recording/arrangement colors. Text tokens must meet AA contrast on each
  shell surface; disabled controls are exempt as inactive controls.
