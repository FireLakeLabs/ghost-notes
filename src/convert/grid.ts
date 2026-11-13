import { beatToPosition, secondsToPosition } from '../reference/beats';
import type { ReferenceBar, ReferenceSong } from '../reference/types';
import type { ConversionSpan } from './types';

/** Uncovered edges retain all notes, without claiming inferred beats or bars. */
export function conversionSpans(
  song: ReferenceSong,
  bars: readonly ReferenceBar[],
): ConversionSpan[] {
  const positive = bars.filter((bar) => bar.endSeconds > bar.startSeconds);
  if (!positive.length) throw Error('Literal conversion needs a nonempty bar grid');
  const spans: ConversionSpan[] = [];
  function add(
    kind: ConversionSpan['kind'],
    bar: ReferenceBar | null,
    start: number,
    end: number,
    cycles: number,
  ) {
    const startCycle = spans.at(-1)?.endCycle ?? 0;
    spans.push({
      kind,
      bar,
      startSeconds: start,
      endSeconds: end,
      startCycle,
      endCycle: startCycle + cycles,
    });
  }
  const first = positive[0];
  if (first.startSeconds > 0) {
    const secondsPerCycle =
      ((first.endSeconds - first.startSeconds) * song.beatMap.beatsPerBar) /
      (first.endBeat - first.startBeat);
    add('uncovered', null, 0, first.startSeconds, first.startSeconds / secondsPerCycle);
  }
  for (const bar of positive) {
    if (
      !(bar.endBeat > bar.startBeat) ||
      bar.startSeconds < 0 ||
      (spans.length && bar.startSeconds !== spans.at(-1)?.endSeconds)
    )
      throw Error('Literal conversion needs ordered contiguous bars with positive beat lengths');
    add(
      bar.number === 0 ? 'pickup' : 'bar',
      bar,
      bar.startSeconds,
      bar.endSeconds,
      bar.number === 0 ? (bar.endBeat - bar.startBeat) / song.beatMap.beatsPerBar : 1,
    );
  }
  const last = positive[positive.length - 1];
  let end = song.durationSeconds;
  for (const stem of song.stems)
    for (const note of stem.notes) end = Math.max(end, note.endSeconds, note.startSeconds + 0.001);
  if (end > last.endSeconds) {
    const secondsPerCycle =
      ((last.endSeconds - last.startSeconds) * song.beatMap.beatsPerBar) /
      (last.endBeat - last.startBeat);
    add('uncovered', null, last.endSeconds, end, (end - last.endSeconds) / secondsPerCycle);
  }
  return spans;
}

function containing(
  spans: readonly ConversionSpan[],
  value: number,
  field: 'startSeconds' | 'startCycle',
): ConversionSpan {
  let lo = 0,
    hi = spans.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (spans[mid][field] <= value) lo = mid + 1;
    else hi = mid;
  }
  const span = spans[Math.max(0, lo - 1)];
  if (!span) throw Error('Literal conversion needs spans');
  return span;
}
export function secondsToCycle(
  song: ReferenceSong,
  spans: readonly ConversionSpan[],
  seconds: number,
): number {
  const span = containing(spans, seconds, 'startSeconds');
  let fraction = (seconds - span.startSeconds) / (span.endSeconds - span.startSeconds);
  if (span.bar && seconds >= span.startSeconds && seconds <= span.endSeconds) {
    const position = secondsToPosition(song.beatMap, seconds);
    if (position.beat === null) throw Error('Bar grid and query map disagree');
    fraction = (position.beat - span.bar.startBeat) / (span.bar.endBeat - span.bar.startBeat);
  }
  return span.startCycle + fraction * (span.endCycle - span.startCycle);
}
export function cycleToSeconds(
  song: ReferenceSong,
  spans: readonly ConversionSpan[],
  cycle: number,
): number {
  const span = containing(spans, cycle, 'startCycle');
  const fraction = (cycle - span.startCycle) / (span.endCycle - span.startCycle);
  if (span.bar && fraction >= 0 && fraction <= 1) {
    const position = beatToPosition(
      song.beatMap,
      span.bar.startBeat + fraction * (span.bar.endBeat - span.bar.startBeat),
    );
    if (!position) throw Error('Bar grid and query map disagree');
    return position.seconds;
  }
  return span.startSeconds + fraction * (span.endSeconds - span.startSeconds);
}
export function secondsToBeat(song: ReferenceSong, seconds: number): number {
  const position = secondsToPosition(song.beatMap, seconds);
  if (position.beat !== null) return position.beat;
  // Error fractions outside coverage use the nearest observed interval, explicitly
  // for measurement only; no inferred beat is added to the reference map.
  const beats = song.beatMap.beats;
  if (beats.length < 2) throw Error('Literal conversion needs at least two beats');
  const left = seconds < beats[0] ? beats[0] : beats[beats.length - 2];
  const right = seconds < beats[0] ? beats[1] : beats[beats.length - 1];
  const anchor =
    seconds < beats[0]
      ? secondsToPosition(song.beatMap, left)
      : secondsToPosition(song.beatMap, right);
  if (anchor.beat === null) throw Error('Literal conversion needs numbered beats');
  return anchor.beat + (seconds - anchor.seconds) / (right - left);
}
