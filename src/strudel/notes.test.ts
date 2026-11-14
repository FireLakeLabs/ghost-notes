import { expect, test } from 'vitest';
import { scoredNotes } from './notes';
import { queryEvents } from './evaluate';
import { Hap, TimeSpan } from '@strudel/core';

test('queried note names, rewrites, sample lanes, gain and durations become scored notes', async () => {
  const result = await queryEvents(
    'note("c4 e4").s("triangle").gain(0.5).duration(0.4).clip(0.25).rev()',
    0,
    1,
  );
  expect(result.error).toBeNull();
  const read = scoredNotes(result.events);
  expect(read.unmapped).toBe(0);
  expect([...read.notes].sort((a, b) => a.startCycle - b.startCycle).map((n) => n.pitch)).toEqual([
    64, 60,
  ]);
  for (const [i, note] of read.notes.entries()) {
    const event = result.events[i];
    const hap = new Hap(new TimeSpan(...event.whole!), new TimeSpan(...event.part), event.value);
    expect(note.endCycle - note.startCycle).toBeCloseTo(Number(hap.duration));
    expect(note.velocity).toBe(63.5);
  }
  const drums = await queryEvents('s("bd sd hh lt cr")', 0, 1);
  expect(scoredNotes(drums.events, true).notes.map((n) => n.pitch)).toEqual([35, 38, 42, 47, 49]);
  expect(
    scoredNotes([{ whole: [0, 1], part: [0, 1], hasOnset: true, value: { s: 'unknown' } }], true),
  ).toEqual({ notes: [], unmapped: 1 });
});
