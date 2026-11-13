import { writeMidi } from 'midi-file';
/** Entirely invented fixture: one pickup, two tempos, one explicitly marked gap. */
export function referenceFixture(): Map<string, Uint8Array> {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3.5, 4.5, 6.5, 7.5];
  const midi = new Uint8Array(
    writeMidi({
      header: { format: 1, numTracks: 2, ticksPerBeat: 480 },
      tracks: [
        [
          { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: 500000 },
          { deltaTime: 480, type: 'setTempo', microsecondsPerBeat: 1000000 },
          { deltaTime: 0, type: 'endOfTrack' },
        ],
        [
          { deltaTime: 240, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 100 },
          { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 60, velocity: 0 },
          { deltaTime: 0, type: 'endOfTrack' },
        ],
      ],
    }),
  );
  return new Map([
    [
      'song.json',
      encode({
        version: 1,
        name: 'Invented pickup',
        duration_seconds: 8,
        pickup_beats: 1,
        notes: 'notes.json',
        beats: 'beats.json',
        midi: 'song.mid',
        source: { path: 'PRIVATE-DO-NOT-RETAIN' },
        stems: [
          {
            id: 'bass',
            audio: 'stems/bass.wav',
            midi: 'stems/bass.mid',
            level_db: -18,
            transcription: 'complete',
          },
        ],
      }),
    ],
    [
      'beats.json',
      encode({
        version: 1,
        duration_seconds: 8,
        beats,
        downbeats: [0.5, 2.5, 7.5],
        beats_per_bar: 4,
        bpm_median: 120,
        coverage: {
          status: 'partial',
          first_beat_seconds: 0,
          last_beat_seconds: 7.5,
          leading_seconds: 0,
          trailing_seconds: 0.5,
          gaps: [[4.5, 6.5]],
          gap_threshold_median_multiple: 1.5,
        },
        tempo_review: {
          flagged: true,
          reasons: ['synthetic_review'],
          selected_multiplier: 1,
          candidate_multipliers: [0.5, 1, 2],
          candidate_bpm: [60, 120, 240],
          evidence: {
            median_interval_seconds: 0.5,
            detected_beats: 10,
            review_bpm_range: [80, 180],
          },
        },
      }),
    ],
    [
      'notes.json',
      encode({
        version: 1,
        time_unit: 'seconds',
        stems: {
          bass: [
            [0.25, 1, 60, 100],
            [5.5, 7.75, 62, 80],
          ],
        },
      }),
    ],
    ['song.mid', midi],
    ['stems/bass.mid', midi],
    ['stems/bass.wav', generatedWav()],
  ]);
}
/** 0.1 s, stereo, 8 kHz PCM16; a constant opposite-polarity signal tests both channels. */
export function generatedWav(): Uint8Array {
  const bytes = new Uint8Array(44 + 800 * 4),
    view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => (bytes[offset + i] = c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, 3200, true);
  for (let i = 44; i < bytes.length; i += 4) {
    view.setInt16(i, 8192, true);
    view.setInt16(i + 2, -16384, true);
  }
  return bytes;
}
