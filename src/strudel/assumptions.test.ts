import { expect, test } from 'vitest';
import { queryEvents } from './evaluate';
import {
  placeSource,
  pickupSource,
  followingSource,
  chordSource,
  heldBarSeconds,
  barSeconds,
} from './assumptions';

async function onsets(source: string, end: number) {
  const r = await queryEvents(source, 0, end);
  expect(r.error).toBeNull();
  return {
    cps: r.cps,
    events: r.events.filter((e) => e.hasOnset).sort((a, b) => a.part[0] - b.part[0]),
  };
}
test('G28: fractional places retain n bars at cpm / f, through two loops', async () => {
  const { cps, events } = await onsets(placeSource, 5.5);
  expect(cps).toBe(2);
  expect(events).toHaveLength(24);
  for (let loop = 0; loop < 2; loop++) {
    for (let i = 0; i < 12; i++) {
      const e = events[loop * 12 + i];
      const start = loop * 2.75 + (i < 8 ? i * 0.1875 : 1.5 + (i - 8) * 0.3125);
      const length = i < 8 ? 0.1875 : 0.3125;
      expect(e.whole).toEqual([start, start + length]);
      expect(e.value).toMatchObject({
        note: ['c3', 'd3', 'e3', 'f3', 'c3', 'd3', 'e3', 'f3', 'g3', 'a3', 'b3', 'c4'][i],
      });
    }
  }
});
test('G29: first pickup is the first beat; following bar keeps its notes and lengths', async () => {
  const { events } = await onsets(pickupSource, 2.5);
  expect(events.slice(0, 5).map((e) => [e.whole, e.value])).toEqual([
    [[0, 0.25], { note: 'c3', s: 'sine' }],
    [[0.25, 0.5], { note: 'g3', s: 'sine' }],
    [[0.5, 0.75], { note: 'a3', s: 'sine' }],
    [[0.75, 1], { note: 'b3', s: 'sine' }],
    [[1, 1.25], { note: 'c4', s: 'sine' }],
  ]);
  // arrange repeats in global phase: fractional pickup rotates on the next lap.
  expect(events[5].value).toMatchObject({ note: 'd3' });
});
test('G28: every queried beat carries its bar tempo, including each change boundary', async () => {
  const { events } = await onsets(followingSource, 4);
  expect(events).toHaveLength(16);
  for (const [i, e] of events.entries()) {
    expect(e.whole).toEqual([i / 4, (i + 1) / 4]);
    expect(e.value).toMatchObject({
      note: ['c3', 'd3', 'e3', 'f3'][i % 4],
      cps: 1 / barSeconds[Math.floor(i / 4)],
    });
  }
});

test('G28: chords query as simultaneous onsets at every bar-tempo boundary', async () => {
  const { events } = await onsets(chordSource(heldBarSeconds), 4);
  expect(events).toHaveLength(20);
  for (let bar = 0; bar < 4; bar++) {
    expect(events.slice(bar * 5, bar * 5 + 2).map((e) => e.whole)).toEqual([
      [bar, bar + 0.25],
      [bar, bar + 0.25],
    ]);
    for (const e of events.slice(bar * 5, bar * 5 + 5))
      expect(e.value).toMatchObject({ cps: 1 / heldBarSeconds[bar] });
  }
});
