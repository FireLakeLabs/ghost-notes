import { conversionSpans } from '../convert';
import type { ReferenceSong } from '../reference/types';
export interface BarRange {
  fromBar: number;
  toBar: number;
}
/** Whole numbered bars; the fractional pickup is selectable only by itself. */
export function sectionRange(song: ReferenceSong, range: BarRange) {
  if (
    !Number.isInteger(range.fromBar) ||
    !Number.isInteger(range.toBar) ||
    range.fromBar < 0 ||
    range.toBar <= range.fromBar ||
    (range.fromBar === 0 && range.toBar !== 1)
  )
    throw Error('Select whole bars, or the pickup by itself');
  const all = conversionSpans(song, song.bars);
  const spans = all.filter(
    (s) => s.bar && s.bar.number >= range.fromBar && s.bar.number < range.toBar,
  );
  if (spans.length !== range.toBar - range.fromBar) throw Error('Selected bars are unavailable');
  const first = spans[0],
    last = spans[spans.length - 1];
  if (!first?.bar || !last?.bar) throw Error('Selected bars are unavailable');
  const cycles = last.endCycle - first.startCycle;
  return {
    ...range,
    startCycle: first.startCycle,
    endCycle: last.endCycle,
    cycles,
    startSeconds: first.startSeconds,
    endSeconds: last.endSeconds,
    startBeat: first.bar.startBeat,
    endBeat: last.bar.endBeat,
    tempo: (cycles * 60) / (last.endSeconds - first.startSeconds),
  };
}
export const overlaps = (a: BarRange, b: BarRange) => a.fromBar < b.toBar && b.fromBar < a.toBar;
