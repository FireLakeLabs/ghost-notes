import { expect, test } from 'vitest';
import { convertInstrument, cycleToSeconds, timingError } from '../src/convert';
import { readReference } from '../src/reference/reader';
import { secondsToPosition } from '../src/reference/beats';
import type { ReferenceNote, ReferenceSong } from '../src/reference/types';
import { importStrudel } from '../src/import';
import { generate } from '../src/generate';
import { instruments } from '../src/document';
import { referenceFixture } from './fixtures/reference';
import { queryEventsNode } from './node-query';
import { roundTripProof } from './convert-proof';

async function fixture(): Promise<ReferenceSong> {
  const files = referenceFixture();
  return readReference({
    read: async (p) => {
      const value = files.get(p);
      if (!value) throw Error('Missing fixture');
      return value;
    },
    exists: async (p) => files.has(p),
  });
}
function notes(song: ReferenceSong, entries: number[][]): ReferenceNote[] {
  return entries.map(([startSeconds, endSeconds, pitch, velocity]) => ({
    startSeconds,
    endSeconds,
    pitch,
    velocity,
    start: secondsToPosition(song.beatMap, startSeconds),
    end: secondsToPosition(song.beatMap, endSeconds),
  }));
}
function assertProof(proof: ReturnType<typeof roundTripProof>) {
  expect(proof.once).toBe(proof.notes);
  expect(proof.missing).toBe(0);
  expect(proof.duplicated).toBe(0);
  expect(proof.timing.milliseconds.max).toBeLessThanOrEqual(1.000001);
  expect(proof.timing.beats.max).toBeLessThanOrEqual(1 / 1024 + 1e-9);
  expect(proof.durationMaxMs).toBeLessThan(1e-5);
}

test('pickup, changing tempo, gaps, uncovered tail, and empty stems share one first-pass length', async () => {
  const song = await fixture();
  song.stems = [...song.stems, { ...song.stems[0], id: 'empty', notes: [] }];
  const conversion = convertInstrument({ grid: 'exact', song, stemId: 'bass' });
  expect(conversion.spans.map((s) => [s.kind, s.startCycle, s.endCycle])).toEqual([
    ['pickup', 0, 0.25],
    ['bar', 0.25, 1.25],
    ['bar', 1.25, 2.25],
    ['uncovered', 2.25, 2.35],
  ]);
  expect(cycleToSeconds(song, conversion.spans, 0.5)).toBe(1);
  expect(cycleToSeconds(song, conversion.spans, 1.875)).toBeCloseTo(5.5);
  const proof = roundTripProof(
    song,
    conversion,
    song.stems[0].notes,
    await queryEventsNode(conversion.source, 0, 2.35),
  );
  assertProof(proof);
  expect(timingError(song, conversion.notes)).toEqual(proof.timing);
  const empty = convertInstrument({ grid: 'exact', song, stemId: 'empty' });
  expect(empty.spans).toEqual(conversion.spans);
  expect((await queryEventsNode(empty.source, 0, 2.35)).events).toEqual([]);
});

test('near bar ends, exact boundaries, chords and identical overlaps remain distinct with original duration and velocity', async () => {
  const song = await fixture();
  const input = notes(song, [
    [0.49999, 1.2, 60, 75],
    [0.5, 0.501, 60, 75],
    [2.49999, 4, 62, 100],
    [2.5, 4, 62, 100],
    [2.5, 4, 62, 100],
    [2.5, 4.5, 67, 65],
    [3.123456, 3.123457, 66, 127],
    [7.49999, 7.9, 60, 20],
    [7.5, 8, 64, 80],
  ]);
  song.stems = [{ ...song.stems[0], notes: input }];
  const conversion = convertInstrument({ grid: 'exact', song, stemId: 'bass' });
  const result = await queryEventsNode(conversion.source, 0, conversion.spans.at(-1)!.endCycle);
  const proof = roundTripProof(song, conversion, input, result);
  assertProof(proof);
  expect(conversion.notes.map((n) => n.spanIndex)).toEqual([0, 1, 1, 2, 2, 2, 2, 2, 3]);
  expect(conversion.notes.every((n) => n.startCycle < conversion.spans[n.spanIndex].endCycle)).toBe(
    true,
  );
  expect(conversion.changes.every((c) => c.kind === 'moved')).toBe(true);
  for (const n of conversion.notes) {
    const change = conversion.changes.find((c) => c.noteIndices[0] === n.sourceIndex);
    if (n.written.startSeconds !== n.source.startSeconds) {
      expect(change?.original[0].startSeconds).toBe(n.source.startSeconds);
      expect(change?.written[0]).toEqual(n.written);
    } else expect(change).toBeUndefined();
  }
  // ODM may retain unsupported constructors as opaque text; queried behavior must survive.
  const doc = importStrudel(conversion.source).doc;
  expect(instruments(doc)).toHaveLength(1);
  const regenerated = generate(doc);
  assertProof(
    roundTripProof(
      song,
      conversion,
      input,
      await queryEventsNode(regenerated, 0, conversion.spans.at(-1)!.endCycle),
    ),
  );
});

test('bar-range output starts at zero, excludes notes on its end boundary, and retains a sustain across the selection end', async () => {
  const song = await fixture();
  song.stems = [
    {
      ...song.stems[0],
      notes: notes(song, [
        [0.5, 3, 60, 100],
        [2.5, 3, 62, 70],
      ]),
    },
  ];
  const conversion = convertInstrument({
    grid: 'exact',
    song,
    stemId: 'bass',
    range: { fromBar: 1, toBar: 2 },
  });
  expect(conversion.spans.map((s) => [s.startCycle, s.endCycle])).toEqual([[0, 1]]);
  expect(conversion.notes.map((n) => n.sourceIndex)).toEqual([0]);
  const result = await queryEventsNode(conversion.source, 0, 1);
  expect(result.error).toBeNull();
  expect(result.events.filter((e) => e.hasOnset).map((e) => e.whole?.[0])).toEqual([0]);
  expect(conversion.notes[0].written.endSeconds).toBe(3);
});

test('five drum classes become five sample lanes and preserve simultaneous identical hits', async () => {
  const song = await fixture();
  const input = notes(song, [
    [0.25, 0.7, 35, 127],
    [0.5, 0.8, 38, 80],
    [0.5, 0.8, 42, 55],
    [0.5, 0.8, 42, 55],
    [2.4999, 3, 47, 90],
    [7.5, 8, 49, 70],
  ]);
  song.stems = [{ ...song.stems[0], id: 'drums', notes: input }];
  const conversion = convertInstrument({ grid: 'exact', song, stemId: 'drums' });
  expect(conversion.expression.split('\n')).toHaveLength(7);
  assertProof(
    roundTripProof(song, conversion, input, await queryEventsNode(conversion.source, 0, 2.35)),
  );
  const doc = importStrudel(conversion.source).doc;
  expect(instruments(doc)).toHaveLength(1);
  const regenerated = generate(doc);
  assertProof(roundTripProof(song, conversion, input, await queryEventsNode(regenerated, 0, 2.35)));
});

test('zero-duration onset at the map endpoint survives, and moved sustain ends crossing a bar line are recorded', async () => {
  const song = await fixture();
  song.stems = [
    {
      ...song.stems[0],
      notes: notes(song, [
        [0.523456, 2.5, 60, 100], // exact end, moved earlier: no crossing
        [0.5007, 2.5, 64, 90], // exact end, moved later: crossing
        [0.5007, 2.4999, 67, 85], // strictly before, moved past: crossing
        [8, 8, 62, 80],
      ]),
    },
  ];
  const conversion = convertInstrument({ grid: 'exact', song, stemId: 'bass' });
  assertProof(
    roundTripProof(
      song,
      conversion,
      song.stems[0].notes,
      await queryEventsNode(conversion.source, 0, conversion.spans.at(-1)!.endCycle),
    ),
  );
  expect(
    conversion.changes.filter((c) => c.kind === 'moved-across-bar-line').map((c) => c.noteIndices),
  ).toEqual([[1], [2]]);
});

test('uncovered edges use full-bar tempo even when the last numbered bar has only two beats', async () => {
  const song = await fixture();
  const beats = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  song.beatMap = {
    ...song.beatMap,
    beats,
    downbeats: [0.5, 2.5],
    coverage: { ...song.beatMap.coverage, gaps: [] },
  };
  song.bars = [
    {
      number: 1,
      startSeconds: 0.5,
      endSeconds: 2.5,
      startBeat: 0,
      endBeat: 4,
      bpm: 120,
      partial: false,
      gaps: [],
    },
    {
      number: 2,
      startSeconds: 2.5,
      endSeconds: 3.5,
      startBeat: 4,
      endBeat: 6,
      bpm: 120,
      partial: true,
      gaps: [],
    },
  ];
  song.durationSeconds = 5.5;
  song.stems = [
    {
      ...song.stems[0],
      notes: notes(song, [
        [0.25, 0.75, 60, 90],
        [2.501, 3.5, 62, 80], // exact final end, moved earlier: no crossing
        [2.5007, 3.4999, 67, 85], // strictly before final end, moved past: crossing
        [4.5, 5, 64, 70],
      ]),
    },
  ];
  const conversion = convertInstrument({ grid: 'exact', song, stemId: 'bass' });
  // G12 retains one cycle for the numbered partial bar. Both uncovered edges use
  // the observed 120 BPM / four-beat full-bar scale: .5s = .25, 2s = 1 cycle.
  expect(conversion.spans.map((s) => [s.kind, s.endCycle - s.startCycle])).toEqual([
    ['uncovered', 0.25],
    ['bar', 1],
    ['bar', 1],
    ['uncovered', 1],
  ]);
  expect(
    conversion.changes.filter((c) => c.kind === 'moved-across-bar-line').map((c) => c.noteIndices),
  ).toEqual([[2]]);
  assertProof(
    roundTripProof(
      song,
      conversion,
      song.stems[0].notes,
      await queryEventsNode(conversion.source, 0, 3.25),
    ),
  );
});
