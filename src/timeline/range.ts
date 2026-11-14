import { secondsToPosition } from '../reference/beats';
import type { ReferenceSong, Position } from '../reference/types';

export type SelectionScope = { kind: 'band' } | { kind: 'instrument'; stemId: string };
export type TimelineSettings = {
  selectionScope: SelectionScope['kind'];
  selectionSnap: 'bars' | 'beats';
  showAudio: boolean;
};
/** Half-open note interval and inclusive containing bars, ready for Make section. */
export type TimelineSelection = {
  start: Position;
  end: Position;
  firstBar: number;
  lastBar: number;
  scope: SelectionScope;
};
export type BarRange = { firstBar: number; lastBar: number };
export function selectRange(
  song: ReferenceSong,
  a: number,
  b: number,
  snap: 'bars' | 'beats',
  scope: SelectionScope,
): TimelineSelection | null {
  const bars = song.bars.filter((b) => b.endSeconds > b.startSeconds);
  const points =
    snap === 'bars'
      ? [...new Set(bars.flatMap((b) => [b.startSeconds, b.endSeconds]))].sort((a, b) => a - b)
      : song.beatMap.beats;
  if (points.length < 2 || !bars.length) return null;
  const lo = Math.max(points[0], Math.min(a, b)),
    hi = Math.min(points.at(-1)!, Math.max(a, b));
  if (hi < points[0] || lo >= points.at(-1)!) return null;
  const start = points.findLast((t) => t <= lo) ?? points[0];
  const end = points.find((t) => t >= hi && t > start) ?? points.at(-1)!;
  const included = bars.filter((bar) => bar.startSeconds < end && bar.endSeconds > start);
  if (!included.length) return null;
  return {
    start: secondsToPosition(song.beatMap, start),
    end: secondsToPosition(song.beatMap, end),
    firstBar: included[0].number,
    lastBar: included.at(-1)!.number,
    scope,
  };
}
/** Piecewise song projection. The prototype gives the lens 68% of the track. */
export type Projection = readonly { u: number; x: number }[];
export const plain: Projection = [
  { u: 0, x: 0 },
  { u: 1, x: 1 },
];
export function lensProjection(a: number, b: number): Projection {
  const rest = a + 1 - b;
  if (rest <= 0) return plain;
  const left = (0.32 * a) / rest;
  return [
    { u: 0, x: 0 },
    { u: a, x: left },
    { u: b, x: left + 0.68 },
    { u: 1, x: 1 },
  ];
}
export function project(points: Projection, value: number, inverse = false): number {
  const from = inverse ? 'x' : 'u',
    to = inverse ? 'u' : 'x';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (value <= b[from] && b[from] > a[from])
      return a[to] + ((value - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  return points.at(-1)?.[to] ?? value;
}
export function interpolate(from: Projection, to: Projection, t: number): Projection {
  return [...new Set([...from, ...to].map((p) => p.u))]
    .sort((a, b) => a - b)
    .map((u) => ({ u, x: project(from, u) * (1 - t) + project(to, u) * t }));
}

/** Main's cubic-bezier(.2,.75,.25,1), with time (x) inverted before easing y. */
export function lensEase(time: number): number {
  if (time <= 0) return 0;
  if (time >= 1) return 1;
  const coordinate = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (coordinate(mid, 0.2, 0.25) < time) lo = mid;
    else hi = mid;
  }
  return coordinate((lo + hi) / 2, 0.75, 1);
}
