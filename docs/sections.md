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
