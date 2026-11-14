import { test, expect } from 'vitest';
import { timelineFixture } from '../../tests/fixtures/timeline';
import { readReference } from '../reference/reader';
import { selectRange, lensProjection, project, interpolate, plain } from './range';
test('bar and beat selections retain half-open note bounds and containing bars in either direction', async () => {
  const files = timelineFixture();
  const song = await readReference({
    read: async (p) => files.get(p) ?? new Uint8Array(),
    exists: async (p) => files.has(p),
  });
  const band = selectRange(song, 1.2, 3.2, 'bars', { kind: 'band' });
  expect(band).toMatchObject({
    firstBar: 1,
    lastBar: 2,
    start: { seconds: 0.5 },
    end: { seconds: 4.5 },
    scope: { kind: 'band' },
  });
  const stem = selectRange(song, 3.2, 1.2, 'beats', { kind: 'instrument', stemId: 'bass' });
  expect(stem).toMatchObject({
    firstBar: 1,
    lastBar: 2,
    start: { seconds: 1 },
    end: { seconds: 3.5 },
    scope: { stemId: 'bass' },
  });
  expect(selectRange(song, 51, 52, 'bars', { kind: 'band' })).toBeNull();
});
test('lens occupies 68%, squeezes the rest, and interpolated positions invert', () => {
  const target = lensProjection(0.25, 0.5);
  expect(project(target, 0.5) - project(target, 0.25)).toBeCloseTo(0.68);
  for (const t of [0, 0.25, 0.75, 1])
    for (const u of [0, 0.1, 0.25, 0.4, 0.5, 0.9, 1]) {
      const p = interpolate(plain, target, t);
      expect(project(p, project(p, u), true)).toBeCloseTo(u);
    }
});
