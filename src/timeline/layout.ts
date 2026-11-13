import { beatToPosition, secondsToPosition } from '../reference/beats';
import type {
  BeatMap,
  Position,
  ReferenceBar,
  ReferenceSong,
  ReferenceStem,
} from '../reference/types';

export const LABEL_WIDTH = 150;
export const CELL_CAP = 200;
// Prototype order, top to bottom (Main.dc.html KINDS).
export const DRUM_LANES = ['Crash', 'Hi-hat', 'Snare', 'Tom', 'Kick'] as const;
export function drumLane(pitch: number): number | null {
  if ([49, 51, 52, 55, 57, 59].includes(pitch)) return 0;
  if ([42, 44, 46].includes(pitch)) return 1;
  if ([37, 38, 39, 40].includes(pitch)) return 2;
  if ([41, 43, 45, 47, 48, 50].includes(pitch)) return 3;
  if ([35, 36].includes(pitch)) return 4;
  return null;
}
/** Beat spacing inside the map; unnumbered seconds at either edge. No inferred grid here. */
export function timelineAxis(map: BeatMap, bars: readonly ReferenceBar[]) {
  const first = map.beats[0] ?? 0;
  const last = map.beats.at(-1) ?? first;
  const step = map.medianBpm ? 60 / map.medianBpm : 1;
  const anchor = map.downbeats[0] === undefined ? 0 : map.beats.indexOf(map.downbeats[0]);
  const leading = first / step;
  const mapped = Math.max(0, map.beats.length - 1);
  const extent = Math.max(1, leading + mapped + (map.durationSeconds - last) / step);
  const clamp = (v: number) => Math.max(0, Math.min(span, v));
  function queryUnit(seconds: number): number {
    const p = secondsToPosition(map, seconds);
    if (p.beat !== null) return leading + p.beat + anchor;
    // With no downbeats, show the whole recording against an unnumbered seconds axis.
    if (!bars.length) return seconds / step;
    return seconds < first ? seconds / step : leading + mapped + (seconds - last) / step;
  }
  // Exact note/bar/gap boundaries repeat during every scroll frame. The grid is immutable.
  const coordinates = new Map<number, number>();
  function unitAtSeconds(seconds: number): number {
    const cached = coordinates.get(seconds);
    if (cached !== undefined) return cached;
    const value = queryUnit(seconds);
    coordinates.set(seconds, value);
    return value;
  }
  const span = bars.length ? extent : Math.max(1, map.durationSeconds / step);
  function positionAtUnit(unit: number): Position {
    const u = clamp(unit);
    if (!bars.length) return secondsToPosition(map, u * step);
    if (u < leading) return secondsToPosition(map, u * step);
    if (u > leading + mapped) return secondsToPosition(map, last + (u - leading - mapped) * step);
    return beatToPosition(map, u - leading - anchor) ?? secondsToPosition(map, first);
  }
  function secondsAtUnit(unit: number): number {
    const u = clamp(unit);
    if (!bars.length || u < leading) return u * step;
    if (u > leading + mapped) return last + (u - leading - mapped) * step;
    const ordinal = u - leading;
    const i = Math.floor(ordinal);
    const a = map.beats[i] ?? first;
    const b = map.beats[i + 1] ?? a;
    return a + (ordinal - i) * (b - a);
  }
  return {
    span,
    // Waveforms need only seconds, without allocating/classifying thousands of Positions.
    secondsAtX: (x: number, width: number) => secondsAtUnit((x / width) * span),
    xAtSeconds: (seconds: number, width: number) => (unitAtSeconds(seconds) / span) * width,
    positionAtX: (x: number, width: number) => positionAtUnit((x / width) * span),
    xAtPosition: (position: Position, width: number) =>
      (unitAtSeconds(position.seconds) / span) * width,
    visibleBars(left: number, viewport: number, width: number) {
      return bars.filter(
        (b) =>
          (unitAtSeconds(b.endSeconds) / span) * width >= left &&
          (unitAtSeconds(b.startSeconds) / span) * width <= left + viewport,
      );
    },
  };
}
export type TimelineAxis = ReturnType<typeof timelineAxis>;
export type TimelineRow = { kind: 'audio' | 'midi'; height: number };
export type TimelineInstrument = {
  stem: ReferenceStem;
  drums: boolean;
  quiet: boolean;
  rows: TimelineRow[];
};
export function timelineRows(song: ReferenceSong, showAudio: boolean): TimelineInstrument[] {
  const order = ['drums', 'bass', 'keys', 'other'];
  const rank = (id: string) => {
    const n = order.indexOf(id);
    return n < 0 ? order.length : n;
  };
  return [...song.stems]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((stem) => ({
      stem,
      drums: stem.id === 'drums',
      quiet: stem.transcription === 'skipped_quiet' || stem.levelDb < -30,
      rows: [
        ...(showAudio ? [{ kind: 'audio' as const, height: 32 }] : []),
        { kind: 'midi', height: 44 },
      ],
    }));
}
export type NoteMark = { x: number; end: number; pitch: number; velocity: number };
/** Cap each bar cell, evenly across its full contents. Never cap the whole song at 200. */
export function noteMarks(stem: ReferenceStem, axis: TimelineAxis) {
  const cells = new Map<number | null, NoteMark[]>();
  for (const note of stem.notes) {
    const position = note.start;
    const key = position.kind === 'uncovered' ? null : position.bar;
    const list = cells.get(key) ?? [];
    list.push({
      x: axis.xAtSeconds(note.startSeconds, 1),
      end: axis.xAtSeconds(note.endSeconds, 1),
      pitch: note.pitch,
      velocity: note.velocity,
    });
    cells.set(key, list);
  }
  return [...cells.values()].flatMap((list) => {
    list.sort((a, b) => a.x - b.x);
    return list.length <= CELL_CAP
      ? list
      : Array.from(
          { length: CELL_CAP },
          (_, i) => list[Math.round((i * (list.length - 1)) / (CELL_CAP - 1))],
        );
  });
}

/** The overview's contour is a summary of simultaneous pitches, not a piano roll. */
export function contourMarks(
  marks: readonly NoteMark[],
  span: number,
  lowVoice: boolean,
): NoteMark[] {
  const sorted = [...marks].sort((a, b) => a.x - b.x);
  const result: NoteMark[] = [];
  for (const mark of sorted) {
    const last = result.at(-1);
    if (last && Math.round(last.x * span * 8) === Math.round(mark.x * span * 8)) {
      last.pitch = lowVoice ? Math.min(last.pitch, mark.pitch) : Math.max(last.pitch, mark.pitch);
      last.end = Math.max(last.end, mark.end);
    } else result.push({ ...mark });
  }
  return result;
}

/** Optional metadata from the grid wave; the base ReferenceBar contract stays usable. */
export function barInference(bar: ReferenceBar): string {
  return [...new Set((bar.inferences ?? []).map((i) => i.kind.replaceAll('-', ' ')))].join(', ');
}
