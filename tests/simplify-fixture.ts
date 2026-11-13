import { readReference } from '../src/reference/reader';
import { secondsToPosition } from '../src/reference/beats';
import { referenceFixture } from './fixtures/reference';

export async function simplifyFixture(
  id: string,
  entries: readonly (readonly number[])[],
  bars = 8,
) {
  const files = referenceFixture();
  const song = await readReference({
    read: async (p) => {
      const b = files.get(p);
      if (!b) throw Error('Missing fixture');
      return b;
    },
    exists: async (p) => files.has(p),
  });
  song.durationSeconds = bars * 2;
  song.beatMap = {
    ...song.beatMap,
    beats: Array.from({ length: bars * 4 + 1 }, (_, i) => i / 2),
    downbeats: Array.from({ length: bars + 1 }, (_, i) => i * 2),
    coverage: { ...song.beatMap.coverage, gaps: [] },
  };
  song.bars = Array.from({ length: bars }, (_, i) => ({
    number: i + 1,
    startSeconds: i * 2,
    endSeconds: (i + 1) * 2,
    startBeat: i * 4,
    endBeat: (i + 1) * 4,
    bpm: 120,
    partial: false,
    gaps: [],
  }));
  song.stems = [
    {
      ...song.stems[0],
      id,
      notes: entries.map(([startSeconds, endSeconds, pitch, velocity = 100]) => ({
        startSeconds,
        endSeconds,
        pitch,
        velocity,
        start: secondsToPosition(song.beatMap, startSeconds),
        end: secondsToPosition(song.beatMap, endSeconds),
      })),
    },
  ];
  return song;
}
