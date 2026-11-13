import { expect, test } from 'vitest';
import { referenceFixture } from '../../tests/fixtures/reference';
import { readReference } from './reader';
import { deriveGrid, gridCandidates } from './grid';
import { barBeatToPosition, beatToPosition, secondsToPosition } from './beats';
import type { BeatMap } from './types';
async function fixtureMap(): Promise<BeatMap> {
  const files = referenceFixture();
  return (
    await readReference({
      read: async (p) => files.get(p)!,
      exists: async (p) => files.has(p),
    })
  ).beatMap;
}
async function mapFor(lengths: number[], counts = lengths.map(() => 4)) {
  const map = await fixtureMap(),
    beats = [0],
    downbeats = [0];
  for (const [i, length] of lengths.entries()) {
    const start = downbeats.at(-1)!;
    for (let j = 1; j <= counts[i]; j++) beats.push(start + (length * j) / counts[i]);
    downbeats.push(start + length);
  }
  return {
    ...map,
    beats,
    downbeats,
    durationSeconds: beats.at(-1)!,
    coverage: { ...map.coverage, gaps: [] },
  };
}
const lengthsOf = (map: ReturnType<typeof deriveGrid>) =>
  map.bars.filter((b) => !b.partial).map((b) => b.endSeconds - b.startSeconds);
test('short detected bars merge and long bars split with reasons, without changing detection', async () => {
  const map = await mapFor([2, 2, 1, 1, 0.5, 0.5, 0.5, 0.5, 4, 2], [4, 4, 2, 2, 1, 1, 1, 1, 8, 4]);
  const before = JSON.stringify(map),
    grid = deriveGrid(map);
  expect(lengthsOf(grid)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  expect(grid.inferences.filter((i) => i.kind === 'merge-short-bars')).toHaveLength(4);
  expect(grid.inferences.filter((i) => i.kind === 'split-long-bar')).toHaveLength(1);
  expect(JSON.stringify(map)).toBe(before);
});
test('fill and thin beats to the meter and query the chosen grid in both directions', async () => {
  const map = await mapFor([2, 2, 2, 2], [4, 4, 2, 8]),
    grid = deriveGrid(map);
  expect(grid.bars.filter((b) => !b.partial).map((b) => b.endBeat - b.startBeat)).toEqual([
    4, 4, 4, 4,
  ]);
  expect(grid.inferences.filter((i) => i.kind === 'fill-beat')).toHaveLength(2);
  expect(grid.inferences.filter((i) => i.kind === 'thin-beat')).toHaveLength(4);
  expect(secondsToPosition(grid.map, 5.5)).toMatchObject({ bar: 3, beat: 11, beatInBar: 3 });
  expect(beatToPosition(grid.map, 11)?.seconds).toBe(5.5);
  expect(barBeatToPosition(grid.map, 3, 3)?.seconds).toBe(5.5);
});
test('gradual drift and a deliberate non-octave tempo change retain their exact boundaries', async () => {
  const lengths = [2, 2.05, 2.1, 2.15, 2.2, 2.25, 3, 3, 3, 3, 3];
  expect(lengthsOf(deriveGrid(await mapFor(lengths)))).toEqual(
    expect.arrayContaining(lengths.map((n) => expect.closeTo(n, 8))),
  );
});
test('true gaps, pickup and uncovered edges stay explicit in every candidate', async () => {
  const map = await fixtureMap();
  for (const grid of gridCandidates(map)) {
    expect(grid.map.downbeats[0]).toBe(0.5);
    expect(grid.bars[0]).toMatchObject({
      number: 0,
      startSeconds: 0,
      endSeconds: 0.5,
      partial: true,
    });
    expect(secondsToPosition(grid.map, 5.5).kind).toBe('gap');
    expect(secondsToPosition(grid.map, 7.75).kind).toBe('uncovered');
  }
});
test('half, normal and double tempo are grids from the same derivation', async () => {
  const map = await mapFor([2, 2, 2, 2]);
  expect(gridCandidates(map).map((g) => lengthsOf(g))).toEqual([
    [4, 4],
    [2, 2, 2, 2],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ]);
});
test('missing downbeats do not invent numbered bars', async () => {
  expect(deriveGrid({ ...(await fixtureMap()), downbeats: [] }).bars).toEqual([]);
});

test('thinning a six-beat bar does not preserve alternating half/double intervals', async () => {
  const grid = deriveGrid(await mapFor([2, 2, 2, 3], [4, 4, 4, 6]));
  expect(grid.map.beats.filter((b) => b >= 6)).toEqual([6, 6.75, 7.5, 8.25, 9]);
});
test('a two-bar merge needs beat evidence at its split point', async () => {
  const grid = deriveGrid(await mapFor([2, 2, 2, 1.5, 2], [4, 4, 4, 3, 4]));
  expect(grid.map.downbeats).toEqual([0, 2, 4, 6, 7.5, 9.5]);
});

test('a supported two-bar merge retains its phase', async () => {
  expect(deriveGrid(await mapFor([2, 2, 1.5, 2.5, 2], [4, 4, 3, 5, 4])).map.downbeats).toEqual([
    0, 2, 4, 6, 8, 10,
  ]);
});
