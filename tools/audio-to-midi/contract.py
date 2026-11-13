"""Version 1 local reference contract. Standard library only; no model imports."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
from statistics import median

VERSION = 1


def cache_key(source_digest: str, settings: dict, bounds: list) -> str:
    payload = {'version': VERSION, 'source_sha256': source_digest,
               'settings': settings, 'bounds_seconds': bounds}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, allow_nan=False).encode()).hexdigest()


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def detected_pickup(beats: list[float], downbeats: list[float]) -> int:
    """Observed beats before bar 1, excluding extrapolated intro beats."""
    return sum(beat < downbeats[0] for beat in beats) if downbeats else 0


def beat_document(beats: list[float], downbeats: list[float], duration: float, per_bar: int) -> dict:
    """Keep observations, expose their limits, and suggest a tempo review, never choose."""
    intervals = [b - a for a, b in zip(beats, beats[1:])]
    if any(gap <= 0 for gap in intervals) or any(not 0 <= b <= duration for b in beats):
        raise ValueError('Beats must increase within the audio duration')
    interval = median(intervals) if intervals else None
    bpm = round(60 / interval, 2) if interval else None
    gaps = [[a, b] for a, b in zip(beats, beats[1:]) if interval and b - a > 1.5 * interval]
    first, last = (beats[0], beats[-1]) if beats else (None, None)
    reasons = []
    if bpm is None:
        reasons.append('insufficient_beats')
    elif bpm < 80:
        reasons.append('median_bpm_below_80_possible_half_tempo')
    elif bpm > 180:
        reasons.append('median_bpm_above_180_possible_double_tempo')
    return {
        'version': VERSION, 'duration_seconds': duration, 'beats': beats,
        'downbeats': downbeats, 'beats_per_bar': per_bar, 'bpm_median': bpm,
        'coverage': {
            'status': 'missing' if not beats else ('complete' if first == 0 and last == duration and not gaps else 'partial'),
            'first_beat_seconds': first, 'last_beat_seconds': last,
            'leading_seconds': first if beats else duration,
            'trailing_seconds': round(duration - last, 4) if beats else duration,
            'gaps': gaps, 'gap_threshold_median_multiple': 1.5,
        },
        'tempo_review': {
            'flagged': bool(reasons), 'reasons': reasons, 'selected_multiplier': 1,
            'candidate_multipliers': [0.5, 1, 2],
            'candidate_bpm': [round(bpm * factor, 2) for factor in [0.5, 1, 2]] if bpm else [],
            'evidence': {'median_interval_seconds': interval, 'detected_beats': len(beats),
                         'review_bpm_range': [80, 180]},
        },
    }


def export_song(folder: Path, work: Path, metadata: dict, beats: dict,
                notes: dict, levels: dict) -> None:
    """Publish song.json last: its relative paths are the complete import set."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'song.json').unlink(missing_ok=True)
    (folder / 'stems').mkdir(exist_ok=True)
    stems = []
    for stem, level in levels.items():
        audio, midi = f'stems/{stem}.wav', f'stems/{stem}.mid'
        shutil.copyfile(work / 'stems' / f'{stem}.wav', folder / audio)
        shutil.copyfile(work / 'midi' / f'{stem}.mid', folder / midi)
        stems.append({'id': stem, 'audio': audio, 'midi': midi, 'level_db': level,
                      'transcription': 'complete' if stem in notes else 'skipped_quiet'})
    shutil.copyfile(work / 'song.mid', folder / 'song.mid')
    (folder / 'notes.json').write_text(json.dumps({
        'version': VERSION, 'time_unit': 'seconds',
        'stems': {stem: notes.get(stem, []) for stem in levels},
    }))
    (folder / 'beats.json').write_text(json.dumps(beats))
    (folder / 'song.json').write_text(json.dumps({
        **metadata, 'version': VERSION, 'notes': 'notes.json', 'beats': 'beats.json',
        'midi': 'song.mid', 'stems': stems,
    }, indent=2))
