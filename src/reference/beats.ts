import type { BeatMap, Position, ReferenceBar } from './types';

/** Last index <= value, or -1. Exact detected endpoints retain their identity. */
function floorIndex(values: readonly number[], value: number): number {
  let lo = 0,
    hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}
function anchor(map: BeatMap) {
  return map.downbeats.length ? map.beats.indexOf(map.downbeats[0]) : 0;
}
export function secondsToPosition(map: BeatMap, seconds: number): Position {
  const i = floorIndex(map.beats, seconds);
  const firstDownbeat = map.downbeats[0];
  if (i < 0 || seconds > map.beats.at(-1)! || !Number.isFinite(seconds))
    return {
      kind: 'uncovered',
      seconds,
      bar: firstDownbeat !== undefined && seconds < firstDownbeat ? 0 : null,
      beat: null,
      beatInBar: null,
    };
  const left = map.beats[i],
    right = map.beats[i + 1];
  const ordinal = i + (seconds === left ? 0 : (seconds - left) / (right - left));
  const barIndex = floorIndex(map.downbeats, seconds);
  // Without downbeats there is no evidence for numbered bars.
  if (firstDownbeat === undefined)
    return { kind: 'uncovered', seconds, bar: null, beat: null, beatInBar: null };
  const barStartIndex = barIndex < 0 ? 0 : map.beats.indexOf(map.downbeats[barIndex]);
  return {
    kind: map.coverage.gaps.some(([a, b]) => seconds > a && seconds < b) ? 'gap' : 'detected',
    seconds,
    beat: ordinal - anchor(map),
    bar: barIndex + 1,
    beatInBar: ordinal - barStartIndex,
  };
}
export function beatToPosition(map: BeatMap, beat: number): Position | null {
  const ordinal = beat + anchor(map),
    i = Math.floor(ordinal);
  if (!Number.isFinite(ordinal) || i < 0 || ordinal > map.beats.length - 1) return null;
  const seconds =
    map.beats[i] + (ordinal === i ? 0 : (ordinal - i) * (map.beats[i + 1] - map.beats[i]));
  return secondsToPosition(map, seconds);
}
export function barBeatToPosition(map: BeatMap, bar: number, beatInBar: number): Position | null {
  if (!Number.isInteger(bar) || bar < 0 || beatInBar < 0) return null;
  const start = bar === 0 ? map.beats[0] : map.downbeats[bar - 1];
  if (start === undefined) return null;
  const result = beatToPosition(map, map.beats.indexOf(start) - anchor(map) + beatInBar);
  return result?.bar === bar ? result : null;
}
export function referenceBars(map: BeatMap): ReferenceBar[] {
  if (!map.downbeats.length) return [];
  const starts = [...(map.beats[0] < map.downbeats[0] ? [map.beats[0]] : []), ...map.downbeats];
  return starts.map((startSeconds) => {
    const number = map.downbeats.indexOf(startSeconds) + 1;
    const next = number === 0 ? map.downbeats[0] : map.downbeats[number];
    const endSeconds = next ?? map.beats.at(-1)!;
    const startBeat = map.beats.indexOf(startSeconds) - anchor(map);
    const endBeat = map.beats.indexOf(endSeconds) - anchor(map);
    return {
      number,
      startSeconds,
      endSeconds,
      startBeat,
      endBeat,
      bpm:
        endSeconds > startSeconds
          ? (60 * (endBeat - startBeat)) / (endSeconds - startSeconds)
          : null,
      partial: number === 0 || next === undefined,
      gaps: map.coverage.gaps.filter(([a, b]) => a < endSeconds && b > startSeconds),
    };
  });
}
