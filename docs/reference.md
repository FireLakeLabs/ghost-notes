# Reference data

`src/reference/reader.ts` reads version 1 song folders through `SongFiles`
(`read` and `exists`). It has no DOM, audio, filesystem or Strudel dependency.
Provenance is not retained. JSON is validated before MIDI is read. Missing
notes JSON falls back to stem MIDI; malformed or unsupported JSON fails.

`ReferenceSong` holds named stems, RMS levels, transcription status, original
note seconds and velocity, secondary MIDI notes, detected timing and tool
warnings. `BeatMap` retains coverage and tempo-review fields without replacing
the tool's heuristic. `ReferenceBar` has exact start/end seconds and observed
beat coordinates, an average BPM, a partial flag and intersecting tool gaps.
The final bar ends at the final detected beat; untracked audio stays untracked.
If that beat is a downbeat, its partial bar has zero length and null BPM.

`secondsToPosition`, `beatToPosition` and `barBeatToPosition` support later
conversion, drawing and playback. Beat zero is the first detected downbeat;
negative coordinates belong to pickup bar 0. Bar-local beats start at zero.
Interpolation between observed beats is linear, including tool-marked gaps,
which return `kind: 'gap'`. It does not infer a missing-beat count. Outside the
map, positions are `uncovered` with null beat coordinates. No downbeats means
no numbered bars. Callers must handle these variants before quantizing or
scheduling. Each bar's tempo is observed beat intervals / elapsed seconds;
playback should query the map to preserve within-bar timing (step 9).

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
