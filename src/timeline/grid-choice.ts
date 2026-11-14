import { referenceBars, secondsToPosition } from '../reference/beats';
import { deriveGrid } from '../reference/grid';
import type { BeatGrid, BeatMap, GridMultiplier, ReferenceSong } from '../reference/types';

export type BarGrouping = { beatsPerBar: number; firstBeat: number };
/** Count the detected evidence, before consistent-grid inference. */
export function meterEvidence(song: ReferenceSong): readonly { beats: number; bars: number }[] {
  const counts = new Map<number, number>();
  for (const bar of song.detectedBars)
    if (!bar.partial) {
      const n = bar.endBeat - bar.startBeat;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  return [...counts].map(([beats, bars]) => ({ beats, bars })).sort((a, b) => b.bars - a.bars);
}
export function splitMeter(song: ReferenceSong): boolean {
  const counts = meterEvidence(song),
    total = counts.reduce((n, c) => n + c.bars, 0);
  return counts.filter((c) => c.bars >= 2 && c.bars / total >= 0.2).length > 1;
}
/** Explicit regrouping moves bar lines only. Detected beats/evidence remain immutable. */
export function candidateGrid(
  song: ReferenceSong,
  multiplier: GridMultiplier,
  grouping: BarGrouping | null,
): BeatGrid {
  if (
    grouping &&
    (!Number.isInteger(grouping.beatsPerBar) ||
      grouping.beatsPerBar < 1 ||
      grouping.beatsPerBar > 12 ||
      !Number.isInteger(grouping.firstBeat) ||
      grouping.firstBeat < 0 ||
      grouping.firstBeat >= grouping.beatsPerBar)
  )
    throw Error('Invalid bar grouping');
  const base = deriveGrid({ ...song.detectedBeatMap, coverage: song.beatMap.coverage }, multiplier);
  if (!grouping || !base.map.downbeats.length) return base;
  // Missing beats have no known count. Resume phase from evidence after each gap.
  const anchors = [
    base.map.downbeats[0],
    ...base.map.coverage.gaps.map(([, end]) => base.map.downbeats.find((t) => t >= end)),
  ].flatMap((t) => (t === undefined ? [] : [base.map.beats.indexOf(t)]));
  const uncertain = base.map.coverage.gaps.map(([start, end]) => {
    const next = base.map.downbeats.find((t) => t >= end);
    const restart =
      next === undefined
        ? undefined
        : base.map.beats[base.map.beats.indexOf(next) + grouping.firstBeat];
    return [start, restart ?? Infinity] as const;
  });
  const inferences = base.inferences.filter(
    (i) => i.kind === 'fill-beat' || i.kind === 'thin-beat',
  );
  const map: BeatMap = {
    ...base.map,
    beatsPerBar: grouping.beatsPerBar,
    downbeats: base.map.beats.filter((seconds, i) => {
      if (uncertain.some(([start, end]) => seconds > start && seconds < end)) return false;
      const anchor = anchors.findLast((a) => a <= i);
      if (anchor === undefined) return false;
      const offset = i - anchor - grouping.firstBeat;
      return offset >= 0 && offset % grouping.beatsPerBar === 0;
    }),
  };
  return {
    ...base,
    map,
    inferences,
    bars: referenceBars(map).map((bar) => ({
      ...bar,
      partial:
        bar.partial ||
        (bar.endSeconds === map.beats.at(-1) && bar.endBeat - bar.startBeat < grouping.beatsPerBar),
      inferences: inferences.filter(
        (i) => i.seconds >= bar.startSeconds && i.seconds < bar.endSeconds,
      ),
    })),
  };
}
export function chooseGrid(song: ReferenceSong, grid: BeatGrid): ReferenceSong {
  const position = (note: ReferenceSong['stems'][number]['notes'][number]) => ({
    ...note,
    start: secondsToPosition(grid.map, note.startSeconds),
    end: secondsToPosition(grid.map, note.endSeconds),
  });
  return {
    ...song,
    grid,
    beatMap: grid.map,
    bars: grid.bars,
    pickupBeats: grid.map.beats.filter((t) => t < (grid.map.downbeats[0] ?? 0)).length,
    stems: song.stems.map((stem) => ({
      ...stem,
      notes: stem.notes.map(position),
      midiNotes: stem.midiNotes.map(position),
    })),
  };
}
