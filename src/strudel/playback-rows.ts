import { Hap, Pattern, TimeSpan, stack } from '@strudel/core';
import type { PlainEvent } from './index';
import { instrumentIdentity } from './instrument-identity';

export interface PlaybackRows {
  mineIds: readonly string[];
  reference: readonly { id: string; events: readonly PlainEvent[] }[];
}

/** Select after full evaluation: isolating source text changes group rewrites.
 * Reference voices are finite, canonical-cycle events, warped by the same clock.
 */
export function playbackRows(pattern: Pattern, rows: PlaybackRows): Pattern {
  const ids = new Set(rows.mineIds);
  const mine = new Pattern((state) =>
    ids.size
      ? pattern.query(state).filter((hap) => {
          const id = instrumentIdentity(hap);
          if (!id && hap.hasOnset())
            throw Error('Cannot identify this Mine voice. Link its instrument before playback.');
          return id !== undefined && ids.has(id);
        })
      : [],
  );
  return stack(
    mine,
    ...rows.reference.map(
      (row) =>
        new Pattern((state) =>
          row.events.flatMap((event) => {
            if (!event.whole) return [];
            const begin = Math.max(Number(state.span.begin), event.whole[0]);
            const end = Math.min(Number(state.span.end), event.whole[1]);
            if (begin >= end) return [];
            return [
              new Hap(new TimeSpan(...event.whole), new TimeSpan(begin, end), event.value, {
                tags: [`odm:instrument:${row.id}`],
              }),
            ];
          }),
        ),
    ),
  );
}
