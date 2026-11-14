# Copy out

`copyArrangement({doc, song?, folder?, options})` in `src/copy/` returns text,
silent-bar count, warnings and first-pass duration in seconds. It never changes
the document. A draft with no complete place links is copied as written; the
panel explains why reference fills and place tempos are unavailable. `folder`
is the selected local basename, independently of the song's display name.

Linked places follow their source order. Each retains its source, label and
editable tempo. Missing tempos use the reference place's mean seconds per
cycle. The fixed clock is 60 cycles/minute; each place uses
`[cycles * factor, pattern.slow(factor)]`, where `factor = 60 / tempo`.
Step 8’s `generateCopy` retains `songCycles` and `tempoScale` in `@odm-part`
so copying a reopened export does not apply it twice. A changed wrapper is retained as authored code and its tempo link removed,
with the importer’s warning (G95).

Edited sections remain as written. Unedited sections can stay as made, use the
original definition's literal source on the session grid, or use the shortest
complete simplify proposal that actually shortens that literal. Reused sections
keep one replacement definition and each place's own tempo. Session limits and
match criteria are passed to the simplify API; they are not saved in metadata.

Unarranged numbered bars use silence, literal or simplified. The pickup is a
separate first place. Unnumbered edges use the same choice without claiming a
numbered source link. Reopened edges retain their written content and tempo. A fractional pickup works on the first pass only: stop
and restart Strudel before replaying (G37). Do not continuously loop that copy.

The panel previews the exact text and counts unarranged silent bars. A successful
clipboard write clears the changed marker. If clipboard access fails, select
and copy the preview, then use Mark copied. The browser's leaving warning is
armed while the document, reference or copy-affecting settings differ from the
last successful copy. Browser permission and user-activation rules still govern
whether it displays a native confirmation.

Node proof covers all three gap modes, both regenerated forms, edited content,
reuse, metadata and recopy timing. Browser proof uses the pinned Strudel seam's
real Cyclist scheduler and compares scheduled onsets on the first pass. The
opt-in local test uses `GHOST_COPY_ROOT` with an existing transcription root;
it prints only counts and duration, never source names, code or notes.

Generated fills carry `@ghost-notes-unarranged` in their existing pattern
comment. Reopening keeps them unarranged: changing the unedited choice never
turns a silent fill into notes. Their next written form follows the unarranged
choice; their per-place tempo survives. A musical edit promotes the fill to
the user's own section.
After pasting, a marked fill must still match bare silence or a freshly
generated literal/simplified fill. Otherwise it becomes the user's own and
survives every Unedited choice. This also keeps a literal fill when a changed
grid or limit makes its previous content impossible to reproduce.
