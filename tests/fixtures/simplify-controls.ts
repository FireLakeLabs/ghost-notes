import { referenceFixture } from './reference';

/** Eight invented bars, two instruments, one quiet stray and one drum fill. */
export function simplifyControlsFixture() {
  const files = referenceFixture();
  const put = (path: string, value: unknown) =>
    files.set(path, new TextEncoder().encode(JSON.stringify(value)));
  const manifest = JSON.parse(new TextDecoder().decode(files.get('song.json')));
  put('song.json', {
    ...manifest,
    name: 'Invented simplify section',
    duration_seconds: 17,
    stems: ['bass', 'drums'].map((id) => ({
      ...manifest.stems[0],
      id,
      audio: `stems/${id}.wav`,
      midi: `stems/${id}.mid`,
    })),
  });
  const beats = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
  put('beats.json', {
    ...beats,
    duration_seconds: 17,
    beats: Array.from({ length: 34 }, (_, i) => i / 2),
    downbeats: Array.from({ length: 9 }, (_, i) => 0.5 + i * 2),
    coverage: { ...beats.coverage, last_beat_seconds: 16.5, trailing_seconds: 0.5, gaps: [] },
    tempo_review: { ...beats.tempo_review, flagged: false, reasons: [] },
  });
  const notes = (drums: boolean) =>
    Array.from({ length: 8 }, (_, bar) =>
      [0, 0.5, 1, 1.5].map((step, i) => {
        const start = 0.5 + bar * 2 + step;
        return [
          start + (bar === 0 && i === 0 ? 0.03 : 0),
          start + 0.1,
          (drums ? [35, 42, 38, 42] : [48, 55, 48, 55])[i],
          100,
        ];
      }),
    ).flat();
  put('notes.json', {
    version: 1,
    time_unit: 'seconds',
    stems: {
      bass: [...notes(false), [2.25, 2.29, 62, 20]],
      drums: [...notes(true), [4.25, 4.35, 47, 100]],
    },
  });
  files.set('stems/drums.wav', files.get('stems/bass.wav')!);
  files.set('stems/drums.mid', files.get('stems/bass.mid')!);
  return files;
}
