import { describe, expect, test } from 'vitest';
import { readReference } from '../reference/reader';
import { referenceFixture } from '../../tests/fixtures/reference';
import {
  CELL_CAP,
  contourMarks,
  barInference,
  DRUM_LANES,
  drumLane,
  noteMarks,
  timelineAxis,
  timelineRows,
} from './layout';
async function fixture() {
  const files = referenceFixture();
  return readReference({
    read: async (path) => {
      const b = files.get(path);
      if (!b) throw Error('Missing fixture');
      return b;
    },
    exists: async (path) => files.has(path),
  });
}
describe('whole-song coordinates', () => {
  test('round trips pickup, unequal tempos, gap, and uncovered tail through the grid', async () => {
    const song = await fixture(),
      axis = timelineAxis(song.detectedBeatMap, song.detectedBars);
    for (const seconds of [0, 0.25, 0.5, 2.5, 4.5, 5.5, 7.5, 7.75, 8]) {
      const p = axis.positionAtX(axis.xAtSeconds(seconds, 1000), 1000);
      expect(p.seconds).toBeCloseTo(seconds);
      expect(axis.secondsAtX(axis.xAtSeconds(seconds, 1000), 1000)).toBeCloseTo(seconds);
      expect(axis.xAtPosition(p, 1000)).toBeCloseTo(axis.xAtSeconds(seconds, 1000));
    }
    expect(axis.positionAtX(axis.xAtSeconds(0.25, 1000), 1000)).toMatchObject({
      bar: 0,
      beat: -0.5,
    });
    expect(axis.positionAtX(axis.xAtSeconds(5.5, 1000), 1000)).toMatchObject({ kind: 'gap' });
    expect(axis.positionAtX(axis.xAtSeconds(7.75, 1000), 1000)).toMatchObject({
      kind: 'uncovered',
      beat: null,
    });
    expect(axis.visibleBars(axis.xAtSeconds(1, 1000), 2, 1000).map((b) => b.number)).toEqual([1]);
  });
  test('missing downbeats keep the full recording unnumbered and reachable', async () => {
    const song = await fixture();
    const axis = timelineAxis({ ...song.beatMap, downbeats: [] }, []);
    expect(axis.visibleBars(0, 1000, 1000)).toEqual([]);
    expect(axis.positionAtX(1000, 1000)).toMatchObject({ kind: 'uncovered', seconds: 8 });
  });
});
test('prototype order and sizes, one instrument per stem, optional audio and quiet/skipped flags', async () => {
  const song = await fixture(),
    bass = song.stems[0];
  const input = {
    ...song,
    stems: [
      bass,
      { ...bass, id: 'vocals' },
      { ...bass, id: 'other', transcription: 'skipped_quiet' as const },
      { ...bass, id: 'drums' },
    ],
  };
  const rows = timelineRows(input, true);
  expect(rows.map((r) => r.stem.id)).toEqual(['drums', 'bass', 'other', 'vocals']);
  expect(rows[0].rows).toEqual([
    { kind: 'audio', height: 32 },
    { kind: 'midi', height: 44 },
  ]);
  expect(rows[2].quiet).toBe(true);
  expect(
    timelineRows(input, false).every((r) => r.rows.length === 1 && r.rows[0].kind === 'midi'),
  ).toBe(true);
});
test('five GM drum groups retain prototype lane order; unknown notes are not kick hits', () => {
  expect([49, 42, 38, 45, 36].map((p) => DRUM_LANES[drumLane(p)!])).toEqual([
    'Crash',
    'Hi-hat',
    'Snare',
    'Tom',
    'Kick',
  ]);
  expect(drumLane(60)).toBeNull();
});
test('dense cells sample both ends without losing later bars or original note counts', async () => {
  const song = await fixture(),
    axis = timelineAxis(song.beatMap, song.bars),
    stem = song.stems[0];
  const notes = Array.from({ length: 400 }, (_, i) => ({
    ...stem.notes[0],
    startSeconds: 0.5 + i / 400,
    start: {
      kind: 'detected' as const,
      seconds: 0.5 + i / 400,
      bar: 1,
      beat: i / 200,
      beatInBar: i / 200,
    },
    endSeconds: 1.5,
    pitch: 40 + (i % 12),
  }));
  const marks = noteMarks({ ...stem, notes: [...notes, stem.notes[1]] }, axis);
  expect(marks).toHaveLength(CELL_CAP + 1);
  expect(marks[0].x).toBeCloseTo(axis.xAtSeconds(0.5, 1));
  expect(marks[199].x).toBeCloseTo(axis.xAtSeconds(notes.at(-1)!.startSeconds, 1));
  expect(marks[200].x).toBeCloseTo(axis.xAtSeconds(5.5, 1));
  expect(notes).toHaveLength(400);
});

test('contours group chords into the low bass or high pitched voice in time order', () => {
  const marks = [
    { x: 0.2, end: 0.3, pitch: 50, velocity: 100 },
    { x: 0.1, end: 0.2, pitch: 60, velocity: 100 },
    { x: 0.1, end: 0.25, pitch: 72, velocity: 90 },
  ];
  expect(contourMarks(marks, 16, true).map((m) => [m.x, m.end, m.pitch])).toEqual([
    [0.1, 0.25, 60],
    [0.2, 0.3, 50],
  ]);
  expect(contourMarks(marks, 16, false).map((m) => m.pitch)).toEqual([72, 50]);
  expect(marks[1].end).toBe(0.2);
});

test('bar inference metadata is visible without requiring it on detected bars', async () => {
  const song = await fixture(),
    bar = song.bars[1];
  expect(barInference(bar)).toBe('');
  expect(
    barInference({
      ...bar,
      inferences: [
        { kind: 'split-long-bar', seconds: 1, source: [0, 2] },
        { kind: 'fill-beat', seconds: 2, source: [0, 2] },
      ],
    }),
  ).toBe('split long bar, fill beat');
});
