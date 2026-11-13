import { expect, test } from 'vitest';
import { convertInstrument } from '../src/convert';
import {
  cleanStrays,
  joinSplitNotes,
  correctOctaves,
  intervalRiffs,
  scaleDegrees,
  euclideanFits,
  phraseRepeats,
  simplifyPitched,
} from '../src/simplify';
import { simplifyFixture } from './simplify-fixture';
import { assertQueried } from './simplify-proof';
import { importStrudel } from '../src/import';
import { generate } from '../src/generate';
import { instruments } from '../src/document';

test('cleaning proposals are separate, budgeted and retain source lineage', async () => {
  const song = await simplifyFixture('bass', [
    [0, 0.3, 48, 100],
    [0.31, 0.5, 48, 20],
    [1, 1.05, 61, 10],
    [2, 2.1, 48, 100],
    [2.2, 2.3, 60, 20],
    [2.4, 2.5, 48, 100],
    [4, 4.2, 50, 100],
    [6, 6.1, 50, 100],
    [8, 8.1, 50, 100],
    [10, 10.1, 50, 100],
  ]);
  const input = { song, conversion: convertInstrument({ song, stemId: 'bass' }) };
  const stray = cleanStrays(input),
    split = joinSplitNotes(input),
    octave = correctOctaves(input);
  expect(stray.notes).toHaveLength(9);
  expect(stray.changes.filter((c) => c.kind === 'dropped').map((c) => c.noteIndices)).toEqual([
    [2],
  ]);
  expect(cleanStrays({ ...input, settings: { maxDropShare: 0 } }).notes).toHaveLength(10);
  expect(split.notes).toHaveLength(9);
  expect(split.changes.find((c) => c.kind === 'merged')?.noteIndices).toEqual([0, 1]);
  expect(octave.notes.map((n) => n.pitch)).toEqual([48, 48, 61, 48, 48, 48, 50, 50, 50, 50]);
  for (const s of [stray, split, octave]) await assertQueried(s, 8);
});

test.each(['bass', 'keys'])(
  'all pitched techniques query their claimed notes for %s, with transposed riffs, scale exceptions and phrase phase',
  async (id) => {
    const entries = Array.from({ length: 8 }, (_, bar) =>
      Array.from({ length: 4 }, (_, step) => [
        bar * 2 + step * 0.5,
        bar * 2 + step * 0.5 + 0.25,
        48 + (bar % 2) * 2 + [0, 4, 7, 4][step],
        100,
      ]),
    ).flat();
    entries.push([0.25, 0.45, 49, 80]); // chromatic exception
    const song = await simplifyFixture(id, entries);
    const input = { song, conversion: convertInstrument({ song, stemId: id }) };
    for (const s of simplifyPitched(input)) {
      expect(s.report.keptShare).toBe(1);
      expect(s.report.matchShare).toBe(1);
      await assertQueried(s, 8);
      const doc = importStrudel(s.source).doc;
      expect(instruments(doc)).toHaveLength(1);
      await assertQueried({ ...s, source: generate(doc) }, 8);
    }
  },
);

test('interval templates share transposed riffs and Euclidean fits use the pinned orientation', async () => {
  const entries = Array.from({ length: 8 }, (_, bar) =>
    [0, 0.75, 1.5].map((offset, i) => [
      bar * 2 + offset,
      bar * 2 + offset + 0.125,
      48 + (bar % 2) * 2 + i * 2,
      100,
    ]),
  ).flat();
  const song = await simplifyFixture('keys', entries);
  const input = { song, conversion: convertInstrument({ song, stemId: 'keys' }) };
  const riff = intervalRiffs(input);
  expect(riff.report.shorter).toBe(true);
  await assertQueried(riff, 8);
  const constant = await simplifyFixture(
    'keys',
    entries.map((n) => [n[0], n[1], 60, 100]),
  );
  const fit = euclideanFits({
    song: constant,
    conversion: convertInstrument({ song: constant, stemId: 'keys' }),
  });
  expect(fit.source).toContain('euclidRot(3,8,0)');
  await assertQueried(fit, 8);
  const phrase = phraseRepeats(input);
  await assertQueried(phrase, 8);
  const scale = scaleDegrees(input);
  await assertQueried(scale, 8);
});

test('all techniques retain fractional pickup, uncovered tail and changing beat coordinates', async () => {
  const { readReference } = await import('../src/reference/reader');
  const { referenceFixture } = await import('./fixtures/reference');
  const files = referenceFixture();
  const song = await readReference({
    read: async (p) => {
      const b = files.get(p);
      if (!b) throw Error('Missing fixture');
      return b;
    },
    exists: async (p) => files.has(p),
  });
  const conversion = convertInstrument({ song, stemId: 'bass' });
  for (const s of simplifyPitched({ song, conversion }))
    await assertQueried(s, conversion.spans.at(-1)?.endCycle ?? 0);
});

test('a rotated Euclidean rhythm retains every onset and tail', async () => {
  const entries = Array.from({ length: 8 }, (_, bar) =>
    [0.25, 1, 1.75].map((t) => [bar * 2 + t, bar * 2 + t + 0.125, 60, 100]),
  ).flat();
  const song = await simplifyFixture('keys', entries);
  const s = euclideanFits({ song, conversion: convertInstrument({ song, stemId: 'keys' }) });
  expect(s.source).toContain('euclidRot(3,8,1)');
  await assertQueried(s, 8);
});
