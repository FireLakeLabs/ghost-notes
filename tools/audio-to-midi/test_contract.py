import json
from pathlib import Path
import tempfile
import unittest

from contract import classify_intervals, beat_document, cache_key, detected_pickup, export_song


class ContractTests(unittest.TestCase):
    def test_pickup_excludes_untracked_intro(self):
        self.assertEqual(detected_pickup([150, 150.5, 151, 151.5], [150]), 0)
        self.assertEqual(detected_pickup([30, 30.5, 31, 31.5], [31.5]), 3)
        self.assertEqual(detected_pickup([30], []), 0)

    def test_failed_audio_cut_does_not_publish_partial_file(self):
        import extract
        import subprocess
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            dst = Path(tmp) / 'audio.wav'
            dst.write_bytes(b'previous complete audio')
            def fail(cmd):
                Path(cmd[-1]).write_bytes(b'partial')
                raise subprocess.CalledProcessError(1, cmd)
            with patch.object(extract, 'run', side_effect=fail):
                with self.assertRaises(subprocess.CalledProcessError):
                    extract.cut_wav(Path(tmp) / 'source.webm', dst, None, None)
            self.assertEqual(dst.read_bytes(), b'previous complete audio')
            self.assertFalse(dst.with_suffix('.partial.wav').exists())

    def test_stopped_map_reports_exact_tail_without_inventing_beats(self):
        doc = beat_document([1, 2, 3], [1], 21, 4)
        self.assertEqual(doc['version'], 1)
        self.assertEqual(doc['beats'], [1, 2, 3])
        self.assertEqual(doc['coverage']['last_beat_seconds'], 3)
        self.assertEqual(doc['coverage']['trailing_seconds'], 18)
        self.assertEqual(doc['coverage']['leading_seconds'], 1)
        self.assertEqual(doc['coverage']['status'], 'partial')

    def test_missing_beats_and_internal_gaps_are_explicit(self):
        self.assertEqual(beat_document([], [], 10, 4)['coverage']['status'], 'missing')
        doc = beat_document([0, .5, 1, 3, 3.5, 4], [0], 4, 4)
        self.assertEqual(doc['coverage']['gaps'], [[1, 3]])
        self.assertEqual(doc['coverage']['status'], 'partial')
        self.assertEqual(beat_document([0, .5, 1], [0], 1, 4)['coverage']['status'], 'complete')

    def test_half_and_double_tempo_flag_with_evidence_no_rescaling(self):
        for beats, alternative in [([0, 1, 2, 3], 120), ([0, .25, .5, .75], 120)]:
            doc = beat_document(beats, [0], 4, 4)
            self.assertTrue(doc['tempo_review']['flagged'])
            self.assertIn(alternative, doc['tempo_review']['candidate_bpm'])
            self.assertEqual(doc['tempo_review']['selected_multiplier'], 1)
            self.assertTrue(doc['tempo_review']['reasons'])
            self.assertEqual(doc['beats'], beats)
        self.assertFalse(beat_document([0, .5, 1], [0], 1, 4)['tempo_review']['flagged'])
        self.assertTrue(beat_document([], [], 1, 4)['tempo_review']['flagged'])

    def test_persistent_metrical_levels_are_not_gaps(self):
        beats = [0, .25, .5, .75, 1, 1.5, 2, 2.5, 3, 3.25, 3.5, 3.75, 4]
        doc = beat_document(beats, [0, 1, 3, 4], 4, 4)
        self.assertEqual(doc['coverage']['gaps'], [])
        self.assertTrue(doc['coverage']['level_switches'])
        self.assertEqual(doc['beats'], beats)

    def test_shared_interval_fixtures(self):
        fixtures = Path(__file__).resolve().parents[2] / 'tests/fixtures/intervals.json'
        for fixture in json.loads(fixtures.read_text()):
            with self.subTest(case=fixture['case']):
                self.assertEqual(classify_intervals(fixture['beats']), {
                    'gaps': fixture['gaps'], 'level_switches': fixture['level_switches']})

    def test_cache_changes_with_content_settings_models_and_bounds(self):
        key = cache_key('audio-a', {'model': 'six', 'threshold': -30}, [0, 10])
        self.assertEqual(key, cache_key('audio-a', {'threshold': -30, 'model': 'six'}, [0, 10]))
        for source, settings, bounds in [
            ('audio-b', {'model': 'six', 'threshold': -30}, [0, 10]),
            ('audio-a', {'model': 'four', 'threshold': -30}, [0, 10]),
            ('audio-a', {'model': 'six', 'threshold': -20}, [0, 10]),
            ('audio-a', {'model': 'six', 'threshold': -30}, [1, 10]),
        ]:
            self.assertNotEqual(key, cache_key(source, settings, bounds))

    def test_folder_opens_from_manifest_including_skipped_stem(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            work = root / 'cache'
            (work / 'stems').mkdir(parents=True)
            (work / 'stems/bass.wav').write_bytes(b'synthetic audio')
            (work / 'stems/piano.wav').write_bytes(b'synthetic audio')
            (work / 'song.mid').write_bytes(b'synthetic MIDI')
            (work / 'midi').mkdir()
            for stem in ['bass', 'piano']:
                (work / f'midi/{stem}.mid').write_bytes(b'synthetic MIDI')
            folder = root / 'song'
            export_song(folder, work, {'name': 'fixture'},
                        beat_document([0, .5, 1], [0], 1, 4),
                        {'bass': [[0, .4, 40, 90]]}, {'bass': -5, 'piano': -50})
            manifest = json.loads((folder / 'song.json').read_text())
            self.assertEqual(manifest['version'], 1)
            for field in ['notes', 'beats', 'midi']:
                self.assertTrue((folder / manifest[field]).is_file())
            self.assertEqual([s['id'] for s in manifest['stems']], ['bass', 'piano'])
            for stem in manifest['stems']:
                for field in ['audio', 'midi']:
                    self.assertTrue((folder / stem[field]).is_file())
            notes = json.loads((folder / manifest['notes']).read_text())
            self.assertEqual(notes['version'], 1)
            self.assertEqual(notes['stems']['bass'], [[0, .4, 40, 90]])
            self.assertEqual(notes['stems']['piano'], [])
            self.assertEqual(manifest['stems'][1]['transcription'], 'skipped_quiet')


class PipelineCacheTests(unittest.TestCase):
    def test_changed_model_or_threshold_recomputes_and_exports_current_stems(self):
        import extract
        from types import SimpleNamespace
        from unittest.mock import patch

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = extract.Source('fixture', root / 'input.wav', [], {'sha256': 'fixture'})
            calls = []

            def separate(wav, stems, model, device):
                calls.append(model)
                stems.mkdir(parents=True, exist_ok=True)
                (stems / 'bass.wav').write_bytes(b'fixture')

            def midi(path, *args):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'fixture MIDI')

            class Grid:
                pickup = 0
                def __init__(self, *args):
                    pass

            with patch.multiple(extract,
                                cut_wav=lambda src, dst, *args: dst.write_bytes(b'fixture'),
                                separate=separate,
                                stem_levels=lambda *args: {'bass': -10},
                                track_beats=lambda *args: beat_document([0, .5, 1], [0], 1, 4),
                                transcribe_pitched=lambda *args: [[0, .4, 40, 90]],
                                Grid=Grid, write_midi=midi):
                args = SimpleNamespace(model='six', device='cpu', min_stem_db=-30, force=False)
                extract.process('fixture', src, None, None, root, args)
                extract.process('fixture', src, None, None, root, args)
                self.assertEqual(calls, ['six'])
                args.model = 'four'
                extract.process('fixture', src, None, None, root, args)
                self.assertEqual(calls, ['six', 'four'])
                args.min_stem_db = -5
                extract.process('fixture', src, None, None, root, args)
                self.assertEqual(calls, ['six', 'four', 'four'])
                manifest = json.loads((root / 'songs/fixture/song.json').read_text())
                self.assertEqual(manifest['stems'][0]['transcription'], 'skipped_quiet')


if __name__ == '__main__':
    unittest.main()
