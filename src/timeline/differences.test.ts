import { expect, test } from 'vitest';
import { sectionFixture } from '../../tests/section-fixture';
import { convertInstrument } from '../convert';
import { defaultMatch } from '../simplify';
import { timedNote, type InstrumentMaterial } from './material';
import { compareMaterial, explainDifference } from './differences';
import { noteMarks, timelineAxis } from './layout';
import { differenceDrawing } from './difference-layer';

async function fixture() {
  const song = await sectionFixture();
  const stem = song.stems[0];
  const note = (start: number, end: number, pitch = 60, velocity = 90) =>
    timedNote(song, start, end, pitch, velocity);
  const material: InstrumentMaterial = {
    literal: { notes: [], message: '' },
    mine: { notes: [], message: '' },
    places: [
      {
        id: 'a',
        name: 'Verse',
        edited: false,
        fromBar: 1,
        toBar: 2,
        startSeconds: 0.5,
        endSeconds: 2.5,
      },
    ],
  };
  return { song, stem, note, material };
}
test('all four literal marks carry converter evidence rather than guessed changes', async () => {
  const { song, stem, note, material } = await fixture();
  stem.notes = [note(0.53, 2.52), note(0.55, 0.8), note(1.03, 1.4, 64)];
  material.conversion = convertInstrument({ song, stemId: stem.id });
  const marks = compareMaterial(song, stem, material, defaultMatch).notes;
  expect(new Set(marks.map((m) => m.kind))).toEqual(
    new Set(['moved', 'moved-across-bar-line', 'shortened', 'merged']),
  );
  expect(marks.map((m) => [m.kind, m.original, m.written])).toEqual(
    material.conversion.changes.map((c) => [c.kind, c.original, c.written]),
  );
  expect(marks.find((m) => m.kind === 'merged')?.original).toHaveLength(2);
  expect(marks.every((m) => explainDifference(m).includes('s'))).toBe(true);
});
test('bar matches retain multiplicity and use the session timing, octave and quiet-note settings', async () => {
  const { song, stem, note, material } = await fixture();
  stem.notes = [note(0.6, 0.8), note(0.6, 0.8), note(0.9, 1.1, 72, 20), note(2.5, 2.7)];
  material.mine.notes = [note(0.62, 0.7, 72), note(0.93, 1, 72), note(4.6, 5)];
  const exact = compareMaterial(song, stem, material, defaultMatch);
  expect(exact.bars.map((b) => [b.bar.number, b.matched, b.recording, b.mine, b.share])).toEqual([
    [1, 1, 3, 2, 1 / 4],
  ]);
  expect(exact.mine.map((m) => m.kind).sort()).toEqual([
    'only-recording',
    'only-recording',
    'only-yours',
  ]);
  const octave = { ...defaultMatch, pitch: 'any-octave' as const };
  expect(compareMaterial(song, stem, material, octave).bars[0].share).toBe(2 / 3);
  expect(
    compareMaterial(song, stem, material, { ...octave, countQuietNotes: false }).bars[0].share,
  ).toBe(1 / 3);
  expect(
    compareMaterial(song, stem, material, { ...octave, timingToleranceSeconds: 0.4 }).bars[0]
      .matched,
  ).toBe(2);
  expect(
    compareMaterial(song, stem, material, { ...octave, timingToleranceSeconds: 0.001 }).bars[0]
      .matched,
  ).toBe(0);
  material.mine.message = 'Asking your Strudel…';
  expect(compareMaterial(song, stem, material, defaultMatch).mine).toEqual([]);
  expect(compareMaterial(song, stem, material, defaultMatch).bars).toEqual([]);
  material.mine.message = '';
  material.places = [];
  expect(compareMaterial(song, stem, material, defaultMatch).mine).toEqual([]);
});
test('drum aliases compare by lane, and empty arranged bars match without marking unarranged bars', async () => {
  const { song, note, material } = await fixture();
  const kit = song.stems.find((s) => s.id === 'drums')!;
  kit.notes = [note(0.6, 0.7, 36), note(0.8, 0.9, 53)];
  material.mine.notes = [note(0.6, 0.7, 35)];
  expect(compareMaterial(song, kit, material, defaultMatch).bars[0].share).toBe(1);
  kit.notes = [];
  material.mine.notes = [];
  const empty = compareMaterial(song, kit, material, defaultMatch);
  expect(empty.bars.map((b) => b.bar.number)).toEqual([1]);
  expect(empty.bars[0].share).toBe(1);
});
test('the 200-event drawing cap never reduces a bar match count', async () => {
  const { song, stem, note, material } = await fixture();
  stem.notes = Array.from({ length: 401 }, (_, i) => note(0.5 + i / 1000, 1));
  material.mine.notes = stem.notes.slice(0, 399);
  expect(noteMarks(stem, timelineAxis(song.beatMap, song.bars))).toHaveLength(200);
  const bar = compareMaterial(song, stem, material, defaultMatch).bars[0];
  expect([bar.recording, bar.mine, bar.matched, bar.share]).toEqual([401, 399, 399, 399 / 401]);
  material.mine.notes = Array.from({ length: 401 }, () => note(0.6, 0.8, 72));
  const differences = compareMaterial(song, stem, material, defaultMatch);
  const drawing = differenceDrawing(material.mine.notes, differences.mine);
  expect(drawing.total).toBe(802);
  expect(
    drawing.notes.length + drawing.marks.filter((m) => m.kind === 'only-recording').length,
  ).toBe(200);
});
