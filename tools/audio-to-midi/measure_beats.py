"""Reassemble beat metadata from local exported detections, without models or writes.

No source manifests, audio, stems or transcriptions are read. Labels are anonymous.
"""
import argparse
import json
from pathlib import Path
from contract import beat_document


def measure(root: Path) -> list[dict]:
    rows = []
    for source in ['first-test-session', 'diversity-1', 'diversity-2']:
        for i, path in enumerate(sorted((root / source / 'songs').glob('*/beats.json')), 1):
            old = json.loads(path.read_text())
            new = beat_document(old['beats'], old['downbeats'], old['duration_seconds'], old['beats_per_bar'])
            rows.append({'input': f'first test session, song {i}' if source == 'first-test-session' else source,
                         'gaps_before': len(old['coverage']['gaps']),
                         'gaps_after': len(new['coverage']['gaps']),
                         'level_runs': len(new['coverage']['level_switches']),
                         'detected_unchanged': new['beats'] == old['beats'] and new['downbeats'] == old['downbeats']})
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    args = parser.parse_args()
    print(json.dumps(measure(args.root), indent=2))
