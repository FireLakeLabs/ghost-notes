import { test, expect } from 'vitest';
import { readReference } from '../reference/reader';
import { timelineFixture } from '../../tests/fixtures/timeline';
import { candidateGrid, chooseGrid, splitMeter } from './grid-choice';
test('explicit meter and one regroup without retiming beats or notes, including after tempo change', async () => {
  const files = timelineFixture();
  const song = await readReference({
    read: async (p) => files.get(p) ?? new Uint8Array(),
    exists: async (p) => files.has(p),
  });
  const grid = candidateGrid(song, 1, { beatsPerBar: 2, firstBeat: 1 });
  expect(grid.map.downbeats.slice(0, 3)).toEqual([1, 2, 3]);
  expect(grid.map.beats).toEqual(song.beatMap.beats);
  const changed = chooseGrid(song, grid);
  expect(changed.bars[1]).toMatchObject({ number: 1, startSeconds: 1, endSeconds: 2 });
  expect(changed.detectedBars).toBe(song.detectedBars);
  expect(changed.stems.flatMap((s) => s.notes.map((n) => n.startSeconds))).toEqual(
    song.stems.flatMap((s) => s.notes.map((n) => n.startSeconds)),
  );
  expect(candidateGrid(changed, 2, { beatsPerBar: 4, firstBeat: 0 }).map.beats).toEqual(
    candidateGrid(song, 2, null).map.beats,
  );
  const automatic = candidateGrid(song, 2, null);
  expect(automatic.inferences.some((i) => i.kind === 'split-long-bar')).toBe(true);
  const explicit = candidateGrid(song, 2, { beatsPerBar: 4, firstBeat: 0 });
  expect(
    explicit.inferences.some((i) => i.kind === 'split-long-bar' || i.kind === 'merge-short-bars'),
  ).toBe(false);
  expect(explicit.inferences.length).toBeGreaterThan(0); // beat evidence still applies
  expect(() => candidateGrid(song, 1, { beatsPerBar: 0, firstBeat: 0 })).toThrow(
    'Invalid bar grouping',
  );
  expect(
    splitMeter({
      ...song,
      detectedBars: song.detectedBars.map((b, i) => ({
        ...b,
        partial: false,
        gaps: [],
        endBeat: b.startBeat + (i % 2 ? 2 : 4),
      })),
    }),
  ).toBe(true);
});

test('regrouping restarts after a gap without assuming its missing beat count', async () => {
  const files = timelineFixture();
  const data = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
  data.coverage.gaps = [[23.5, 26]];
  data.beats = data.beats.filter((t: number) => t !== 24);
  files.set('beats.json', new TextEncoder().encode(JSON.stringify(data)));
  const song = await readReference({
    read: async (p) => files.get(p) ?? new Uint8Array(),
    exists: async (p) => files.has(p),
  });
  const base = candidateGrid(song, 1, null);
  const grouped = candidateGrid(song, 1, { beatsPerBar: 4, firstBeat: 0 });
  expect(grouped.map.downbeats.filter((t) => t >= 26).slice(0, 4)).toEqual(
    base.map.downbeats.filter((t) => t >= 26).slice(0, 4),
  );
  expect(grouped.inferences.every((i) => i.kind === 'fill-beat' || i.kind === 'thin-beat')).toBe(
    true,
  );
  expect(grouped.bars.flatMap((b) => b.inferences ?? [])).toEqual(grouped.inferences);
  const shifted = candidateGrid(song, 1, { beatsPerBar: 4, firstBeat: 1 });
  expect(shifted.map.downbeats.filter((t) => t >= 26).slice(0, 4)).toEqual([
    26.5, 28.5, 30.5, 32.5,
  ]);
});

test('resumed beats before the next downbeat remain in the bar crossing the gap', async () => {
  const files = timelineFixture();
  const data = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
  data.downbeats = data.downbeats.filter((t: number) => t !== 26);
  files.set('beats.json', new TextEncoder().encode(JSON.stringify(data)));
  const song = await readReference({
    read: async (p) => files.get(p) ?? new Uint8Array(),
    exists: async (p) => files.has(p),
  });
  for (const factor of [0.5, 1, 2] as const)
    for (const firstBeat of [0, 2]) {
      const base = candidateGrid(song, factor, null);
      const next = base.map.downbeats.find((t) => t >= 26)!;
      const restart = base.map.beats[base.map.beats.indexOf(next) + firstBeat];
      const grouped = candidateGrid(song, factor, { beatsPerBar: 3, firstBeat });
      expect(grouped.map.downbeats.filter((t) => t > 24 && t < restart)).toEqual([]);
      expect(grouped.map.downbeats).toContain(restart);
      const terminal = grouped.bars.findLast((b) => b.endSeconds > b.startSeconds);
      if (terminal && terminal.endBeat - terminal.startBeat < 3)
        expect(terminal.partial).toBe(true);
    }
});
