import { expect, test } from 'vitest';
import { convertInstrument, conversionGrids, timingError } from '../src/convert';
import { readReference } from '../src/reference/reader';
import { secondsToPosition } from '../src/reference/beats';
import type { ReferenceSong } from '../src/reference/types';
import { referenceFixture } from './fixtures/reference';
import { queryEventsNode } from './node-query';
import { gridRoundTripProof } from './convert-proof';
import { importStrudel } from '../src/import';
import { generate } from '../src/generate';
import { walk, type Pattern, type Doc } from '../src/document';
import { setRhythmValue } from '../src/document/edits/rhythm-set';
import { setValue } from '../src/document/edits/values-set';

async function fixture(entries: number[][]): Promise<ReferenceSong> {
  const files = referenceFixture();
  const song = await readReference({
    read: async (p) => {
      const file = files.get(p);
      if (!file) throw Error('Missing fixture');
      return file;
    },
    exists: async (p) => files.has(p),
  });
  song.stems[0].notes = entries.map(([startSeconds, endSeconds, pitch, velocity]) => ({
    startSeconds,
    endSeconds,
    pitch,
    velocity,
    start: secondsToPosition(song.beatMap, startSeconds),
    end: secondsToPosition(song.beatMap, endSeconds),
  }));
  return song;
}
async function prove(song: ReferenceSong, conversion: ReturnType<typeof convertInstrument>) {
  const end = conversion.spans.at(-1)?.endCycle ?? 0;
  for (const source of [conversion.source, generate(importStrudel(conversion.source).doc)]) {
    const proof = gridRoundTripProof(
      song,
      conversion,
      song.stems[0].notes,
      await queryEventsNode(source, 0, end),
    );
    expect(proof.once + proof.merged).toBe(song.stems[0].notes.length);
  }
}

test.each(conversionGrids)(
  'grid %s accounts for pickup, collisions, chords, short notes and uncovered edges',
  async (grid) => {
    const song = await fixture([
      [0.249, 0.49, 60, 60],
      [0.49999, 0.6, 62, 80],
      [0.51, 0.9, 60, 60],
      [0.52, 1.2, 60, 100],
      [0.52, 1.2, 67, 70],
      [0.51, 0.9, 60, 60],
      [2.49999, 2.6, 64, 90],
      [2.5, 2.50001, 64, 90],
      [7.6, 7.8, 60, 60],
      [8, 8, 62, 80],
    ]);
    const conversion = convertInstrument({ song, stemId: 'bass', grid });
    expect(conversion.quantization).toBe(grid);
    expect(conversion.notes.map((n) => n.spanIndex)).toEqual([0, 0, 1, 1, 1, 1, 1, 2, 3, 3]);
    expect(
      conversion.notes.every((n) => n.startCycle < conversion.spans[n.spanIndex].endCycle),
    ).toBe(true);
    await prove(song, conversion);
  },
);

test('default sixteenths merge same-pitch collisions, retain velocity and longest tail, and record changes', async () => {
  const song = await fixture([
    [0.51, 0.9, 60, 60],
    [0.52, 1.2, 60, 100],
    [0.52, 1.2, 67, 70],
  ]);
  const c = convertInstrument({ song, stemId: 'bass' });
  expect(c.quantization).toBe(4);
  expect(
    c.notes.map((n) => [n.written.startSeconds, n.written.endSeconds, n.velocity, n.mergedInto]),
  ).toEqual([
    [0.5, 1.125, 100, null],
    [0.5, 1.125, 100, 0],
    [0.5, 1.125, 70, null],
  ]);
  expect(c.changes.filter((x) => x.kind === 'merged')).toEqual([
    {
      kind: 'merged',
      noteIndices: [0, 1],
      original: [
        { startSeconds: 0.51, endSeconds: 0.9 },
        { startSeconds: 0.52, endSeconds: 1.2 },
      ],
      written: [{ startSeconds: 0.5, endSeconds: 1.125 }],
    },
  ]);
  expect(c.changes.filter((x) => x.kind === 'moved').map((x) => x.noteIndices)).toEqual([
    [0],
    [1],
    [2],
  ]);
  expect(c.changes.filter((x) => x.kind === 'shortened').map((x) => x.noteIndices)).toEqual([
    [1],
    [2],
  ]);
  await prove(song, c);
});

test('late onsets stay in their bar, durations floor on the destination grid, and sub-step tails survive', async () => {
  const song = await fixture([
    [2.49999, 3, 60, 70],
    [0.51, 0.59, 62, 80],
    [0.5, 1.24, 64, 90],
  ]);
  const c = convertInstrument({ song, stemId: 'bass', grid: 4 });
  expect(c.notes.map((n) => [n.written.startSeconds, n.written.endSeconds])).toEqual([
    [2.375, 2.75],
    [0.5, 0.58],
    [0.5, 1.125],
  ]);
  expect(c.notes[0].step).toBe(15);
  await prove(song, c);
});

test.each([3, 6] as const)(
  'triplet grid %s lands on exact thirds and preserves the fractional pickup',
  async (grid) => {
    const song = await fixture([
      [1 / 6 + 0.001, 0.4, 60, 70],
      [0.5 + 1 / 6 + 0.001, 1.4, 62, 80],
    ]);
    const c = convertInstrument({ song, stemId: 'bass', grid });
    expect(c.resolutions.slice(0, 2)).toEqual([grid, grid * 4]);
    expect(c.notes[0].written.startSeconds).toBeCloseTo(1 / 6, 10);
    expect(c.notes[1].written.startSeconds).toBeCloseTo(0.5 + 1 / 6, 10);
    expect(timingError(song, c.notes).milliseconds.max).toBeCloseTo(1, 6);
    await prove(song, c);
  },
);

test('range ownership, a sustain crossing its end, silence and five drum lanes survive grid mode', async () => {
  const song = await fixture([
    [0.51, 3.2, 35, 80],
    [0.52, 1, 35, 100],
    [0.52, 1, 38, 60],
    [2.5, 3, 42, 70],
  ]);
  song.stems[0].id = 'drums';
  const c = convertInstrument({ song, stemId: 'drums', grid: 4, range: { fromBar: 1, toBar: 2 } });
  expect(c.notes.map((n) => n.sourceIndex)).toEqual([0, 1, 2]);
  expect(c.notes[0].written.endSeconds).toBeGreaterThan(2.5);
  const result = await queryEventsNode(c.source, 0, 1);
  expect(result.error).toBeNull();
  expect(result.events.filter((e) => e.hasOnset)).toHaveLength(2);
  song.stems[0].notes = [];
  const silent = convertInstrument({ song, stemId: 'drums' });
  expect((await queryEventsNode(silent.source, 0, 3)).events).toEqual([]);
});

function accepted(result: Doc | { ok: false; reason: string }): Doc {
  if ('ok' in result) throw Error(result.reason);
  return result;
}
test('a converted bar can be changed through ODM rhythm and values operations and queried again', async () => {
  const song = await fixture([[0.51, 0.9, 60, 100]]);
  const c = convertInstrument({ song, stemId: 'bass', range: { fromBar: 1, toBar: 2 } });
  let doc = importStrudel(c.source).doc;
  const patterns: Pattern[] = [];
  walk(doc, (n) => {
    if ('core' in n) patterns.push(n as Pattern);
  });
  const note = patterns.find((p) => p.core.kind === 'generator' && p.core.name === 'note');
  const gain = patterns.find(
    (p) =>
      p.core.kind === 'sequence' &&
      p.core.steps[0]?.kind === 'value' &&
      p.core.steps[0].value.startsWith('0.787'),
  );
  expect(note).toBeDefined();
  expect(gain).toBeDefined();
  if (!note || !gain) throw Error('Expected editable patterns');
  doc = accepted(setRhythmValue(doc, `${note.id}:rhythm`, [0], '67'));
  const settings: string[] = [];
  walk(doc, (n) => {
    if ('value' in n && 'name' in n && n.name === 'gain') settings.push(n.id);
  });
  if (!settings[0]) throw Error('Expected gain setting');
  doc = accepted(setValue(doc, settings[0], [0], '0.5'));
  const result = await queryEventsNode(generate(doc), 0, 1);
  expect(result.error).toBeNull();
  const events = result.events.filter((e) => e.hasOnset);
  expect(events).toHaveLength(1);
  expect(events[0].value).toMatchObject({ note: 67, gain: 0.5 });
});

test('grid changes mark a sustain end crossing back to its preceding bar', async () => {
  const song = await fixture([
    [0.61, 2.55, 60, 90],
    [0.5, 2.55, 64, 80],
  ]);
  const c = convertInstrument({ song, stemId: 'bass', grid: 4 });
  expect(c.notes[0].written).toEqual({ startSeconds: 0.625, endSeconds: 2.5 });
  expect(
    c.changes.filter((x) => x.kind === 'moved-across-bar-line').map((x) => x.noteIndices),
  ).toEqual([[0], [1]]);
  await prove(song, c);
});
