# audio-to-midi

Turns local audio or a YouTube URL into song folders for Ghost Notes. Copied
from `FireLakeLabs/order-doesnt-matter` at `26c3689` (2026-11-13), then fixed
here. Standalone Python; outside the app build. Its models run locally.

## Run

Needs `uv`, `ffmpeg`, and Node or Deno (for YouTube).

```bash
cd tools/audio-to-midi
uv python install 3.10
uv sync --locked
uv run extract.py ~/Music/session.wav
uv run extract.py 'https://www.youtube.com/watch?v=...' --out ~/transcriptions
```

Default output: the checkout's git-ignored `reference/`. Never commit source
audio, stems, MIDI, transcriptions or conversions of other people's music (G4).

Options:

- `-o, --out DIR`: output root.
- `--chapters 1,3`: only these source chapters; one song per chapter.
- `--no-chapters`: treat the source as one song.
- `--model NAME`: Demucs model; `htdemucs_6s` (default) has six stems,
  `htdemucs_ft` has four.
- `--min-stem-db N`: skip transcription below this level relative to the mix
  (default −30 dB); keep that stem's audio and an empty MIDI.
- `--device auto|cpu|cuda`: default auto.
- `--force`: redo all stages.

Demucs separates; `beat_this` detects beats on the full mix; ADTOF transcribes
drums; Basic Pitch transcribes pitched stems. CPU separation is slow. For
concurrent local runs, limit `OMP_NUM_THREADS`, `MKL_NUM_THREADS` and
`OPENBLAS_NUM_THREADS` to leave room for other work.

## Version 1 folder contract (G40)

Open **one song folder**, identified by `song.json`. All manifest paths are
relative to that folder and use `/`. Read only the files listed there; old
unlisted files may remain after a rerun. `song.json` is published last; its
absence means the export is incomplete. The parent manifest lists song folders from the latest invocation (including
only selected chapters with `--chapters`); it is not needed to open one.

```text
reference/<source>/
  manifest.json                  version, source, settings, pieces[].folder
  interim/source.webm             downloaded source, URL inputs only
  .cache/<sha256>/                work files, not for app import
  songs/<song>/                  select this folder in the app
    song.json                    version 1, complete file list and provenance
    beats.json                   version 1, detected timing and warnings
    notes.json                   version 1, every stem's notes in seconds
    song.mid                     multitrack MIDI
    stems/<stem>.wav             44.1 kHz stereo PCM16
    stems/<stem>.mid             MIDI, including an empty file for quiet stems
```

Every JSON exposed for import has integer `version: 1`. Importers must reject
unknown versions. Cache files are private and are not this contract.

`song.json` contains `name`, `duration_seconds`, `source` (including source
SHA-256, start/end seconds in the source, null for the whole file), `settings`,
`cache_key`, `pickup_beats`, `midi_grid`, paths `notes`, `beats`, `midi`, and
`stems`: an array of `{id, audio, midi, level_db, transcription}`. Stem ids are
Demucs names (drums, bass, guitar, piano, vocals, other); `transcription` is
`complete` or `skipped_quiet`. All stems share time zero. `level_db` is RMS dB
relative to the mix, to help flag possible bleed. One stem is one instrument.

`notes.json` is `{version: 1, time_unit: "seconds", stems: {bass: [...], ...}}`.
Each note is `[start, end, pitch, velocity]`: seconds from the song's start,
MIDI pitch 0–127, velocity 1–127. Drums use pitches 35, 38, 47, 42, 49 (kick,
snare, tom, hi-hat, cymbal). Skipped and silent stems have empty arrays;
`song.json` distinguishes them. Bass and vocals are forced monophonic.

`beats.json` contains `duration_seconds`, `beats` and `downbeats` (ordered
seconds from the song's start), `beats_per_bar`, `bpm_median` (null without
two beats), `coverage` and `tempo_review`. Bar 1 starts at the first downbeat;
preceding detected beats are the pickup (G15). `song.json`
`pickup_beats` counts only those detected beats. MIDI extrapolates the intro
with ordinary bars and a partial bar, so a long untracked intro cannot become
one oversized time signature. Meter is the modal beat count between
downbeats, falling back to four; it is an estimate, not a meter-change map.

`coverage` records `status` (`complete`, `partial`, `missing`),
`first_beat_seconds`, `last_beat_seconds` (null if absent), `leading_seconds`,
`trailing_seconds`, and `gaps` as `[start, end]` pairs whose interval exceeds
`gap_threshold_median_multiple` (1.5) times the median. Complete means detected
beats reach both endpoints and have no such gaps. Usually the map is partial:
the app must show exactly where evidence starts/stops, including ordinary
fractions of a beat at the edges. **No detected beats are invented.** MIDI
alone extrapolates edge intervals (120 BPM if fewer than two beats); its
conductor track is a playback convenience, not evidence of detection there.

`tempo_review` contains `flagged`, machine-readable `reasons`,
`selected_multiplier: 1`, `candidate_multipliers: [0.5, 1, 2]`, `candidate_bpm`,
and `evidence` (`median_interval_seconds`, `detected_beats`,
`review_bpm_range: [80, 180]`). Below 80 BPM flags possible half tempo;
above 180 flags possible double tempo. Missing tempo flags insufficient beats.
This is a conservative range heuristic, not a classifier of musical intent.
It cannot rule out ambiguity inside that range. The detected map stays intact;
the app asks the user once (G27).

## Cache and failures (G41)

The key hashes source bytes, chapter bounds, separation model, minimum stem
level, device, sample rate, pitch ranges/monophony, model identifiers, the
locked dependencies, and both pipeline and contract code (including inference
thresholds). Changed settings or code create a fresh cache. Audio cuts are renamed into the cache only after ffmpeg succeeds. A completed
separation marker, removed before forced separation, prevents partial stem
output being treated as complete.
`--force` bypasses stage reuse; publishing always rebuilds the MIDI and manifest.

## Tests

```bash
python3 -m unittest discover -s tools/audio-to-midi -p 'test_*.py'
```

Run from the repository root. Standard library only: no torch, Demucs, model
downloads or third-party music. A separate two-minute CI job runs this command;
heavy model inference stays local. Real-material checks use paths outside git.

## Limits and licences

Basic Pitch estimates pitches, not playing techniques; stray or split notes
and bleed remain possible. No agent can hear: checks measure files and events.

The code of every dependency is open source. **ADTOF drum weights are
non-commercial share-alike: personal use only; never ship them.** The PyTorch
port declares no licence. Distribution needs permission or a replacement model.
Weights stay in the user's model cache and are never included in this repo,
CI, or the app build. Keep this restriction when moving or packaging the tool.
