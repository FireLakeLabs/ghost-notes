# Reference data

`src/reference/reader.ts` reads version 1 song folders through `SongFiles`
(`read` and `exists`). It has no DOM, audio, filesystem or Strudel dependency.
Provenance is not retained. JSON is validated before MIDI is read. Missing
notes JSON falls back to stem MIDI; malformed or unsupported JSON fails.

`ReferenceSong` holds stems, RMS levels, transcription status, original note
seconds/velocity and secondary MIDI notes. `detectedBeatMap` and `detectedBars`
preserve the imported evidence. `beatMap`, `bars` and note positions describe
the chosen derived grid (1× by default, G53–G56). `readReference(files, factor)`
accepts 0.5, 1 or 2; `gridCandidates(map)` derives all three through `deriveGrid`.
The app's tempo choice re-reads coordinates without decoding audio again.
`grid.multiplier` is authoritative for the chosen grid. `medianBpm` and
`tempoReview` (including `selected_multiplier: 1`) describe detection on both
maps; use grid bars/queries for derived tempo and coordinates.

`ReferenceBar` retains its original fields: number, exact start/end seconds,
beat coordinates, BPM, partial flag and intersecting gaps. Optional `inferences`
record `kind`, `seconds` and `[start, end]` source evidence for added/removed
bar lines and beats. `song.grid.inferences` is the complete ledger. The
[grid decisions](decisions/grid.md) define estimation, inference and ambiguity.
Short terminal segments stay partial; the last detected beat is the map's end.
A final downbeat can still be a zero-length partial marker with null BPM.

`secondsToPosition`, `beatToPosition` and `barBeatToPosition` work with either
map. Beat zero and bar 1 remain at the first detected downbeat; negative
coordinates belong to pickup bar 0. Bar-local beats start at zero. Interpolation
is linear between the chosen map's beats; `kind: 'detected'` means covered by
that map, not necessarily an original observation. Consult the inference ledger
for provenance. True gaps return `kind: 'gap'`, with no inferred missing-beat
count. Outside coverage, coordinates are null and `kind` is `uncovered`. No
downbeats means no numbered bars. Playback must query the map to preserve
within-bar timing (step 9).

Version 1's additive `coverage.level_switches` separates sustained interval
runs from isolated gaps. Legacy folders without it get derived coverage from
the same rule; `detectedBeatMap.coverage` remains unchanged. See the
[tool contract](../tools/audio-to-midi/README.md).

The picker and drop/input adapters in `folders.ts` share `SongFiles`. Source
manifests scope paths to selected song folders. Handle storage is optional;
permission denial is recoverable through opening again. The drop adapter uses
legacy directory entries where available, without reading unlisted file bytes.

`mountReference` returns a current `{song, audio}` port; its `audio` map is
keyed by stem id. Each entry contains an AudioBuffer, waveform min/max pairs
(one bin per 1024 frames across all channels), decode time and byte counts.
Buffers survive closure of the decoding context and can be scheduled in the
step 9 playback context. Opening another song releases the prior reference
before decoding; failed imports leave no current reference. Dropping while
busy is ignored. The opt-in `?inspect` diagnostic exposes this port as
`window.ghostReference`, alongside the existing app diagnostic.
