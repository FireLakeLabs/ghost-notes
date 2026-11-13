import { conversionSpans, cycleToSeconds, secondsToCycle } from '../convert/grid';
import type { ReferenceSong } from '../reference/types';

/** Musical cycles and recorded seconds have separate meanings, even at cps=1. */
export interface SongTime {
  start: number;
  end: number;
  toSeconds(cycle: number): number;
  toCycle(seconds: number): number;
}
export function songTime(song: ReferenceSong): SongTime {
  const spans = conversionSpans(song, song.bars);
  return {
    start: spans[0].startSeconds,
    end: spans[spans.length - 1].endSeconds,
    toSeconds: (cycle) => cycleToSeconds(song, spans, cycle),
    toCycle: (seconds) => secondsToCycle(song, spans, seconds),
  };
}
