import { expect, test } from 'vitest';
import { convertInstrument } from '../src/convert';
import { simplifyDrums, matchNotes, defaultMatch } from '../src/simplify';
import { importStrudel } from '../src/import';
import { generate } from '../src/generate';
import { instruments } from '../src/document';
import { assertQueried } from './simplify-proof';
import { simplifyFixture } from './simplify-fixture';

test('drum templates query all runs, duplicate hits and tails; ODM retains one instrument', async () => {
  const song = await simplifyFixture(
    'drums',
    Array.from({ length: 8 }, (_, i) => [
      [i * 2, i * 2 + 0.2, 35, 100],
      [i * 2 + 0.5, i * 2 + 0.8, 42, 80],
      [i * 2 + 0.5, i * 2 + 0.8, 42, 80],
      [i * 2 + 1, i * 2 + 2.2, 38, 90],
    ]).flat(),
  );
  const conversion = convertInstrument({ song, stemId: 'drums', grid: 'exact' });
  const s = simplifyDrums({ song, conversion });
  expect(s.report.keptShare).toBe(1);
  expect(s.report.matchShare).toBe(1);
  expect(s.report.shorter).toBe(true);
  await assertQueried(s, 8);
  const doc = importStrudel(s.source).doc;
  expect(instruments(doc)).toHaveLength(1);
  await assertQueried({ ...s, source: generate(doc) }, 8);
});

test('fill protection and global drop/add budgets are independent of match tolerance', async () => {
  const entries = Array.from({ length: 8 }, (_, i) => [
    [i * 2, i * 2 + 0.1, 35],
    [i * 2 + 1, i * 2 + 1.1, 38],
    [i * 2 + 1.5, i * 2 + 1.6, 42],
    [i * 2 + 0.5, i * 2 + 0.6, 42],
  ]).flat();
  entries.push([3.75, 3.85, 47]);
  const song = await simplifyFixture('drums', entries);
  const conversion = convertInstrument({ song, stemId: 'drums' });
  expect(simplifyDrums({ song, conversion }).notes).toHaveLength(33);
  const s = simplifyDrums({ song, conversion, settings: { preserveFills: false } });
  expect(s.notes).toHaveLength(32);
  expect(s.changes.filter((c) => c.kind === 'dropped')).toHaveLength(1);
  expect(s.report.keptShare).toBeCloseTo(32 / 33);
  expect(s.report.matchShare).toBe(1);
  expect(
    simplifyDrums({ song, conversion, settings: { preserveFills: false, maxDropShare: 0 } }).notes,
  ).toHaveLength(33);
  await assertQueried(s, 8);
});

test('matching preserves multiplicity and honors quiet-note and octave settings', async () => {
  const song = await simplifyFixture('drums', [
    [0, 0.1, 35, 10],
    [0, 0.1, 35, 100],
  ]);
  const conversion = convertInstrument({ song, stemId: 'drums' });
  const s = simplifyDrums({ song, conversion, match: { countQuietNotes: false } });
  expect(s.report).toMatchObject({
    originalNotes: 1,
    suggestedNotes: 1,
    matchedNotes: 1,
    keptShare: 1,
    matchShare: 1,
  });
  const a = s.notes[0];
  expect(matchNotes([a, a], [a], defaultMatch)).toBe(1);
  expect(matchNotes([a], [{ ...a, pitch: a.pitch + 12 }], defaultMatch)).toBe(0);
  expect(
    matchNotes([a], [{ ...a, pitch: a.pitch + 12 }], { ...defaultMatch, pitch: 'any-octave' }),
  ).toBe(1);
  expect(() => simplifyDrums({ song, conversion, settings: { maxDropShare: NaN } })).toThrow();
});

test('drum templates preserve ghost-hit gain even when fills can change', async () => {
  const entries = Array.from({ length: 8 }, (_, i) => [
    [i * 2, i * 2 + 0.125, 35, i === 3 ? 5 : 127],
    [i * 2 + 1, i * 2 + 1.125, 38, i === 3 ? 5 : 127],
  ]).flat();
  const song = await simplifyFixture('drums', entries);
  const s = simplifyDrums({
    song,
    conversion: convertInstrument({ song, stemId: 'drums' }),
    settings: { preserveFills: false },
  });
  expect(s.notes.filter((n) => n.spanIndex === 3).map((n) => n.velocity)).toEqual([5, 5]);
  await assertQueried(s, 8);
});

test('shifted notes keep their durations, and floating bar endpoints add no crossing mark', async () => {
  const song = await simplifyFixture('bass', [
    [0.2504, 0.5004, 48, 100],
    [2, 4, 50, 100],
  ]);
  const { cleanStrays } = await import('../src/simplify');
  const s = cleanStrays({ song, conversion: convertInstrument({ song, stemId: 'bass' }) });
  expect(s.changes.filter((c) => c.noteIndices.includes(0)).map((c) => c.kind)).toEqual(['moved']);
  const { changeRecords } = await import('../src/simplify/report');
  const conversion = convertInstrument({ song, stemId: 'bass' });
  const records = changeRecords(
    { song, conversion },
    s.notes.map((n) => (n.noteIndices[0] === 1 ? { ...n, endSeconds: 4 + 1e-14 } : n)),
  );
  expect(records.filter((c) => c.noteIndices.includes(1))).toEqual([]);
});
