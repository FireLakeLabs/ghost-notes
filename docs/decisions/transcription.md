# Decisions: transcription (G40–G42)

Decided for the owner during step 4 on 2026-11-13, within the approved move.
The index is [decisions](../decisions.md).

- **G40: version 1 song folders.** A song folder has `song.json`,
  `notes.json`, `beats.json`, a combined MIDI and each stem's WAV and MIDI.
  JSON imports have an integer version; paths are relative to the song folder.
  The manifest is published last and lists the complete import set. All stems
  remain available, including audio and empty notes for stems below the
  transcription threshold. This serves G20, G24 and G25 without making step 5
  infer relationships from filenames. The tool README defines every field.
- **G41: cache by content and configuration.** Hash source bytes, chapter
  bounds, settings, model identifiers, dependency lock and pipeline code.
  A completed separation marker distinguishes success from partial files.
  A code change intentionally invalidates the whole pipeline; correctness
  comes before selectively recovering expensive inference.
- **G42: preserve uncertain timing as evidence.** Never extend detected beats
  in the JSON. Record their first/last times, uncovered edges and gaps above
  1.5 times the median interval. Flag median tempos below 80 or above 180 BPM
  as possible half/double tempo and include all three candidates and evidence.
  Missing tempo is flagged too. The heuristic cannot establish intent or rule
  out ambiguity within its range. Leave multiplier 1 selected for the app to
  ask (G27). MIDI may extrapolate edge intervals for playback, explicitly
  labelled separately from detected timing.
