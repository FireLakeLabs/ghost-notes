import { expect } from 'vitest';
import type { Suggestion } from '../src/simplify';
import { queryEventsNode } from './node-query';
function midi(value: unknown): number {
  if (typeof value === 'number') return value;
  const m = /^([a-g])([#b]*)(-?\d+)$/i.exec(String(value));
  if (!m) throw Error('Expected MIDI or named note');
  return (
    ({ c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()] ?? 0) +
    (Number(m[3]) + 1) * 12 +
    [...m[2]].reduce((n, c) => n + (c === '#' ? 1 : -1), 0)
  );
}
export async function assertQueried(suggestion: Suggestion, end: number) {
  const result = await queryEventsNode(suggestion.source, 0, end);
  expect(result.error).toBeNull();
  const actual = result.events
    .filter((e) => e.hasOnset)
    .map((e) => {
      const v = e.value as Record<string, unknown>;
      const pitch =
        v.note !== undefined
          ? midi(v.note)
          : ({ bd: 35, sd: 38, hh: 42, lt: 47, cr: 49 } as Record<string, number>)[String(v.s)];
      return [
        e.whole?.[0],
        pitch,
        Number(v.gain),
        e.whole ? e.whole[0] + (e.whole[1] - e.whole[0]) * Number(v.clip ?? 1) : 0,
      ];
    })
    .sort(
      (a, b) =>
        Number(a[0]) - Number(b[0]) ||
        Number(a[1]) - Number(b[1]) ||
        Number(a[2]) - Number(b[2]) ||
        Number(a[3]) - Number(b[3]),
    );
  const wanted = suggestion.notes
    .map((n) => [n.startCycle, n.pitch, n.velocity / 127, n.endCycle])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
  expect(actual.length).toBe(wanted.length);
  let maxError = 0;
  actual.forEach((n, i) =>
    n.forEach((v, j) => {
      maxError = Math.max(maxError, Math.abs(Number(v) - wanted[i][j]));
    }),
  );
  expect(maxError).toBeLessThan(1e-6);
}
