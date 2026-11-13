import { referenceFixture } from './reference';
/** Invented band, never derived from local material. */
export function timelineFixture(): Map<string, Uint8Array> {
  const files = referenceFixture();
  const encode = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  const ids = ['vocals', 'other', 'bass', 'drums', 'guitar', 'keys'];
  const beats = Array.from({ length: 98 }, (_, i) => i * 0.5 + (i >= 49 ? 1.5 : 0));
  const duration = 52;
  files.set(
    'song.json',
    encode({
      version: 1,
      name: 'Invented band',
      duration_seconds: duration,
      pickup_beats: 1,
      notes: 'notes.json',
      beats: 'beats.json',
      midi: 'song.mid',
      stems: ids.map((id) => ({
        id,
        audio: `stems/${id}.wav`,
        midi: `stems/${id}.mid`,
        level_db: id === 'other' ? -55 : -18,
        transcription: id === 'other' ? 'skipped_quiet' : 'complete',
      })),
    }),
  );
  files.set(
    'beats.json',
    encode({
      version: 1,
      duration_seconds: duration,
      beats,
      downbeats: beats.filter((_, i) => i % 4 === 1),
      beats_per_bar: 4,
      bpm_median: 120,
      coverage: {
        status: 'partial',
        first_beat_seconds: 0,
        last_beat_seconds: beats.at(-1),
        leading_seconds: 0,
        trailing_seconds: duration - beats.at(-1)!,
        gaps: [[24, 26]],
        gap_threshold_median_multiple: 1.5,
      },
      tempo_review: {
        flagged: false,
        reasons: [],
        selected_multiplier: 1,
        candidate_multipliers: [0.5, 1, 2],
        candidate_bpm: [60, 120, 240],
        evidence: {
          median_interval_seconds: 0.5,
          detected_beats: beats.length,
          review_bpm_range: [80, 180],
        },
      },
    }),
  );
  files.set(
    'notes.json',
    encode({
      version: 1,
      time_unit: 'seconds',
      stems: Object.fromEntries(
        ids.map((id, k) => [
          id,
          id === 'other'
            ? []
            : Array.from({ length: id === 'drums' ? 240 : 72 }, (_, i) => {
                const start = i * (id === 'drums' ? 0.21 : 0.7);
                return [
                  start,
                  Math.min(duration, start + (id === 'drums' ? 0.08 : 0.4)),
                  id === 'drums'
                    ? [36, 42, 38, 42, 45, 49][i % 6]
                    : (id === 'bass' ? 36 : 55 + k) + [0, 3, 7, 3, 5, 8, 7, 3][i % 8],
                  70 + (i % 50),
                ];
              }),
        ]),
      ),
    }),
  );
  const frames = duration * 8000,
    bytes = new Uint8Array(44 + frames * 2),
    view = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++)
    view.setInt16(44 + i * 2, Math.sin(i * 0.13) * Math.exp(-(i % 4000) / 1200) * 12000, true);
  for (const id of ids) {
    files.set(`stems/${id}.wav`, bytes);
    files.set(`stems/${id}.mid`, files.get('song.mid')!);
  }
  return files;
}
