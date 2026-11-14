# Sections and links

- **G91 (2026-11-13) Store source and place links in ODM's existing comments.**
  Patterns own the original half-open source range, edited flag and optional
  stem id. Arrangement parts own each place's half-open range and tempo in
  cycles per minute. Store a local folder basename, never a path or notes.
  Reopening explicitly matches that folder, its numbered bars and stem ids;
  unresolved links remain visible as unresolved data. Optional fields extend
  document v2 and keep older ODM imports valid. This implements G3/G25/G28
  without introducing a second saved document.
