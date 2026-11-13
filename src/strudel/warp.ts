import { Hap, Pattern, TimeSpan } from '@strudel/core';
import type { SongTime } from '../engine/song-time';

/** Pinned Hap.duration is (value.duration ?? whole length) * clip, in cycles.
 * Transform that endpoint too: multiplying a warped whole by the old legato
 * would give the wrong duration across a tempo boundary. Preserve Hap metadata.
 * The scheduler runs at cps=1; tempo controls in the score cannot change it.
 */
export function warpPattern(pattern: Pattern, time: SongTime): Pattern {
  const span = (s: TimeSpan) =>
    new TimeSpan(time.toSeconds(Number(s.begin)), time.toSeconds(Number(s.end)));
  return new Pattern((state) => {
    const begin = Math.max(time.start, Number(state.span.begin));
    const end = Math.min(time.end, Number(state.span.end));
    if (end <= begin) return [];
    return (
      pattern
        .query(state.setSpan(new TimeSpan(time.toCycle(begin), time.toCycle(end))))
        // Transform only onsets. Pinned arrange can return tiny non-onset fragments
        // at fractional boundaries; float mapping may collapse those onto an onset.
        .filter((hap) => hap.hasOnset())
        .map((hap) => {
          let value = hap.value;
          if (value && typeof value === 'object') {
            const { cps: _cps, ...settings } = value as Record<string, unknown>;
            if (
              hap.whole &&
              (typeof settings.clip === 'number' || typeof settings.duration === 'number')
            ) {
              const onset = Number(hap.whole.begin);
              settings.duration =
                time.toSeconds(onset + Number(hap.duration)) - time.toSeconds(onset);
              if (typeof settings.clip === 'number') settings.clip = 1;
            }
            value = settings;
          }
          return new Hap(
            hap.whole ? span(hap.whole) : null,
            span(hap.part),
            value,
            hap.context,
            hap.stateful,
          );
        })
    );
  });
}
